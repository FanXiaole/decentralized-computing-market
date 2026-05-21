"""
DecentAI Compute Market — 结果抽样验证器

实现"信任但核查"（Trust but Verify）机制的核心模块。

=============================================================
设计理念（汇报重点）
=============================================================

[汇报亮点] 为什么选择随机抽样而不是全量验证？

1. **成本考量**：
   - 全量验证意味着每个任务都需要重新执行一次
   - 如果100个节点各完成1个AI训练任务，全量验证需要100倍计算资源
   - 随机抽查10%只需要额外10%的计算资源
   - 类比：税务局不会审计每一份纳税申报表

2. **威慑效果**：
   - 经济学上的"随机抽查+重罚"已被证明是非常有效的威慑机制
   - 在10%抽查率下，节点连续做假10次不被发现的概率仅为 (1-0.1)^10 ≈ 35%
   - 一旦被发现，质押金被slash 50%，信誉归零
   - 博弈均衡：作恶的期望收益远小于诚实收益
   - 类比：Filecoin的windowed PoSt验证机制

3. **可调节性**：
   - 抽查率可以根据平台成熟度动态调整
   - 早期：100%抽查（节点少，成本可控）
   - 成长期：50%抽查
   - 成熟期：10%抽查（节点多，信任已建立）

4. **为什么不是ZKP**：
   - 零知识证明(ZKP)可以提供完美的数学保证
   - 但当前的ZKP技术无法高效验证AI训练过程
   - 而且ZKP生成的计算开销是原始计算的100-1000倍
   - 经济博弈机制在成本效率上完胜ZKP
"""

import hashlib
import random
from typing import Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from .models import TaskRecord, NodeRecord


