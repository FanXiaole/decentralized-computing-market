# DecentAI Compute Market — 去中心化AI算力租赁平台

> **DecentAI Compute Market** is a decentralized AI compute power rental platform that uses **economic game theory (Staking + Slashing)** instead of complex ZK proofs to guarantee computation integrity.

[English](#english) | [中文](#chinese)

---

## English

### Overview

DecentAI Compute Market connects **AI developers** who need GPU compute power with **GPU node operators** who provide it. The platform uses smart contracts to manage task lifecycle, stake collateral, and automatically settle payments — all without trusted third parties.

### Core Innovation

> **Economic game theory replaces ZK proofs for computation verification.**

Instead of using expensive Zero-Knowledge Proofs (which are 100-1000x more computationally expensive than the original computation), we use:
- **Over-collateralization (150%)**: Nodes must stake more than the task reward
- **Random sampling (10%)**: Only 1 in 10 tasks is re-verified
- **Heavy slashing (50%)**: Fraudulent nodes lose half their stake

This is the same approach used by Filecoin and Eigenlayer in production.

### System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    DecentAI Compute Market                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Frontend   │  │   Backend    │  │   Blockchain  │ │
│  │  (React+Vite)│  │ (FastAPI+Py) │  │  (Solidity)   │ │
│  ├──────────────┤  ├──────────────┤  ├───────────────┤ │
│  │ • Home Page  │  │ • Reputation │  │ • Token (ERC20)│ │
│  │ • Market     │──│ • Validator  │──│ • Staking Mgr  │ │
│  │ • Dashboard  │  │ • API Routes │  │ • Reputation   │ │
│  │ • Profile    │  │ • Web3.py    │  │ • Market Core  │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
│        │                  │                  │           │
│   Wagmi/RainbowKit   SQLAlchemy+SQLite   Hardhat+EVM    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.20, OpenZeppelin, Hardhat |
| Backend | Python 3.11, FastAPI, Web3.py, SQLAlchemy |
| Frontend | React 18, Vite, Tailwind CSS, ethers.js v6 |
| Wallet | wagmi + RainbowKit |
| Charts | Recharts |

### Project Structure

```
decentai-compute-market/
├── contracts/                  # Solidity Smart Contracts
│   ├── ComputeMarket.sol       # Core marketplace (task lifecycle, payment)
│   ├── StakingManager.sol      # Node staking management
│   ├── ReputationOracle.sol    # On-chain reputation storage
│   └── DecentAIToken.sol       # Platform ERC-20 token
├── scripts/
│   ├── deploy.js               # Main deployment script
│   └── seed.js                 # Test data initialization
├── test/
│   └── ComputeMarket.test.js   # 41 test cases
├── backend/                    # Python Backend
│   ├── reputation/
│   │   ├── scorer.py           # Reputation scoring algorithm
│   │   ├── validator.py        # Result sampling validator
│   │   └── models.py           # SQLAlchemy data models
│   ├── api/
│   │   ├── app.py              # FastAPI entry point
│   │   ├── dependencies.py     # DI setup
│   │   ├── blockchain.py       # Web3.py integration
│   │   └── routes/
│   │       ├── nodes.py        # Node API endpoints
│   │       ├── tasks.py        # Task API endpoints
│   │       └── reputation.py   # Reputation API endpoints
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/              # Page components
│   │   └── utils/              # Utility functions
│   ├── vercel.json
│   └── .env.example
├── hardhat.config.js
├── package.json
└── README.md
```

### Quick Start

#### Prerequisites

- Node.js >= 18.x
- Python 3.11+
- MetaMask browser extension

#### 1. Clone and Install

```bash
git clone <repo-url>
cd decentai-compute-market
npm install
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..
```

#### 2. Configure Environment

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### 3. Start Local Blockchain

```bash
npx hardhat node
```

#### 4. Deploy Contracts

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract addresses to all `.env` files.

#### 5. Seed Test Data (Optional)

```bash
npx hardhat run scripts/seed.js --network localhost
```

#### 6. Start Backend

```bash
cd backend
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Visit `http://localhost:8000/docs` for the interactive API documentation.

#### 7. Start Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

#### 8. Run Tests

```bash
npx hardhat test
```

### Core Innovation Points (for presentations)

1. **Staking Collateral Design**: 150% over-collateralization ensures fraud is always more costly than honest work
2. **Weighted Reputation Algorithm**: Time-decay weighted scoring with 4 components (completion, dispute, speed, maturity)
3. **Event-Driven Architecture**: Frontend subscribes to on-chain events for real-time updates
4. **Oracle Pattern**: Backend computes complex reputation off-chain, writes results on-chain
5. **Gas Optimization**: Only stores result hashes on-chain, not raw data
6. **Trustless Settlement**: Payments are automatically released by smart contract code

### Deploy to Sepolia Testnet

```bash
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### License

MIT

---

## Chinese

### 项目概述

DecentAI Compute Market（去中心化AI算力租赁平台）连接**AI开发者**（需求方）和**GPU节点**（供给方），通过智能合约实现任务管理、资金托管和自动结算。

### 核心创新

> **用经济博弈机制（Staking + Reputation Slashing）代替复杂的数学证明（ZK Proof）来保证计算可信。**

传统ZK证明的计算开销是原始计算的100-1000倍，而我们使用：
- **150%过度担保**：节点质押金必须超过任务报酬
- **10%随机抽查**：只重新验证十分之一的任务
- **50%重罚**：作恶节点损失一半质押金

对标工业界：Filecoin的罚没机制、Eigenlayer的Slashing设计。

### 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                    DecentAI Compute Market                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   前端 (React) │  │  后端 (Python)│  │  区块链 (Solidity)│ │
│  ├──────────────┤  ├──────────────┤  ├───────────────┤ │
│  │ • 首页       │  │ • 信誉算法    │  │ • 代币合约     │ │
│  │ • 算力市场   │──│ • 结果验证    │──│ • 质押管理     │ │
│  │ • 节点仪表盘 │  │ • REST API   │  │ • 信誉存储     │ │
│  │ • 信誉档案   │  │ • Web3.py    │  │ • 核心市场     │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 智能合约 | Solidity ^0.8.20, OpenZeppelin, Hardhat |
| 后端 | Python 3.11, FastAPI, Web3.py, SQLAlchemy |
| 前端 | React 18, Vite, Tailwind CSS, ethers.js v6 |
| 钱包 | wagmi + RainbowKit |
| 图表 | Recharts |

### 快速开始

#### 环境要求

- Node.js >= 18.x
- Python 3.11+
- MetaMask 浏览器插件

#### 步骤

```bash
# 1. 安装依赖
npm install
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..

# 2. 配置环境变量
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. 启动本地区块链节点
npx hardhat node

# 4. 部署合约
npx hardhat run scripts/deploy.js --network localhost
# 将输出的合约地址填入所有 .env 文件

# 5. 注入测试数据（可选）
npx hardhat run scripts/seed.js --network localhost

# 6. 启动后端
cd backend
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
# API文档: http://localhost:8000/docs

# 7. 启动前端
cd frontend
npm run dev
# 打开 http://localhost:5173
```

### 运行测试

```bash
npx hardhat test
# 41 passing tests
```

### 汇报技术亮点

1. **Staking Collateral Design**：150%过度担保，确保作恶成本远大于收益
2. **Weighted Reputation Algorithm**：时间衰减的4分量加权信誉评分模型
3. **Event-Driven Architecture**：前端通过合约事件实时更新，无需轮询
4. **Oracle Pattern**：链下复杂计算 + 链上结果存储，兼顾效率和去中心化
5. **Gas Optimization**：链上只存结果哈希，原始数据走IPFS
6. **Trustless Settlement**：智能合约自动执行支付，平台无法干预

### 验收标准

- [x] `npx hardhat test` 通过所有41个合约测试
- [x] `npx hardhat run scripts/deploy.js --network localhost` 成功部署
- [x] `uvicorn backend.api.app:app --reload` 成功启动后端
- [x] `cd frontend && npm run build` 前端构建成功
- [x] 完整流程：发布任务 → 接单 → 提交 → 确认 → 信誉更新

---

*Built with Solidity + Hardhat + Python FastAPI + React + ethers.js*
