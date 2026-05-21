"""
任务相关API路由

提供算力任务的查询和验证接口
包括任务列表、详情、结果抽样验证
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..dependencies import get_db, get_blockchain
from ...reputation.validator import ResultValidator

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])


@router.get("")
async def get_tasks(
    status: Optional[str] = Query(None, description="按任务状态过滤: Open/InProgress/Completed/Disputed"),
    min_reward: Optional[float] = Query(None, description="最低报酬过滤（ETH）"),
    limit: int = Query(20, ge=1, le=100, description="返回数量上限"),
    blockchain=Depends(get_blockchain),
):
    """
    获取任务列表

    从链上读取任务数据，支持按状态和报酬过滤
    默认返回最新的20个任务
    """
    total = blockchain.get_task_count()
    if total == 0:
        return {"total": 0, "tasks": []}

    tasks = []
    # 从最新的任务开始读取
    start_id = max(1, total - limit + 1)

    for task_id in range(start_id, total + 1):
        task = blockchain.get_task(task_id)
        if task is None:
            continue

        # 状态过滤
        if status and task["status"] != status:
            continue

        # 报酬过滤（链上存的是wei，需要转换比较）
        if min_reward is not None:
            from web3 import Web3
            reward_eth = Web3.from_wei(task["reward_wei"], "ether")
            if float(reward_eth) < min_reward:
                continue

        tasks.append(task)

    return {
        "total": len(tasks),
        "tasks": tasks,
    }


@router.get("/{task_id}")
async def get_task_detail(
    task_id: int,
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    获取指定任务的详细信息

    包含链上状态和链下补充数据（如验证状态）
    """
    task = blockchain.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"任务#{task_id}不存在")

    # 查询链下补充记录
    from ...reputation.models import TaskRecord
    record = (
        db.query(TaskRecord)
        .filter(TaskRecord.onchain_task_id == task_id)
        .first()
    )

    if record:
        task["was_validated"] = record.was_validated
        task["response_time"] = record.response_time

    return task


@router.post("/{task_id}/validate")
async def trigger_task_validation(
    task_id: int,
    db: Session = Depends(get_db),
    blockchain=Depends(get_blockchain),
):
    """
    对指定任务触发结果抽样验证

    流程：
    1. 判断该任务是否应该被抽查（确定性随机）
    2. 重新执行任务并比对结果哈希
    3. 如果发现欺诈，返回欺诈证据（需要后端自动触发链上slash）

    此接口也可被定时任务调用进行批量验证
    """
    validator = ResultValidator(db)

    try:
        is_fraud, reason = validator.trigger_slash_if_fraud(
            node_address="",  # 从任务记录中自动获取
            task_id=task_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"验证失败: {str(e)}")

    return {
        "task_id": task_id,
        "was_validated": True,
        "is_fraud": is_fraud,
        "reason": reason,
        "message": "验证完成，结果一致" if not is_fraud else f"发现欺诈: {reason}",
    }