class ResultValidator:
    """
    结果抽样验证器

    核心流程：
    1. 每完成N个任务，触发一次验证
    2. 从最近完成的任务中随机抽取一个
    3. 重新执行被抽中任务的计算
    4. 比较结果哈希
    5. 如果不一致，返回fraud证据（需由调用方触发链上slash）

    职责边界：
    - 此模块只做"发现和标记"，不做"惩罚执行"
    - 链上slash由ComputeMarket合约执行
    - 这种分离确保了去中心化：后端不能单方面惩罚节点
    """

    # 默认抽查比例（可在环境变量中覆盖）
    DEFAULT_SAMPLE_RATE = 10  # 每10个任务抽查1个

    def __init__(self, db: Session, sample_rate: int = None):
        """
        初始化验证器

        参数:
            db: 数据库会话
            sample_rate: 抽查比例（每N个任务抽查1个），None则使用默认值
        """
        self.db = db
        self.sample_rate = sample_rate or self.DEFAULT_SAMPLE_RATE

    def should_validate(self, task_id: int) -> bool:
        """
        判断是否需要对指定任务进行抽查验证

        算法：
        - 使用伪随机数生成器，种子 = task_id + 固定盐值
        - 这样同一个task_id每次判断结果一致（可复现）
        - 同时任何人都可以验证"这个任务是否应该被抽查"（透明性）

        为什么用确定性随机而不是真随机：
        - 防止后端作弊：如果后端可以自由选择抽查哪个任务，
          可能针对性放过某些节点
        - 确定性随机让抽查逻辑完全透明，第三方可验证

        参数:
            task_id: 链上任务ID
        返回:
            bool: 是否需要抽查
        """
        # 确定性随机：seed = task_id + 固定盐值
        seed = f"decentai-validation-{task_id}-seed-2024"
        hash_value = hashlib.sha256(seed.encode()).hexdigest()
        # 将哈希转为0-99的整数
        random_value = int(hash_value[:8], 16) % 100

        # 如果随机值 < (100 / sample_rate)，触发抽查
        threshold = 100 / self.sample_rate
        return random_value < threshold

    def rerun_task(self, task_id: int) -> Optional[str]:
        """
        重新执行任务并返回结果哈希

        注意：这是模拟实现！
        在真实的DecentAI系统中，这里会：
        1. 从IPFS/Arweave获取任务的输入数据和代码
        2. 在有可信环境的GPU节点上重新执行
        3. 返回计算结果的哈希值

        当前Demo实现：
        - 从数据库查询任务记录
        - 返回存储的结果哈希（模拟重新计算一致的情况）
        - 实际生产环境需要对接真实的计算验证基础设施

        参数:
            task_id: 任务ID
        返回:
            str: 重新计算的结果哈希，如果无法执行则返回None
        """
        # 查询任务记录
        record = (
            self.db.query(TaskRecord)
            .filter(TaskRecord.onchain_task_id == task_id)
            .first()
        )

        if not record:
            return None

        # Demo模式：返回存储的哈希（模拟验证通过）
        # 生产环境：实际重新执行计算并返回新哈希
        return record.result_hash

    def compare_results(self, hash1: str, hash2: str) -> bool:
        """
        比较两个结果哈希是否一致

        参数:
            hash1: 原始提交的哈希
            hash2: 重新计算得到的哈希
        返回:
            bool: 是否一致
        """
        return hash1.lower() == hash2.lower()

    def trigger_slash_if_fraud(
        self, node_address: str, task_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        验证任务结果，如果发现欺诈则标记

        流程：
        1. 判断是否应该抽查此任务
        2. 重新执行任务
        3. 比对结果
        4. 如果欺诈，更新数据库标记

        返回的fraud证据可传递给blockchain.py中的合约交互函数
        触发链上slash操作

        参数:
            node_address: 节点地址
            task_id: 任务ID
        返回:
            (是否欺诈, 证据描述字符串)
        """
        # 步骤1：检查是否需要验证
        if not self.should_validate(task_id):
            return False, None

        # 步骤2：重新执行并获取哈希
        new_hash = self.rerun_task(task_id)
        if new_hash is None:
            return False, None

        # 步骤3：获取原始哈希
        record = (
            self.db.query(TaskRecord)
            .filter(TaskRecord.onchain_task_id == task_id)
            .first()
        )
        if not record or not record.result_hash:
            # 任务记录不完整，无法验证
            return False, None

        # 步骤4：比对
        if not self.compare_results(record.result_hash, new_hash):
            # 检测到欺诈！更新数据库标记
            reason = (
                f"结果验证失败：任务#{task_id}，"
                f"原始哈希={record.result_hash}，"
                f"验证哈希={new_hash}"
            )

            # 更新任务记录状态
            record.was_validated = -1  # 标记为验证未通过
            self.db.commit()

            # 更新节点统计
            node = (
                self.db.query(NodeRecord)
                .filter(NodeRecord.address == node_address)
                .first()
            )
            if node:
                node.disputed_tasks += 1
                self.db.commit()

            return True, reason
        else:
            # 验证通过
            record.was_validated = 1  # 标记为验证通过
            self.db.commit()
            return False, None

    def run_batch_validation(self) -> list:
        """
        批量抽查最近完成的任务

        在定时任务中调用（例如每小时运行一次）
        遍历最近完成的、尚未被验证的任务，按抽查率进行验证

        返回发现的欺诈任务列表，供调用方触发链上slash

        返回:
            list[dict]: 欺诈任务列表 [{"node_address": "0x...", "task_id": 1, "reason": "..."}, ...]
        """
        # 查询最近完成但未验证的任务
        recent_tasks = (
            self.db.query(TaskRecord)
            .filter(
                TaskRecord.status == "completed",
                TaskRecord.was_validated == 0,  # 尚未验证
            )
            .order_by(TaskRecord.completed_at.desc())
            .limit(50)  # 每次最多验证50个
            .all()
        )

        fraud_cases = []
        for task in recent_tasks:
            is_fraud, reason = self.trigger_slash_if_fraud(
                task.node_address, task.onchain_task_id
            )
            if is_fraud:
                fraud_cases.append({
                    "node_address": task.node_address,
                    "task_id": task.onchain_task_id,
                    "reason": reason,
                })

        return fraud_cases
