# DecentAI Compute Market — Python Backend Dockerfile
# 用于部署到 Railway / Render / AWS ECS

FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖（编译某些Python包需要）
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
