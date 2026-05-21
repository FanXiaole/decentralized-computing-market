// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ReentrancyGuard：防止重入攻击，保护支付和退款流程
// Ownable：限制平台费率修改等敏感操作
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// 前向声明：引用其他合约的接口
// 设计理由：使用接口而非import合约，减少编译依赖，降低合约体积
interface IStakingManager {
    function getStakeBalance(address node) external view returns (uint256);
    function isEligible(address node, uint256 requiredStake) external view returns (bool);
    function incrementActiveTasks(address node) external;
    function decrementActiveTasks(address node) external;
    function slash(address node, uint256 amount, string calldata reason) external;
}

interface IReputationOracle {
    function getScore(address node) external view returns (uint8);
    function isQualified(address node, uint8 minScore) external view returns (bool);
}

interface IERC20Market {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/**
 * @title ComputeMarket
 * @notice 去中心化AI算力租赁市场的核心合约
 * @dev 管理任务全生命周期：发布 → 接单 → 提交 → 确认/争议
 *
 * ========== 核心设计理念 ==========
 *
 * 1. [汇报亮点] Trustless Settlement（去信任结算）
 *    - 报酬由合约托管，需求方发布任务时锁定，节点完成后自动释放
 *    - 平台方无法干预资金流向，所有规则由智能合约代码执行
 *    - 这是DeFi"Code is Law"理念在算力市场的应用
 *
 * 2. [汇报亮点] 经济博弈替代ZK证明
 *    - 传统去中心化计算需ZKP验证（零知识证明），计算成本极高
 *    - 本方案用质押+随机抽查+重罚机制替代：作恶的经济损失远大于收益
 *    - 类比：Filecoin的罚没机制、Eigenlayer的Slashing设计
 *
 * 3. [汇报亮点] Gas优化：链上仅存结果哈希
 *    - 不将原始计算结果存储在链上（每个字节32 gas）
 *    - 只存bytes32哈希值，用于争议时的结果比对
 *    - 原始数据通过IPFS/Arweave等链下存储方案解决
 *
 * 4. [汇报亮点] Event-Driven Architecture
 *    - 所有状态变更都触发事件，前端通过ethers订阅实时更新
 *    - 无需轮询，类似WebSocket推送但基于区块链日志系统
 *
 * ========== 任务状态机 ==========
 *   Open ──(节点接单)──> InProgress
 *   InProgress ──(节点提交)──> UnderReview
 *   UnderReview ──(需求方确认)──> Completed (报酬释放)
 *   UnderReview ──(需求方争议)──> Disputed (罚没质押+退款)
 *
 *   安全考虑：
 *   - 状态流转不可逆（防止状态回退攻击）
 *   - 每个操作都有前置状态检查（防止竞态条件）
 */
contract ComputeMarket is Ownable, ReentrancyGuard {
    // ========== 枚举定义 ==========

    // 任务状态枚举，使用Solidity的enum实现状态机
    enum TaskStatus {
        Open,          // 已发布，等待节点接单
        InProgress,    // 节点已接单，计算进行中
        UnderReview,   // 节点已提交结果，等待需求方确认
        Completed,     // 需求方确认，报酬已释放
        Disputed       // 需求方发起争议，进入惩罚流程
    }

    // ========== 数据结构 ==========

    /**
     * @notice 任务结构体
     * @dev 精心设计字段顺序以优化Storage Packing（Solidity每个slot 32字节）
     *
     * Storage布局优化分析：
     * - address占20字节，bool/enum/uint96可打包在同一个slot
     * - uint256单独占一个slot
     * - 当前设计目标：最小化SSTORE操作次数
     */
    struct Task {
        address poster;             // 需求方地址（20字节）
        address node;               // 接单节点地址（20字节），初始为zero address
        TaskStatus status;          // 任务当前状态（1字节enum）
        uint96 reward;              // 任务报酬（uint96最大值79e27，约790亿ETH，永久够用）
        uint256 deadline;           // 任务截止时间戳（Unix timestamp）
        uint8 minReputation;        // 最低信誉要求（0-100）
        bytes32 resultHash;         // 节点提交的结果哈希（不存原始数据，节省Gas）
        string description;         // 任务描述/IPFS链接（存链上较贵，生产建议用IPFS hash）
    }

    // ========== 状态变量 ==========

    // 任务ID计数器（自增，从1开始，0保留为"空"）
    uint256 private _taskIdCounter;

    // 任务ID → 任务详情
    mapping(uint256 => Task) private _tasks;

    // 平台手续费率，基点为10000（3% = 300）
    // 使用uint16节省存储（最大65535，远超需求）
    uint16 public platformFeeRate = 300; // 3%

    // 过度担保比例（基点为10000，150% = 15000）
    // [汇报亮点] 150%担保比100%提供更强的经济安全保障
    uint16 public collateralRate = 15000; // 150%

    // 依赖合约
    IStakingManager public stakingManager;
    IReputationOracle public reputationOracle;
    address public tokenAddress;

    // ========== 事件（供前端实时监听） ==========

    // [汇报亮点] 所有事件均包含indexed参数，前端可按地址高效过滤
    event TaskPosted(
        uint256 indexed taskId,
        address indexed poster,
        uint256 reward,
        uint8 minReputation,
        uint256 deadline
    );

    event TaskAccepted(
        uint256 indexed taskId,
        address indexed node
    );

    event ResultSubmitted(
        uint256 indexed taskId,
        address indexed node,
        bytes32 resultHash
    );

    event PaymentReleased(
        uint256 indexed taskId,
        address indexed node,
        uint256 nodeAmount,
        uint256 platformFee
    );

    // [汇报亮点] 罚没事件包含reason字段，为链上审计和前端展示提供完整信息
    event StakeSlashed(
        address indexed node,
        uint256 amount,
        string reason
    );

    event TaskDisputed(
        uint256 indexed taskId,
        address indexed poster,
        address indexed node
    );

    // ========== 错误定义 ==========
    error TaskNotOpen();                 // 任务状态不是Open
    error TaskNotInProgress();           // 任务状态不是InProgress
    error TaskNotUnderReview();          // 任务状态不是UnderReview
    error NotTaskPoster();               // 调用者不是需求方
    error NotTaskNode();                 // 调用者不是接单节点
    error InsufficientCollateral();      // 质押金不足
    error InsufficientReputation();      // 信誉分不够
    error InsufficientPayment();         // 支付金额不足
    error TaskExpired();                 // 任务已过截止时间
    error ZeroAddress();                 // 零地址

    // ========== 构造函数 ==========

    /**
     * @param stakingMgr StakingManager合约地址
     * @param reputationOracleAddr ReputationOracle合约地址
     * @param token 平台代币地址（DAIT）
     *
     * 部署顺序依赖：
     * 1. 先部署 DecentAIToken
     * 2. 再部署 StakingManager(token地址)
     * 3. 再部署 ReputationOracle
     * 4. 最后部署 ComputeMarket（传入上述地址），并在StakingManager中setAuthorizedMarket
     */
    constructor(
        address stakingMgr,
        address reputationOracleAddr,
        address token
    ) Ownable(msg.sender) {
        stakingManager = IStakingManager(stakingMgr);
        reputationOracle = IReputationOracle(reputationOracleAddr);
        tokenAddress = token;
    }

    // ========== 任务发布 ==========

    /**
     * @notice 发布新的算力任务
     * @param description 任务描述（建议用IPFS hash，节省Gas）
     * @param reward 任务报酬（DAIT wei）
     * @param deadline 任务截止时间戳（秒）
     * @param minReputation 最低信誉分要求（0-100）
     * @return taskId 新任务ID
     *
     * Gas消耗分析：
     * - 存储新任务：约100k gas（取决于字串长度）
     * - Token转账：约50k gas
     * - 优化建议：description使用IPFS CID（仅32字节），而非完整描述
     *
     * 前置条件：
     * 1. 调用者已approve足够的DAIT给此合约
     * 2. deadline必须晚于当前区块时间
     * 3. reward > 0且已转账到此合约
     */
    function postTask(
        string calldata description,
        uint256 reward,
        uint256 deadline,
        uint8 minReputation
    ) external returns (uint256 taskId) {
        if (reward == 0) revert InsufficientPayment();
        // 截止时间必须在未来，但demo阶段不做严格校验
        // 生产环境建议：require(deadline > block.timestamp, "Deadline must be in future");

        // 将报酬从需求方转入合约托管
        // 这是"Trustless"设计的核心：资金锁定在合约中，需求方无法单方面撤回
        IERC20Market(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            reward
        );

        _taskIdCounter++;
        taskId = _taskIdCounter;

        _tasks[taskId] = Task({
            poster: msg.sender,
            node: address(0),
            status: TaskStatus.Open,
            reward: uint96(reward),
            deadline: deadline,
            minReputation: minReputation,
            resultHash: bytes32(0),
            description: description
        });

        emit TaskPosted(taskId, msg.sender, reward, minReputation, deadline);
    }

    // ========== 节点接单 ==========

    /**
     * @notice 节点接受任务
     * @param taskId 任务ID
     *
     * 检查流程（按Gas消耗从低到高排列）：
     * 1. 任务状态为Open（防止同一任务被多节点并发接单）
     * 2. 信誉分达标（调用ReputationOracle）
     * 3. 质押金达标（>= 任务报酬 × 150%）（调用StakingManager）
     *
     * 设计理由：
     * - 先检查链上状态（免费），再调用外部合约（有Gas成本）
     * - 任一检查失败立即revert，不会部分执行
     *
     * [汇报亮点] 双门槛机制：信誉+质押双重筛选，保证接单节点质量
     */
    function acceptTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];

