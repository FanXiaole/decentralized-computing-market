"""
DecentAI Compute Market — Web3.py 区块链交互层

负责后端与以太坊智能合约的所有交互：
- 读取合约状态（任务信息、质押余额、信誉分）
- 写入链上数据（更新信誉分）
- 触发惩罚操作（slash）

设计模式：Singleton单例
- 整个应用共享一个Web3连接和合约实例
- 避免重复建立连接
- 合约ABI通过编译后的artifacts文件自动加载
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from functools import lru_cache

from web3 import Web3
from web3.middleware import SignAndSendRawMiddlewareBuilder
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# 合约ABI路径（Hardhat编译输出）
ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "artifacts" / "contracts"


class BlockchainClient:
    """
    区块链客户端单例

    封装了与DecentAI智能合约的所有交互逻辑
    对外暴露简洁的方法，隐藏Web3.py的复杂性
    """

    def __init__(self):
        """
        初始化Web3连接和合约实例

        从环境变量读取：
        - RPC_URL: 以太坊节点RPC地址
        - CONTRACT_ADDRESS_*: 四个合约的部署地址
        - ORACLE_PRIVATE_KEY: Oracle账户私钥（用于写操作）
        """
        self.rpc_url = os.getenv("RPC_URL", "http://127.0.0.1:8545")
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))

        # 验证连接
        if not self.w3.is_connected():
            logger.warning(f"⚠️ 无法连接到RPC节点: {self.rpc_url}")
        else:
            chain_id = self.w3.eth.chain_id
            logger.info(f"✅ 已连接到链ID: {chain_id}")

        # 加载合约地址
        self.market_addr = os.getenv("CONTRACT_ADDRESS_COMPUTE_MARKET", "")
        self.staking_addr = os.getenv("CONTRACT_ADDRESS_STAKING_MANAGER", "")
        self.reputation_addr = os.getenv("CONTRACT_ADDRESS_REPUTATION_ORACLE", "")
        self.token_addr = os.getenv("CONTRACT_ADDRESS_TOKEN", "")

        # 设置Oracle账户
        oracle_pk = os.getenv("ORACLE_PRIVATE_KEY", "")
        if oracle_pk:
            self.oracle_account = self.w3.eth.account.from_key(oracle_pk)
            # 使用private key签名交易中间件
            self.w3.eth.default_account = self.oracle_account.address
            self.w3.middleware_onion.add(
                SignAndSendRawMiddlewareBuilder.build(self.oracle_account)
            )
            logger.info(f"🔮 Oracle账户: {self.oracle_account.address}")
        else:
            self.oracle_account = None
            logger.warning("⚠️ 未配置ORACLE_PRIVATE_KEY，写操作不可用")

        # 加载合约实例
        self.market_contract = self._load_contract(
            "ComputeMarket.sol", "ComputeMarket", self.market_addr
        )
        self.staking_contract = self._load_contract(
            "StakingManager.sol", "StakingManager", self.staking_addr
        )
        self.reputation_contract = self._load_contract(
            "ReputationOracle.sol", "ReputationOracle", self.reputation_addr
        )

    def _load_contract(self, filename: str, contract_name: str, address: str):
        """
        从Hardhat artifacts加载合约ABI并创建合约实例

        参数:
            filename: Solidity源文件名
            contract_name: 合约名称
            address: 部署地址
        返回:
            Contract实例，如果加载失败返回None
        """
        if not address:
            logger.warning(f"⚠️ 未配置{contract_name}地址，无法加载合约")
            return None

        try:
            artifact_path = ARTIFACTS_DIR / filename / f"{contract_name}.json"
            with open(artifact_path, "r") as f:
                artifact = json.load(f)

            contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(address),
                abi=artifact["abi"],
            )
            logger.info(f"✅ 已加载{contract_name}: {address}")
            return contract
        except Exception as e:
            logger.error(f"❌ 加载{contract_name}失败: {e}")
            return None

    # ==================== 查询操作（免费，不消耗Gas） ====================

    def get_task(self, task_id: int) -> Optional[Dict[str, Any]]:
        """
        获取链上任务详情

        参数:
            task_id: 任务ID
        返回:
            任务详情字典
        """
        if not self.market_contract:
            return None

        try:
            task = self.market_contract.functions.getTask(task_id).call()
            return {
                "task_id": task_id,
                "poster": task[0],
                "node": task[1],
                "status": ["Open", "InProgress", "UnderReview", "Completed", "Disputed"][task[2]],
                "reward_wei": task[3],
                "deadline": task[4],
                "min_reputation": task[5],
                "result_hash": "0x" + task[6].hex() if task[6] else "",
                "description": task[7],
            }
        except Exception as e:
            logger.error(f"获取任务#{task_id}失败: {e}")
            return None

    def get_task_count(self) -> int:
        """获取链上任务总数"""
        if not self.market_contract:
            return 0
        try:
            return self.market_contract.functions.getTaskCount().call()
        except Exception as e:
            logger.error(f"获取任务总数失败: {e}")
            return 0

    def get_node_stake(self, node_address: str) -> int:
        """
        查询节点的链上质押余额

        参数:
            node_address: 节点以太坊地址
        返回:
            质押余额（wei）
        """
        if not self.staking_contract:
            return 0
        try:
            addr = Web3.to_checksum_address(node_address)
            return self.staking_contract.functions.getStakeBalance(addr).call()
        except Exception as e:
            logger.error(f"查询质押余额失败: {e}")
            return 0

    def get_node_reputation(self, node_address: str) -> int:
        """
        查询节点的链上信誉分

        参数:
            node_address: 节点以太坊地址
        返回:
            信誉分（0-100）
        """
        if not self.reputation_contract:
            return 0
        try:
            addr = Web3.to_checksum_address(node_address)
            return self.reputation_contract.functions.getScore(addr).call()
        except Exception as e:
            logger.error(f"查询信誉分失败: {e}")
            return 0

    def get_reputation_history(self, node_address: str) -> list:
        """
        查询节点的链上信誉变化历史

        参数:
            node_address: 节点以太坊地址
        返回:
            历史评分记录列表
        """
        if not self.reputation_contract:
            return []
        try:
            addr = Web3.to_checksum_address(node_address)
            records = self.reputation_contract.functions.getHistory(addr).call()
            return [
                {
                    "score": r[0],
                    "timestamp": r[1],
                    "breakdown": r[2],
                }
                for r in records
            ]
        except Exception as e:
            logger.error(f"查询信誉历史失败: {e}")
            return []

    # ==================== 写操作（消耗Gas） ====================

    def update_reputation_on_chain(
        self, node_address: str, score: int, breakdown_json: str
    ) -> Optional[str]:
        """
        将信誉分更新写入链上ReputationOracle合约

        只有Oracle账户可以调用此函数（合约层的onlyOracle修饰器）
        调用此函数需要消耗Gas

        参数:
            node_address: 节点地址
            score: 新的综合信誉分（0-100整数）
            breakdown_json: 分量明细的JSON字符串
        返回:
            交易哈希，失败返回None
        """
        if not self.reputation_contract or not self.oracle_account:
            logger.warning("Oracle未配置，无法更新链上信誉分")
            return None

        try:
            addr = Web3.to_checksum_address(node_address)
            tx = self.reputation_contract.functions.updateScore(
                addr, score, breakdown_json
            ).build_transaction({
                "from": self.oracle_account.address,
                "nonce": self.w3.eth.get_transaction_count(
                    self.oracle_account.address
                ),
            })

            # 预估Gas
            try:
                tx["gas"] = self.w3.eth.estimate_gas(tx)
            except Exception:
                tx["gas"] = 200000  # 默认Gas限制

            # 发送交易
            tx_hash = self.w3.eth.send_transaction(tx)
            logger.info(f"✅ 信誉分已上链: {node_address} → {score}分, tx={tx_hash.hex()}")
            return tx_hash.hex()
        except Exception as e:
            logger.error(f"更新链上信誉分失败: {e}")
            return None


# ==================== 单例实例 ====================

@lru_cache(maxsize=1)
def get_blockchain_client() -> BlockchainClient:
    """
    获取区块链客户端单例

    使用lru_cache确保只创建一次实例
    所有API模块共享同一个客户端
    """
    return BlockchainClient()
