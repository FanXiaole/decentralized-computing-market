"""
DecentAI Compute Market — 信誉评分核心算法

这是整个项目最重要的模块，实现了加权多因子信誉评分模型。

=============================================================
算法设计理念（汇报时重点讲这个）
=============================================================

[汇报亮点] 加权移动平均 + 时间衰减的复合信誉模型

1. **多因子综合评分**：不只看完成率，而是从4个维度综合评估
   - 完成率（40%）：基础指标，节点是否靠谱
   - 争议惩罚（30%）：关键负面指标，直接反映作恶倾向
   - 响应速度（20%）：用户体验指标，优质节点应快速响应
   - 任务量成熟度（10%）：防止新节点“刷高分”后作恶

2. **时间衰减加权**：近期行为权重更高
   - 类比：信用评分中的"最近违约"比"5年前违约"更严重
   - 实现：指数衰减函数，半衰期约30天
   - [汇报亮点] 这给了节点"改过自新"的机会：过去犯过错不会永久标记

3. **任务量因子**：防止Sybil攻击
   - 如果只看完成率，完成1个任务就可以拿满分
   - 引入sigmoid成熟度曲线：完成10个任务后才达到80%成熟度
   - [汇报亮点] 类比Eigenlayer的节点成熟度模型

评分公式：
总分 = completion_rate × 0.4
     + dispute_penalty  × 0.3
     + response_speed   × 0.2
     + maturity_factor  × 0.1

每个分量都是0-100的归一化值。
"""

import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import NodeRecord, TaskRecord, ScoreHistory


