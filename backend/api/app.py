"""
DecentAI Compute Market — FastAPI 主应用入口

启动方式：
    uvicorn backend.api.app:app --reload --host 0.0.0.0 --port 8000

启动后访问:
    - API文档 (Swagger): http://localhost:8000/docs
    - API文档 (ReDoc): http://localhost:8000/redoc
    - 健康检查: http://localhost:8000/health
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import nodes, tasks, reputation

# ==================== 应用配置 ====================

app = FastAPI(
    title="DecentAI Compute Market API",
    description="""
    ## 去中心化AI算力租赁平台 — 后端API

    ### 核心功能
    - **节点管理**: GPU节点的注册、查询、信誉评分
    - **任务管理**: AI算力任务的发布、接单、验证
    - **信誉系统**: 多因子加权信誉评分算法（完成率 + 争议惩罚 + 响应速度 + 成熟度）
    - **区块链交互**: 通过Web3.py与以太坊智能合约交互

    ### 技术架构
    - FastAPI + SQLAlchemy + Web3.py
    - 链上数据（合约）+ 链下数据（数据库）混合存储
    - Oracle模式：后端计算信誉分，写入链上

    ### 汇报亮点
    1. **经济博弈代替ZK证明**：用质押+抽查+重罚保证计算可信
    2. **加权时间衰减信誉模型**：4分量复合评分，近期行为权重更高
    3. **过度担保机制**：150%质押率确保作恶成本远大于收益
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ==================== CORS中间件配置 ====================

# 允许前端跨域请求（开发环境允许所有来源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite开发服务器
        "http://localhost:3000",  # 备用端口
        "https://*.vercel.app",   # Vercel部署
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 注册路由 ====================

app.include_router(nodes.router)
app.include_router(tasks.router)
app.include_router(reputation.router)


# ==================== 基础端点 ====================

@app.get("/health")
async def health_check():
    """
    健康检查端点

    返回API服务状态，用于监控和负载均衡器检查
    """
    return {
        "status": "healthy",
        "service": "DecentAI Compute Market API",
        "version": "1.0.0",
    }


@app.get("/")
async def root():
    """
    API根路径

    返回基本信息和文档链接
    """
    return {
        "message": "欢迎使用 DecentAI Compute Market API",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "nodes": "/api/nodes",
            "tasks": "/api/tasks",
            "reputation": "/api/reputation/{address}/history",
            "market_stats": "/api/market/stats",
            "health": "/health",
        },
    }
