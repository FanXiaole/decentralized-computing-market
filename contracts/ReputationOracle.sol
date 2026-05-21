// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationOracle
 * @notice 链上信誉评分存储合约
 * @dev 采用Oracle模式：后端计算信誉分，通过Oracle账户写入链上
 *
 * 设计思路（汇报要点）：
 * [汇报亮点] Oracle Pattern：链下计算 + 链上存储
 * - 信誉评分算法复杂（加权平均、时间衰减、多分量计算），在链上执行Gas成本太高
 * - 因此将计算放在Python后端，仅将最终分数写入链上
 * - Oracle地址是后端服务器的以太坊账户，只有它能写入分数
 * - 这种模式在Chainlink、UMA等项目中广泛使用，是工业界最佳实践
 *
 * 为什么不在链上计算？
 * - 信誉算法涉及大量历史数据遍历、浮点运算
 * - 以太坊上存储和计算成本极高（每个SSTORE操作20000 gas）
 * - 将计算放在链下、结果放在链上，兼顾去中心化和成本效率
 */
contract ReputationOracle is Ownable {
    // ========== 数据结构 ==========

    /**
     * @notice 单次评分记录
     * @dev 存储每次评分更新的快照，用于构建信誉变化历史
     * @param score 信誉分（0-100整数）
     * @param timestamp 评分时间戳
     * @param breakdown 各分量得分的JSON编码字符串（供前端解析展示雷达图）
     *   格式示例: {"completion":85,"dispute":90,"speed":70,"maturity":60}
     */
    struct ScoreRecord {
        uint8 score;        // 0-100，使用uint8节省存储（一个slot可放多个值）
        uint64 timestamp;   // Unix时间戳，uint64够用到公元292277年
        string breakdown;   // JSON字符串，仅在链上存储不解析
    }

    /**
     * @notice 节点信誉档案
     * @dev 将相关数据打包在一个mapping中减少存储slot
     */
    struct NodeProfile {
        uint8 currentScore;             // 当前综合信誉分 (0-100)
        ScoreRecord[] history;          // 历史评分记录数组
    }

    // ========== 状态变量 ==========

    // 节点地址 → 信誉档案
    mapping(address => NodeProfile) private _profiles;

    // Oracle地址：有权调用updateScore的账户（后端服务器）
    address public oracle;

    // ========== 事件 ==========

    /**
     * @param breakdown 分量JSON字符串，前端可解析用于雷达图展示
     */
    event ScoreUpdated(
        address indexed node,
        uint8 oldScore,
        uint8 newScore,
        string breakdown
    );

    // ========== 错误定义 ==========
    error NotOracle();           // 非Oracle地址调用
    error InvalidScore();        // 分数不在0-100范围内

    /**
     * @notice 构造函数
     * @param initialOwner 合约拥有者（部署者）
     * @param initialOracle 初始Oracle地址（后端服务器账户）
     */
    constructor(address initialOwner, address initialOracle)
        Ownable(initialOwner)
    {
        oracle = initialOracle;
    }

    // ========== 权限控制 ==========

    /**
     * @notice 更新Oracle地址
     * @param newOracle 新的Oracle地址
     *
     * 设计理由：
     * - 只有拥有者可更换Oracle，用于后端服务器迁移或密钥轮换
     * - 这种灵活性在生产环境中很重要
     */
    function setOracle(address newOracle) external onlyOwner {
        oracle = newOracle;
    }

    /**
     * @notice 修饰器：仅Oracle可调用
     */
    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    // ========== 核心功能 ==========

    /**
     * @notice 更新节点信誉分（仅Oracle可调用）
     * @param node 节点地址
     * @param newScore 新的信誉分 (0-100)
     * @param breakdownJSON 各分量得分的JSON字符串
     *
     * Gas优化：
     * - 使用uint8存储分数，比uint256节省存储空间
     * - breakdown作为字符串存储，不做链上解析（节省Gas）
     *
     * 调用频率：
     * - 后端定时任务（每N个任务完成或每M分钟）调用一次
     * - 每次调用消耗约50000-100000 gas（取决于历史数组长度）
     */
    function updateScore(
        address node,
        uint8 newScore,
        string calldata breakdownJSON
    ) external onlyOracle {
        if (newScore > 100) revert InvalidScore();

        NodeProfile storage profile = _profiles[node];
        uint8 oldScore = profile.currentScore;

        // 将新评分追加到历史记录
        // 注意：存储数组的push操作消耗gas随数组长度线性增长
        // 生产环境可考虑限制历史记录最大长度（如保留最近100条）
        profile.history.push(ScoreRecord({
            score: newScore,
            timestamp: uint64(block.timestamp),
            breakdown: breakdownJSON
        }));

        // 更新当前分数
        profile.currentScore = newScore;

        emit ScoreUpdated(node, oldScore, newScore, breakdownJSON);
    }

    // ========== 查询接口 ==========

    /**
     * @notice 获取节点当前信誉分
     * @param node 节点地址
     * @return 当前信誉分 (0-100)，未初始化返回0
     */
    function getScore(address node) external view returns (uint8) {
        return _profiles[node].currentScore;
    }

    /**
     * @notice 获取节点信誉历史记录
     * @param node 节点地址
     * @return 所有历史评分记录
     *
     * 注意：此函数在前端调用时使用ethers的callStatic，不消耗Gas
     * 但如果历史数组很大，可能在RPC节点上有超时风险
     * 前端应做好分页加载的准备
     */
    function getHistory(address node)
        external
        view
        returns (ScoreRecord[] memory)
    {
        return _profiles[node].history;
    }

    /**
     * @notice 获取节点信誉历史记录数量
     * @param node 节点地址
     * @return 历史记录数量
     *
     * 设计理由：
     * - 前端可先调用此函数获取总数，再分批加载历史记录
     * - 避免一次加载全部记录导致的性能问题
     */
    function getHistoryLength(address node) external view returns (uint256) {
        return _profiles[node].history.length;
    }

    /**
     * @notice 分段获取信誉历史（支持前端分页）
     * @param node 节点地址
     * @param start 起始索引
     * @param count 获取数量
     * @return records 历史记录片段
     *
     * 设计理由：
     * - 避免一次返回所有数据导致gas超限或RPC超时
     * - 前端实现"加载更多"的分页交互
     */
    function getHistoryPaginated(
        address node,
        uint256 start,
        uint256 count
    ) external view returns (ScoreRecord[] memory records) {
        NodeProfile storage profile = _profiles[node];
        uint256 len = profile.history.length;

        if (start >= len) return new ScoreRecord[](0);

        uint256 end = start + count;
        if (end > len) end = len;
        uint256 resultLen = end - start;

        records = new ScoreRecord[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            records[i] = profile.history[start + i];
        }
    }

    /**
     * @notice 检查节点信誉是否达到要求
     * @param node 节点地址
     * @param minScore 最低信誉分要求
     * @return 是否达标
     *
     * 使用场景：ComputeMarket在节点接单时调用，验证信誉门槛
     */
    function isQualified(address node, uint8 minScore)
        external
        view
        returns (bool)
    {
        return _profiles[node].currentScore >= minScore;
    }
}
