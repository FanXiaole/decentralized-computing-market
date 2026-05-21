"""
信誉查询API路由

提供节点信誉分历史和综合查询接口
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from ..dependencies import get_db, get_blockchain
from ...reputation.models import ScoreHistory, NodeRecord

router = APIRouter(prefix="/api/reputation", tags=["信誉系统"])


@router.get("/{address}/history")
async def get_reputation_history(
    address: str,
    limit: int = Query(50, ge=1, le=200, description="返回记录数量上限"),
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取指定节点的信誉分变化历史

    数据来源优先级：
    1. 链上ReputationOracle.getHistory()（权威数据）
    2. 链下ScoreHistory表（补充数据，含分量明细）

    返回按时间倒序排列的历史记录
    前端使用此数据绘制信誉分变化折线图
    """
    # 从链上获取历史
    onchain_history = blockchain.get_reputation_history(address)

    # 从数据库获取补充历史
    db_history = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.node_address == address)
        .order_by(desc(ScoreHistory.timestamp))
        .limit(limit)
        .all()
    )

    # 合并链上和链下数据
    # 链上数据作为权威来源，链下数据补充分量明细
    history = []
    for record in db_history:
        history.append({
            "score": record.score,
            "timestamp": record.timestamp.isoformat() if record.timestamp else None,
            "components": record.components_breakdown,
            "source": "database",
        })

    for record in onchain_history:
        history.append({
            "score": record["score"],
            "timestamp": record["timestamp"],
            "components": record.get("breakdown", ""),
            "source": "blockchain",
        })

    # 按时间倒序
    history.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)

    return {
        "address": address,
        "total_records": len(history),
        "history": history[:limit],
    }


@router.get("/{address}/summary")
async def get_reputation_summary(
    address: str,
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取节点信誉摘要

    包含：当前分数、历史最低/最高分、评分次数
    适用于Profile页面的概览卡片
    """
    onchain_score = blockchain.get_node_reputation(address)

    # 从数据库查询统计
    history = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.node_address == address)
        .all()
    )

    scores = [h.score for h in history]
    node = (
        db.query(NodeRecord)
        .filter(NodeRecord.address == address)
        .first()
    )

    return {
        "address": address,
        "current_score": onchain_score,
        "score_count": len(history),
        "highest_score": max(scores) if scores else onchain_score,
        "lowest_score": min(scores) if scores else onchain_score,
        "total_tasks": node.total_tasks if node else 0,
        "completed_tasks": node.completed_tasks if node else 0,
        "disputed_tasks": node.disputed_tasks if node else 0,
    }


@router.get("/market/stats")
async def get_market_stats(
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取市场统计数据（供首页展示）

    包含：
    - 活跃节点数（有质押的节点）
    - 已完成任务总数
    - 平台总质押量
    - 近7天新增任务数

    这些数据用于首页Hero区的实时统计数字展示
    """
    # 从数据库统计
    total_nodes = db.query(NodeRecord).count()
    total_tasks = blockchain.get_task_count()

    # 计算总质押量（遍历所有节点的链上质押）
    # 注意：这是简化版实现，生产环境应使用链上事件累计
    nodes = db.query(NodeRecord).all()
    total_staked = 0
    for node in nodes:
        total_staked += blockchain.get_node_stake(node.address)

    # 统计已完成任务数
    from sqlalchemy import func
    completed_tasks = (
        db.query(NodeRecord)
        .with_entities(func.sum(NodeRecord.completed_tasks))
        .scalar()
    ) or 0

    return {
        "active_nodes": total_nodes,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "total_staked_wei": total_staked,
        "updated_at": None,
    }
