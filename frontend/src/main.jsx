/**
 * DecentAI Compute Market — 前端入口文件
 *
 * 配置：
 * - RainbowKit + wagmi 钱包连接
 * - React Router 路由
 * - 查询客户端 (TanStack Query)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, hardhat } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import App from './App.jsx';

// 配置wagmi支持的网络
const config = getDefaultConfig({
  appName: 'DecentAI Compute Market',
  projectId: 'decentai-compute-market',
  chains: [sepolia, hardhat, mainnet],
  // Alchemy或Infura RPC（从环境变量读取）
  transports: {},
});

// TanStack Query客户端（RainbowKit依赖）
const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#00D4FF',
            accentColorForeground: '#0A0F1E',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