class ReputationScorer:
    """
    节点信誉评分器

    核心职责：
    - 从数据库读取节点的历史任务记录
    - 计算四个评分分量
    - 加权合成最终信誉分
    - 提供分量明细供前端雷达图展示

    使用示例：
        scorer = ReputationScorer(db_session)
        score = scorer.get_final_score("0x1234...")
        breakdown = scorer.get_score_breakdown("0x1234...")
    """

    # 权重配置（可调参数）
    WEIGHTS = {
        "completion": 0.4,     # 完成率：最重要的基础指标
        "dispute": 0.3,        # 争议惩罚：关键负面指标
        "speed": 0.2,          # 响应速度：用户体验
        "maturity": 0.1,       # 任务量成熟度：防Sybil
    }

    # 时间衰减半衰期（天）
    # 30天前的任务权重只有最近任务的一半
    DECAY_HALF_LIFE = 30

    # 成熟度曲线的中点（完成多少个任务后达到50%成熟度）
    MATURITY_MIDPOINT = 5

    def __init__(self, db: Session):
        """
        初始化评分器

        参数:
            db: SQLAlchemy数据库会话，用于查询历史任务记录
        """
        self.db = db

    # ==================== 分量计算 ====================

    def calculate_completion_rate(self, node_address: str) -> float:
        """
        计算任务完成率（0-100分）

        算法：
        - 统计该节点的所有任务记录
        - completion_rate = 完成任务数 / 总任务数 × 100
        - 加入时间衰减：近期完成的任务权重更高
        - 如果没有任何任务记录，返回0（而非100，避免新节点默认高分）

        [汇报亮点] 为什么新节点不是100分？
        - 如果新节点默认100分，攻击者可创建新地址作恶
        - 新节点从0分开始，需要通过诚实行为积累信誉
        - 这是游戏设计中的"冷启动问题"标准解决方案

        参数:
            node_address: 节点以太坊地址
        返回:
            float: 0-100之间的完成率分数
        """
        # 查询该节点的所有任务记录
        records = (
            self.db.query(TaskRecord)
            .filter(TaskRecord.node_address == node_address)
            .all()
        )

        if not records:
            return 0.0  # 新节点无历史，不给默认分

        total_weight = 0.0
        completed_weight = 0.0
        now = datetime.utcnow()

        for record in records:
            # 计算时间衰减权重
            # 使用指数衰减: weight = exp(-ln(2) * age / half_life)
            if record.completed_at:
                age_days = (now - record.completed_at).days
            elif record.submitted_at:
                age_days = (now - record.submitted_at).days
            else:
                age_days = (now - record.accepted_at).days if record.accepted_at else 30

            # 确保age_days非负（防止未来时间戳）
            age_days = max(0, age_days)

            # 指数衰减：decay = 2^(-age / half_life)
            decay = math.pow(2, -age_days / self.DECAY_HALF_LIFE)

            total_weight += decay

            # 成功完成的任务
            if record.status == "completed" and record.was_validated >= 0:
                completed_weight += decay

        if total_weight == 0:
            return 0.0

        # 完成率 = 加权完成数 / 加权总数 × 100
        return min(100.0, (completed_weight / total_weight) * 100.0)

    def calculate_dispute_penalty(self, node_address: str) -> float:
        """
        计算争议惩罚分数（0-100分）

        算法：
        - 100分表示从未被争议，0分表示频繁被争议
        - dispute_rate = 被争议任务数 / 总任务数
        - 惩罚 = dispute_rate × 100（从100分中扣除）
        - 同样加入时间衰减，近期争议惩罚更重

        设计理由：
        - 争议是最严重的负面信号，代表节点可能作恶
        - 即使只有1次争议，也会显著影响分数
        - [汇报亮点] 快速下降、缓慢恢复：作恶惩罚是非对称的
          信任需要长时间建立，但可以在瞬间崩塌

        参数:
            node_address: 节点以太坊地址
        返回:
            float: 0-100之间的争议惩罚分数（100=无争议）
        """
        records = (
            self.db.query(TaskRecord)
            .filter(TaskRecord.node_address == node_address)
            .all()
        )

        if not records:
            return 100.0  # 新节点无争议记录，给满分

        total_weight = 0.0
        disputed_weight = 0.0
        now = datetime.utcnow()

        for record in records:
            if record.completed_at:
                age_days = (now - record.completed_at).days
            elif record.submitted_at:
                age_days = (now - record.submitted_at).days
            else:
                age_days = 30

            age_days = max(0, age_days)
            decay = math.pow(2, -age_days / self.DECAY_HALF_LIFE)

            total_weight += decay

            # 被争议的任务
            if record.status == "disputed":
                disputed_weight += decay

        if total_weight == 0:
            return 100.0

        # 争议率 = 加权争议数 / 加权总数
        dispute_rate = disputed_weight / total_weight

        # 惩罚力度：争议率每增加1%，扣2分（非线性惩罚）
        # 这样1次争议在有10个任务的节点上扣20分
        # 这是为了形成强威慑：不要抱侥幸心理
        penalty = dispute_rate * 200  # 2倍速惩罚

        return max(0.0, 100.0 - min(100.0, penalty))

    def calculate_response_speed_score(self, node_address: str) -> float:
        """
        计算响应速度分数（0-100分）

        算法：
        - 计算节点的加权平均响应时间（接单→提交的时间差）
        - 响应时间越短，分数越高
        - 使用指数映射：分数 = 100 × exp(-响应时间 / 基准时间)

        基准时间设定：
        - AI训练任务通常数小时到数天
        - 因此基准时间设为24小时（86400秒）
        - 1小时内完成 → 95分
        - 24小时内完成 → 37分
        - 3天完成 → 5分

        [汇报亮点] 为什么用指数衰减而不是线性映射？
        - 响应时间的分布是长尾的（大部分任务在几小时内，少数需要数天）
        - 指数映射能更好地区分"快"和"很快"（1h vs 2h的差异应该在分数上体现）
        - 线性映射下，1h和10h的区别不够显著

        参数:
            node_address: 节点以太坊地址
        返回:
            float: 0-100之间的响应速度分数
        """
        records = (
            self.db.query(TaskRecord)
            .filter(
                TaskRecord.node_address == node_address,
                TaskRecord.response_time > 0  # 只统计有响应时间的记录
            )
            .all()
        )

        if not records:
            return 0.0  # 无数据，不给默认分

        # 加权平均响应时间（越近期的任务权重越高）
        total_weight = 0.0
        weighted_time = 0.0
        now = datetime.utcnow()

        for record in records:
            if record.completed_at:
                age_days = (now - record.completed_at).days
            else:
                age_days = 30

            age_days = max(0, age_days)
            decay = math.pow(2, -age_days / self.DECAY_HALF_LIFE)

            total_weight += decay
            weighted_time += record.response_time * decay

        if total_weight == 0:
            return 0.0

        avg_response_time = weighted_time / total_weight

        # 基准时间：24小时 = 86400秒
        # 使用指数衰减：分数 = 100 * exp(-响应时间 / 基准时间)
        BASE_TIME = 86400  # 24小时
        score = 100.0 * math.exp(-avg_response_time / BASE_TIME)

        return round(min(100.0, score), 2)

    def calculate_maturity_factor(self, node_address: str) -> float:
        """
        计算任务量成熟度（0-100分）

        算法：
        - 使用sigmoid函数映射完成任务数到成熟度分数
        - sigmoid公式: 100 / (1 + exp(-(n - midpoint) / scale))
        - midpoint=5: 完成5个任务达到50%成熟度
        - scale=2: 控制曲线陡峭程度
        - 完成10个任务达到约92%成熟度
        - 完成20个任务达到约99%成熟度

        设计理由（非常重要，汇报必讲）：
        [汇报亮点] 防止"刷分攻击"（Reputation Farming）
        - 如果只按完成率评分，节点可以自己给自己发100个小额任务，
          快速刷满完成率，然后接高额任务进行欺诈
        - 成熟度因子让新节点在完成足够多"真实任务"之前，信誉上限被压制
        - 配合其他分量，攻击者需要大量真实任务才能刷高分，成本极高
        - 类比：Eigenlayer的Operator Experience、Uber的新手保护期

        参数:
            node_address: 节点以太坊地址
        返回:
            float: 0-100之间的成熟度分数
        """
        # 统计该节点的总任务数
        total = (
            self.db.query(TaskRecord)
            .filter(TaskRecord.node_address == node_address)
            .count()
        )

        if total == 0:
            return 0.0

        # Sigmoid函数: 100 / (1 + e^(-(n - midpoint) / scale))
        midpoint = self.MATURITY_MIDPOINT  # 5个任务=50%成熟度
        scale = 2.0  # 控制曲线陡峭度

        score = 100.0 / (1.0 + math.exp(-(total - midpoint) / scale))

        return round(min(100.0, score), 2)

    # ==================== 综合评分 ====================

    def get_final_score(self, node_address: str) -> float:
        """
        计算节点综合信誉分（满分100分）

        加权公式：
        total = completion × 0.4 + dispute × 0.3 + speed × 0.2 + maturity × 0.1

        设计理由（权重分配逻辑）：
        - completion(0.4)最高权重：完成任务是节点最基本职责
        - dispute(0.3)次高：作恶是最大风险，需要强力惩罚
        - speed(0.2)：重要但不是决定性因素
        - maturity(0.1)：补充因子，防止新节点刷分

        参数:
            node_address: 节点以太坊地址
        返回:
            float: 0-100之间的综合信誉分
        """
        # 计算四个分量
        completion = self.calculate_completion_rate(node_address)
        dispute = self.calculate_dispute_penalty(node_address)
        speed = self.calculate_response_speed_score(node_address)
        maturity = self.calculate_maturity_factor(node_address)

        # 加权合成
        final = (
            completion * self.WEIGHTS["completion"]
            + dispute * self.WEIGHTS["dispute"]
            + speed * self.WEIGHTS["speed"]
            + maturity * self.WEIGHTS["maturity"]
        )

        return round(min(100.0, max(0.0, final)), 2)

    def get_score_breakdown(self, node_address: str) -> dict:
        """
        获取信誉分各分量明细（供前端雷达图展示）

        返回格式：
        {
            "overall": 85.5,
            "components": {
                "completion_rate": { "score": 90.0, "weight": 0.4, "label": "完成率" },
                "dispute_penalty": { "score": 95.0, "weight": 0.3, "label": "争议记录" },
                "response_speed": { "score": 70.0, "weight": 0.2, "label": "响应速度" },
                "maturity": { "score": 60.0, "weight": 0.1, "label": "任务量成熟度" }
            },
            "node_address": "0x...",
            "total_tasks": 25
        }

        参数:
            node_address: 节点以太坊地址
        返回:
            dict: 分量明细字典
        """
        completion = self.calculate_completion_rate(node_address)
        dispute = self.calculate_dispute_penalty(node_address)
        speed = self.calculate_response_speed_score(node_address)
        maturity = self.calculate_maturity_factor(node_address)

        final = self.get_final_score(node_address)

        # 查询任务统计
        node = (
            self.db.query(NodeRecord)
            .filter(NodeRecord.address == node_address)
            .first()
        )
        total_tasks = node.total_tasks if node else 0

        return {
            "overall": final,
            "components": {
                "completion_rate": {
                    "score": round(completion, 2),
                    "weight": self.WEIGHTS["completion"],
                    "label": "完成率",
                },
                "dispute_penalty": {
                    "score": round(dispute, 2),
                    "weight": self.WEIGHTS["dispute"],
                    "label": "争议记录",
                },
                "response_speed": {
                    "score": round(speed, 2),
                    "weight": self.WEIGHTS["speed"],
                    "label": "响应速度",
                },
                "maturity": {
                    "score": round(maturity, 2),
                    "weight": self.WEIGHTS["maturity"],
                    "label": "任务量成熟度",
                },
            },
            "node_address": node_address,
            "total_tasks": total_tasks,
        }

    def update_and_persist_score(
        self, node_address: str
    ) -> Tuple[float, dict]:
        """
        重新计算并持久化节点信誉分

        计算信誉分后：
        1. 更新/创建NodeRecord
        2. 记录ScoreHistory
        3. 返回新的分数和分量明细

        这个函数在以下时机被调用：
        - 任务完成确认后
        - 争议解决后
        - 定时批量更新（cron job）

        参数:
            node_address: 节点地址
        返回:
            (final_score, breakdown_dict)
        """
        breakdown = self.get_score_breakdown(node_address)
        final_score = breakdown["overall"]

        # 更新NodeRecord
        node = (
            self.db.query(NodeRecord)
            .filter(NodeRecord.address == node_address)
            .first()
        )
        if not node:
            node = NodeRecord(address=node_address)
            self.db.add(node)

        node.current_score = final_score
        node.updated_at = datetime.utcnow()

        # 记录历史
        history = ScoreHistory(
            node_address=node_address,
            score=final_score,
            components_breakdown=breakdown["components"],
            timestamp=datetime.utcnow(),
        )
        self.db.add(history)
        self.db.commit()

        return final_score, breakdown


# ==================== 工具函数 ====================

def get_score_color(score: float) -> str:
    """
    根据信誉分返回对应的显示颜色

    颜色分级逻辑：
    - 90-100: 绿色（优质节点，可以放心使用）
    - 70-89: 蓝色（良好节点，基本可信）
    - 50-69: 橙色（一般节点，需要关注）
    - 0-49: 红色（高风险节点，不建议使用）

    参数:
        score: 0-100的信誉分
    返回:
        str: 十六进制颜色代码
    """
    if score >= 90:
        return "#00FF88"  # 霓虹绿 — 优质
    elif score >= 70:
        return "#00D4FF"  # 电光蓝 — 良好
    elif score >= 50:
        return "#FF8C00"  # 琥珀橙 — 一般
    else:
        return "#FF2D55"  # 赛博红 — 高风险
