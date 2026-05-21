"""
DecentAI Compute Market — 数据模型定义

设计思路：
- 使用SQLAlchemy ORM管理链下数据（任务记录、信誉历史）
- 链上数据（质押余额、当前信誉分）通过Web3.py从合约读取
- 链下数据库存储历史记录和计算中间结果
- 这种"链上权威数据 + 链下辅助数据"的模式兼顾去中心化和性能

数据存储分工：
┌─────────────────┬──────────────────────────────┐
│ 链上 (合约存储)   │ 链下 (SQLite/PostgreSQL)      │
├─────────────────┼──────────────────────────────┤
│ 当前质押余额      │ 历史任务执行记录               │
│ 当前信誉分        │ 信誉分历史变化                 │
│ 任务基本信息      │ 节点响应时间统计               │
│ 节点信誉档案      │ 评分分量明细                   │
└─────────────────┴──────────────────────────────┘
"""

from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Integer, Float,
    DateTime, JSON, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

Base = declarative_base()


class NodeRecord(Base):
    """
    节点链下补充数据表

    存储那些不需要上链的统计信息和历史数据
    链上ReputationOracle只存当前分数，这里存储计算过程
    """
    __tablename__ = "nodes"

    # 节点以太坊地址（主键，与链上地址对应）
    address = Column(String(42), primary_key=True)

    # 当前综合信誉分（与链上同步的快照值）
    current_score = Column(Float, default=0.0)

    # 任务统计
    total_tasks = Column(Integer, default=0)       # 总接收任务数
    completed_tasks = Column(Integer, default=0)   # 成功完成任务数
    disputed_tasks = Column(Integer, default=0)    # 被争议任务数

    # 性能指标（用于计算响应速度分量）
    avg_response_time = Column(Float, default=0.0)  # 平均响应时间（秒）

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联：该节点执行的所有任务记录
    task_records = relationship("TaskRecord", back_populates="node")

    def to_dict(self):
        """序列化为前端可用的字典"""
        return {
            "address": self.address,
            "current_score": self.current_score,
            "total_tasks": self.total_tasks,
            "completed_tasks": self.completed_tasks,
            "disputed_tasks": self.disputed_tasks,
            "avg_response_time": self.avg_response_time,
            "completion_rate": (
                self.completed_tasks / self.total_tasks
                if self.total_tasks > 0 else 0
            ),
        }


class TaskRecord(Base):
    """
    任务执行记录表

    存储链下补充信息，链上ComputeMarket合约存储任务基本状态
    这里存储结果验证、响应时间等后端计算的中间数据
    """
    __tablename__ = "task_records"

    # 自增主键
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 对应的链上任务ID（关联ComputeMarket合约的taskId）
    onchain_task_id = Column(Integer, nullable=False)

    # 执行该任务的节点地址
    node_address = Column(String(42), ForeignKey("nodes.address"), nullable=False)

    # 任务状态快照
    status = Column(String(20), default="pending")  # pending/running/completed/disputed

    # 计算结果的哈希值（与链上对应，用于抽查比对）
    result_hash = Column(String(66), default="")

    # 节点响应时间（秒），从接单到提交的时间差
    response_time = Column(Float, default=0.0)

    # 是否被抽查验证过
    was_validated = Column(Integer, default=0)  # 0=未抽查, 1=已抽查通过, -1=抽查未通过

    # 时间戳
    accepted_at = Column(DateTime, nullable=True)   # 接单时间
    submitted_at = Column(DateTime, nullable=True)  # 提交时间
    completed_at = Column(DateTime, nullable=True)  # 完成时间

    # 关联到节点记录
    node = relationship("NodeRecord", back_populates="task_records")


class ScoreHistory(Base):
    """
    信誉分变化历史表

    每次后端更新节点信誉分时记录一次
    用于前端展示信誉分变化趋势图
    """
    __tablename__ = "score_history"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 节点地址
    node_address = Column(String(42), nullable=False, index=True)

    # 综合分数（0-100）
    score = Column(Float, nullable=False)

    # 各分量明细（JSON格式存储，灵活扩展）
    # 格式: {"completion":85,"dispute":90,"speed":70,"maturity":60}
    components_breakdown = Column(JSON, nullable=True)

    # 评分时间戳
    timestamp = Column(DateTime, default=datetime.utcnow)


def init_database(database_url: str = "sqlite:///./decentai.db"):
    """
    初始化数据库连接和表结构

    参数:
        database_url: SQLAlchemy连接字符串
    返回:
        engine, SessionLocal
    """
    # connect_args仅SQLite需要（多线程访问）
    connect_args = {"check_same_thread": False} if "sqlite" in database_url else {}

    engine = create_engine(database_url, connect_args=connect_args, echo=False)
    Base.metadata.create_all(bind=engine)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    return engine, SessionLocal
