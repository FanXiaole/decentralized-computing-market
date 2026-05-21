"""
FastAPI 依赖注入模块

使用FastAPI的Depends机制管理共享资源：
- 数据库会话
- 区块链客户端
- 信誉评分器

每个请求自动获取和释放资源
"""

import os
from typing import Generator

from sqlalchemy.orm import Session
from dotenv import load_dotenv

from ..reputation.models import init_database
from .blockchain import get_blockchain_client

load_dotenv()

# ==================== 数据库初始化 ====================

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./decentai.db")

# 全局引擎和会话工厂（应用启动时创建）
_engine, _SessionLocal = init_database(DATABASE_URL)


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话（FastAPI依赖注入）

    每个请求创建一个新会话，请求结束后自动关闭
    防止会话泄漏和连接池耗尽

    使用方式：
        @router.get("/path")
        async def handler(db: Session = Depends(get_db)):
            ...
    """
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_blockchain():
    """
    获取区块链客户端单例（FastAPI依赖注入）

    所有请求共享同一个Web3连接
    """
    return get_blockchain_client()


def get_scorer(db: Session = None):
    """
    获取信誉评分器实例（FastAPI依赖注入）

    如果未传入db，创建一个新的评分器但不关联数据库

    使用方式：
        @router.get("/score")
        async def handler(scorer = Depends(get_scorer)):
            score = scorer.get_final_score("0x...")
    """
    from ..reputation.scorer import ReputationScorer
    return ReputationScorer(db) if db else None
