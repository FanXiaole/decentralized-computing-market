/**
 * DecentAI Compute Market — 前端入口文件
 *
 * 配置：
 * - wagmi 钱包连接（支持 MetaMask 等注入钱包）
 * - React Router 路由
 * - TanStack Query 客户端
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { hardhat, sepolia, mainnet } from 'wagmi/chains';
import './index.css';
import App from './App.jsx';

// wagmi 配置：支持 Hardhat 本地网络、Sepolia 测试网、Ethereum 主网
const config = createConfig({
  chains: [hardhat, sepolia, mainnet],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(
      import.meta.env.VITE_RPC_URL ||
        'https://eth-sepolia.g.alchemy.com/v2/demo'
    ),
    [mainnet.id]: http('https://eth.llamarpc.com'),
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
