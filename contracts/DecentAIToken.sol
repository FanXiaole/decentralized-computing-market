// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 使用OpenZeppelin的ERC-20标准实现，安全且经过审计
// Ownable：限制敏感操作（如mint）只能由合约拥有者调用
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DecentAIToken
 * @notice DecentAI平台的治理和支付代币
 * @dev ERC-20标准代币，带mint和burn功能
 *
 * 设计思路：
 * - 平台原生代币用于任务报酬支付和节点质押
 * - 拥有者可mint新代币用于激励计划（如早期节点奖励）
 * - 节点可burn代币以减少流通量（可选的通缩机制）
 * - 使用OpenZeppelin确保ERC-20标准兼容性
 */
contract DecentAIToken is ERC20, ERC20Burnable, Ownable {
    /**
     * @notice 构造函数：初始化代币名称、符号和初始供应量
     * @param initialOwner 合约拥有者地址（通常为部署者或DAO多签钱包）
     *
     * 设计理由：
     * - 初始供应量1000万枚，精度18位小数（与ETH保持一致）
     * - 所有初始代币分配给拥有者，后续通过mint分发
     * - 这样设计是为了确保初始分配透明可审计
     */
    constructor(address initialOwner)
        ERC20("DecentAI Token", "DAIT")
        Ownable(initialOwner)
    {
        // 初始铸造1000万枚DAIT代币给合约拥有者
        // 拥有者后续可通过平台的质押奖励机制分发给节点
        _mint(initialOwner, 10_000_000 * 10 ** decimals());
    }

    /**
     * @notice 铸造新代币（仅拥有者）
     * @param to 接收新代币的地址
     * @param amount 铸造数量（以wei为单位，即最小单位）
     *
     * 设计理由：
     * - 保留mint能力用于未来激励计划（如流动性挖矿、节点奖励）
     * - 如果未来DAO治理决定放弃mint权限，可调用renounceOwnership永久锁定
     * - [汇报亮点] 可升级经济模型：初始阶段通胀激励，成熟后可转为固定供应
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
