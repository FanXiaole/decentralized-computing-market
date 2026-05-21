"""
节点相关API路由

提供GPU计算节点的查询和管理接口
包括节点列表、详情、信誉分查询
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..dependencies import get_db, get_blockchain, get_scorer
from ...reputation.models import NodeRecord
from ...reputation.scorer import ReputationScorer, get_score_color

router = APIRouter(prefix="/api/nodes", tags=["节点管理"])


@router.get("")
async def get_nodes(
    min_score: Optional[float] = Query(None, description="最低信誉分过滤"),
    limit: int = Query(20, ge=1, le=100, description="返回数量上限"),
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取所有节点列表（含信誉分和质押信息）

    从链上读取质押余额，从数据库读取信誉分和任务统计
    合并后返回统一的节点信息

    排序规则：按信誉分降序排列（高分节点优先展示）
    """
    # 从数据库查询所有节点
    query = db.query(NodeRecord)
    if min_score is not None:
        query = query.filter(NodeRecord.current_score >= min_score)
    nodes = query.order_by(NodeRecord.current_score.desc()).limit(limit).all()

    result = []
    for node in nodes:
        # 从链上补充质押余额信息
        stake_wei = blockchain.get_node_stake(node.address)
        onchain_score = blockchain.get_node_reputation(node.address)

        result.append({
            **node.to_dict(),
            "stake_wei": stake_wei,
            "onchain_score": onchain_score,
            "score_color": get_score_color(node.current_score),
        })

    return {
        "total": len(result),
        "nodes": result,
    }


@router.get("/{address}")
async def get_node_detail(
    address: str,
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取单个节点的详细信息

    包含：
    - 基本信息（地址、信誉分）
    - 任务统计（总任务/完成/争议）
    - 链上质押余额
    - 信誉分评级颜色
    """
    node = db.query(NodeRecord).filter(NodeRecord.address == address).first()

    # 即使数据库中没有记录，也从链上获取基本信息
    stake_wei = blockchain.get_node_stake(address)
    onchain_score = blockchain.get_node_reputation(address)

    if not node:
        return {
            "address": address,
            "current_score": onchain_score,
            "total_tasks": 0,
            "completed_tasks": 0,
            "disputed_tasks": 0,
            "stake_wei": stake_wei,
            "onchain_score": onchain_score,
            "score_color": get_score_color(onchain_score),
        }

    return {
        **node.to_dict(),
        "stake_wei": stake_wei,
        "onchain_score": onchain_score,
        "score_color": get_score_color(node.current_score),
    }


@router.get("/{address}/score")
async def get_node_score_breakdown(
    address: str,
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取节点的信誉分详细分解（供前端雷达图展示）

    返回综合分和四个分量的详细分数：
    - completion_rate: 完成率 (权重40%)
    - dispute_penalty: 争议惩罚 (权重30%)
    - response_speed: 响应速度 (权重20%)
    - maturity: 任务量成熟度 (权重10%)

    [汇报亮点] 前端用此数据渲染雷达图，用户可以直观看到节点在各维度的表现
    """
    scorer = ReputationScorer(db)
    breakdown = scorer.get_score_breakdown(address)

    # 从链上补充当前分数
    onchain_score = blockchain.get_node_reputation(address)

    return {
        **breakdown,
        "onchain_score": onchain_score,
        "score_color": get_score_color(breakdown["overall"]),
    }