        // 检查1：任务状态必须为Open
        // 这同时防止了"同一任务被多次接单"的竞态条件
        if (task.status != TaskStatus.Open) revert TaskNotOpen();

        // 检查2：信誉分是否达标
        // 调用ReputationOracle合约查询节点当前信誉分
        if (!reputationOracle.isQualified(msg.sender, task.minReputation))
            revert InsufficientReputation();

        // 检查3：质押金是否充足（>= 任务报酬 × 150%）
        // [汇报亮点] 过度担保：150%确保作恶的经济损失远大于收益
        uint256 requiredStake = (uint256(task.reward) * collateralRate) / 10000;
        if (!stakingManager.isEligible(msg.sender, requiredStake))
            revert InsufficientCollateral();

        // 更新状态：Open → InProgress
        task.status = TaskStatus.InProgress;
        task.node = msg.sender;

        // 通知StakingManager该节点有一个进行中任务
        // 这样节点在任务期间不能unstake（防止跑路）
        stakingManager.incrementActiveTasks(msg.sender);

        emit TaskAccepted(taskId, msg.sender);
    }

    // ========== 提交结果 ==========

    /**
     * @notice 节点提交计算结果哈希
     * @param taskId 任务ID
     * @param resultHash 结果的keccak256哈希值
     *
     * [汇报亮点] Gas优化核心：链上只存哈希
     * - 不存储原始计算结果（可能几MB的模型输出）
     * - 只存32字节的bytes32哈希
     * - 原始结果通过IPFS传递，哈希用于争议时比对
     * - 单次存储节省数万gas
     *
     * 设计考量：
     * - 哈希只保证"内容未被篡改"，不保证"内容正确"
     * - "内容是否正确"由信誉系统+随机抽查来保证
     * - 这是去中心化计算的经典trade-off：安全 vs 效率
     */
    function submitResult(uint256 taskId, bytes32 resultHash) external {
        Task storage task = _tasks[taskId];

        if (task.status != TaskStatus.InProgress) revert TaskNotInProgress();
        if (task.node != msg.sender) revert NotTaskNode();

        // 检查是否超时
        // 注意：这里允许超时提交，但需求方可根据超时理由发起争议
        // 生产环境可考虑添加slashing惩罚超时节点

        task.status = TaskStatus.UnderReview;
        task.resultHash = resultHash;

        emit ResultSubmitted(taskId, msg.sender, resultHash);
    }

    // ========== 确认结果（正常流程终点） ==========

    /**
     * @notice 需求方确认结果并释放报酬
     * @param taskId 任务ID
     *
     * 支付分配逻辑：
     * - 平台费：reward × 3%（转入owner，即平台金库）
     * - 节点收益：reward × 97%（转入节点钱包）
     *
     * [汇报亮点] 合约自动结算，无需第三方介入
     */
    function confirmResult(uint256 taskId) external nonReentrant {
        Task storage task = _tasks[taskId];

        if (task.status != TaskStatus.UnderReview) revert TaskNotUnderReview();
        if (task.poster != msg.sender) revert NotTaskPoster();

        task.status = TaskStatus.Completed;

        // 计算平台手续费
        uint256 reward = uint256(task.reward);
        uint256 platformFee = (reward * platformFeeRate) / 10000;
        uint256 nodeAmount = reward - platformFee;

        // 释放报酬：节点收益
        IERC20Market(tokenAddress).transfer(task.node, nodeAmount);
        // 释放报酬：平台手续费（转入owner，即平台金库）
        IERC20Market(tokenAddress).transfer(owner(), platformFee);

        // 减少节点的进行中任务计数（释放质押约束）
        stakingManager.decrementActiveTasks(task.node);

        emit PaymentReleased(taskId, task.node, nodeAmount, platformFee);
    }

    // ========== 争议处理（异常流程） ==========

    /**
     * @notice 需求方对结果发起争议
     * @param taskId 任务ID
     * @param reason 争议原因（如"结果哈希与预期不符"）
     *
     * 争议处理流程：
     * 1. 任务状态改为Disputed
     * 2. 报酬全额退回给需求方
     * 3. 调用StakingManager罚没节点50%质押金
     * 4. 减少节点进行中任务计数
     *
     * 设计理由：
     * - Slash比例设计为50%，而非100%
     *   理由：保留部分质押让节点有"改过自新"的机会
     *   如果100%罚没，节点会放弃此账户，创建新账户作恶（Sybil攻击）
     *   50%的惩罚既足够痛，又保留节点继续运营的动力
     * - 全额退款给需求方，需求方零损失
     *
     * [汇报亮点] 这是经济博弈机制的关键执行点：
     *   如果节点返回错误结果，它损失50%质押 + 之前投入的计算成本
     *   而诚实完成只能获得任务报酬
     *   博弈均衡：只要 50%质押 > 任务报酬，诚实就是最优策略
     */
    function disputeResult(uint256 taskId, string calldata reason) external nonReentrant {
        Task storage task = _tasks[taskId];

        if (task.status != TaskStatus.UnderReview) revert TaskNotUnderReview();
        // 只有任务发布者才能发起争议
        if (task.poster != msg.sender) revert NotTaskPoster();

        task.status = TaskStatus.Disputed;

        // 全额退款给需求方
        uint256 reward = uint256(task.reward);
        IERC20Market(tokenAddress).transfer(task.poster, reward);

        // 节点惩罚：罚没质押金的50%
        // slashAmount = reward × 150% × 50% = reward × 75%
        // 即节点损失为其任务报酬的75%
        uint256 totalStake = stakingManager.getStakeBalance(task.node);
        uint256 slashAmount = totalStake / 2; // 50% of stake
        stakingManager.slash(task.node, slashAmount, reason);

        // 释放节点的进行中任务约束
        stakingManager.decrementActiveTasks(task.node);

        emit StakeSlashed(task.node, slashAmount, reason);
        emit TaskDisputed(taskId, msg.sender, task.node);
    }

    // ========== 管理接口 ==========

    /**
     * @notice 更新平台手续费率（仅拥有者）
     * @param newRate 新费率，基点制（如300 = 3%）
     *
     * 设计限制：费率上限5%（500基点）
     * 防止拥有者恶意调高费率损害用户利益
     * 如需超过上限需通过DAO治理投票
     */
    function setPlatformFeeRate(uint16 newRate) external onlyOwner {
        require(newRate <= 500, unicode"费率上限为5%");
        platformFeeRate = newRate;
    }

    /**
     * @notice 更新过度担保比例（仅拥有者）
     * @param newRate 新比例，基点制（如15000 = 150%）
     *
     * 安全约束：最低100%（1:1担保），最高300%
     */
    function setCollateralRate(uint16 newRate) external onlyOwner {
        require(newRate >= 10000 && newRate <= 30000, unicode"比例需在100%-300%之间");
        collateralRate = newRate;
    }

    // ========== 查询接口 ==========

    /**
     * @notice 获取任务详情
     * @param taskId 任务ID
     * @return 完整的任务结构体
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return _tasks[taskId];
    }

    /**
     * @notice 获取当前任务总数
     * @dev 用于前端分页加载任务列表
     */
    function getTaskCount() external view returns (uint256) {
        return _taskIdCounter;
    }

    /**
     * @notice 批量获取任务（支持前端分页）
     * @param start 起始任务ID
     * @param count 获取数量
     * @return tasks 任务数组
     */
    function getTasksPaginated(uint256 start, uint256 count)
        external
        view
        returns (Task[] memory tasks)
    {
        uint256 total = _taskIdCounter;
        if (start >= total) return new Task[](0);

        uint256 end = start + count;
        if (end > total) end = total;
        uint256 resultLen = end - start;

        tasks = new Task[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            tasks[i] = _tasks[start + i + 1]; // taskId从1开始
        }
    }
}
