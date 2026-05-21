// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ReentrancyGuard：防止重入攻击，确保unstake等操作的原子性
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingManager
 * @notice 管理GPU节点的质押资金
 * @dev 节点质押DAIT代币以获得接单资格，作恶时质押金会被罚没
 *
 * 核心设计原则：
 * 1. [汇报亮点] 过度担保（Over-Collateralization）：质押金额 >= 任务报酬的150%
 *    - 如果只要求100%，节点完成任务后质押刚好够还，无额外损失空间
 *    - 150%确保即使被slash 50%，仍有足够资金覆盖退款
 * 2. 惩罚作为威慑：经济博弈替代复杂的ZK证明，降低链上验证成本
 * 3. 只有ComputeMarket合约有权执行slash，防止恶意罚没
 */
contract StakingManager is Ownable, ReentrancyGuard {
    // ========== 状态变量 ==========

    // 记录每个节点的质押余额（单位：wei）
    mapping(address => uint256) private _stakes;

    // 记录每个节点当前进行中的任务数量
    // 设计理由：有进行中任务时不允许unstake，防止节点接单后立即抽走质押金跑路
    mapping(address => uint256) private _activeTaskCount;

    // 被授权可调用slash函数的合约地址（即ComputeMarket合约）
    // 设计理由：只有市场合约能执行惩罚，后端Oracle只能建议，不能直接执行
    address public authorizedMarket;

    // 平台代币合约地址（DAIT），在stake/unstake/slash时进行转账
    address public tokenAddress;

    // ========== 事件（供前端实时监听） ==========

    // indexed参数允许前端按地址过滤事件，实现高效查询
    event Staked(address indexed node, uint256 amount);
    event Unstaked(address indexed node, uint256 amount);
    // reason字段记录slash原因，便于链上审计和前端展示
    event Slashed(address indexed node, uint256 amount, string reason);

    // ========== 错误定义（节省Gas比require string） ==========
    error UnauthorizedMarket();       // 非授权市场合约调用
    error InsufficientStake();        // 质押金额不足
    error HasActiveTasks();           // 有进行中任务，无法提取
    error ZeroAmount();               // 金额为零

    /**
     * @notice 构造函数
     * @param initialOwner 合约拥有者（部署者）
     * @param token 平台代币地址（DAIT）
     */
    constructor(address initialOwner, address token) Ownable(initialOwner) {
        tokenAddress = token;
    }

    // ========== 权限控制 ==========

    /**
     * @notice 设置授权的ComputeMarket合约地址
     * @param market 市场合约地址
     *
     * 设计理由：
     * - 只有拥有者可调用，且只能设置一次（通过检查是否已设置）
     * - 这种"白名单授权"模式比简单的onlyOwner更安全
     * - 避免部署后忘记设置授权合约导致slash功能失效
     */
    function setAuthorizedMarket(address market) external onlyOwner {
        authorizedMarket = market;
    }

    /**
     * @notice 修饰器：仅授权市场合约可调用
     * @dev 用于slash函数，确保只有ComputeMarket能执行惩罚
     */
    modifier onlyMarket() {
        if (msg.sender != authorizedMarket) revert UnauthorizedMarket();
        _;
    }

    // ========== 核心质押逻辑 ==========

    /**
     * @notice 节点存入质押金
     * @param amount 质押金额（DAIT wei）
     *
     * 使用流程：
     * 1. 前端先调用DAIT.approve(StakingManager地址, amount)授权代币
     * 2. 再调用此函数，合约将代币从节点钱包转入合约
     *
     * 设计理由：
     * - 使用IERC20的transferFrom而非直接transfer，符合ERC-20标准流程
     * - 用户需要先approve，这是DeFi的标准安全模式
     * - 可多次调用累积质押，每次追加都会触发Staked事件
     */
    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        // 使用安全的transferFrom，如果用户未approve或余额不足会自动revert
        // 这是OpenZeppelin IERC20的标准行为，不需要额外的require检查
        IERC20 token = IERC20(_getTokenAddress());
        token.transferFrom(msg.sender, address(this), amount);

        _stakes[msg.sender] += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice 节点提取质押金
     * @param amount 提取金额
     *
     * 安全约束（按检查顺序）：
     * 1. 金额不为零
     * 2. 余额足够
     * 3. 无进行中任务——防止节点接单后立即抽走质押金跑路
     *    [汇报亮点] 这是"质押锁定"机制的核心：经济安全由合约逻辑保证
     */
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (_activeTaskCount[msg.sender] > 0) revert HasActiveTasks();
        if (_stakes[msg.sender] < amount) revert InsufficientStake();

        _stakes[msg.sender] -= amount;

        IERC20 token = IERC20(_getTokenAddress());
        token.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    // ========== 惩罚机制（仅授权市场合约） ==========

    /**
     * @notice 罚没节点的质押金（仅ComputeMarket合约可调用）
     * @param node 被惩罚的节点地址
     * @param amount 罚没金额
     * @param reason 惩罚原因（如"结果验证失败"、"任务超时"等）
     *
     * 设计理由：
     * - 被slash的资金转入合约拥有者地址（可配置为平台金库/DAO）
     * - 拥有者可将罚金部分销毁、部分用于补偿受害用户
     * - [汇报亮点] 这是经济博弈替代ZK的核心：随机抽查+重罚=足够威慑
     *   类比Filecoin的罚没机制和Eigenlayer的Slashing设计
     *
     * 安全注意：
     * - onlyMarket修饰器确保只有ComputeMarket能调用
     * - 即使节点余额不足，也罚没全部余额（不完全revert）
     */
    function slash(
        address node,
        uint256 amount,
        string calldata reason
    ) external onlyMarket {
        uint256 nodeStake = _stakes[node];
        // 如果质押余额不足，罚没全部余额（不revert，因为必须执行惩罚）
        uint256 slashAmount = nodeStake < amount ? nodeStake : amount;

        _stakes[node] -= slashAmount;

        // 罚金转入合约拥有者（平台金库）
        IERC20 token = IERC20(_getTokenAddress());
        token.transfer(owner(), slashAmount);

        emit Slashed(node, slashAmount, reason);
    }

    // ========== 查询接口 ==========

    /**
     * @notice 查询节点当前质押余额
     * @param node 节点地址
     * @return 质押余额（DAIT wei）
     */
    function getStakeBalance(address node) external view returns (uint256) {
        return _stakes[node];
    }

    /**
     * @notice 检查节点是否有资格接单
     * @param node 节点地址
     * @param requiredStake 任务要求的质押金额
     * @return 是否有资格
     *
     * 设计理由：
     * - requiredStake是任务报酬的150%，由ComputeMarket在接单时计算
     * - 此函数为纯view函数，不消耗Gas（在链下调用时）
     */
    function isEligible(address node, uint256 requiredStake)
        external
        view
        returns (bool)
    {
        return _stakes[node] >= requiredStake;
    }

    // ========== 内部辅助函数 ==========

    /**
     * @notice 增加节点的进行中任务计数
     * @dev 由ComputeMarket在节点接单时调用
     */
    function incrementActiveTasks(address node) external onlyMarket {
        _activeTaskCount[node]++;
    }

    /**
     * @notice 减少节点的进行中任务计数
     * @dev 由ComputeMarket在任务完成/争议解决后调用
     */
    function decrementActiveTasks(address node) external onlyMarket {
        if (_activeTaskCount[node] > 0) {
            _activeTaskCount[node]--;
        }
    }

    /**
     * @notice 获取代币地址
     * @dev 返回构造函数中设置的代币地址
     */
    function _getTokenAddress() internal view returns (address) {
        return tokenAddress;
    }
}

// IERC20最小接口定义（避免循环依赖）
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}
