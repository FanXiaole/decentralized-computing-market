/**
 * App — 主应用组件
 *
 * 职责：
 * - 顶部导航栏（Logo + 菜单 + 钱包连接）
 * - 路由配置（Home / Market / Dashboard / Profile）
 * - 全局布局结构
 */

import { Routes, Route, Link, useLocation } from 'react-router-dom';
import WalletConnect from './components/WalletConnect';
import Home from './pages/Home';
import Market from './pages/Market';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

const NAV_LINKS = [
  { to: '/', label: '首页' },
  { to: '/market', label: '算力市场' },
  { to: '/dashboard', label: '节点仪表盘' },
  { to: '/profile', label: '信誉档案' },
];

export default function App() {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <nav style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '0 2rem',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10,15,30,0.8)',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          height: '64px',
        }}>
          {/* Logo */}
          <Link to="/" style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span style={{
              fontSize: '1.3rem', fontWeight: 700,
              color: 'var(--accent-blue)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}>
              DecentAI
            </span>
            <span style={{
              fontSize: '0.65rem',
              color: 'var(--text-secondary)',
              fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(0,212,255,0.1)',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
            }}>
              COMPUTE
            </span>
          </Link>

          {/* 导航链接 */}
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  textDecoration: 'none',
                  color: location.pathname === link.to ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  fontWeight: location.pathname === link.to ? 600 : 400,
                  background: location.pathname === link.to ? 'rgba(0,212,255,0.08)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* 钱包连接 */}
            <div style={{ marginLeft: '1rem' }}>
              <WalletConnect />
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
      }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/market" element={<Market />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      {/* 底部 */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
      }}>
        <p>
          DecentAI Compute Market — 去中心化AI算力租赁平台
          {' · '}
          Built with Solidity + Python FastAPI + React + ethers.js
        </p>
        <p style={{ marginTop: '0.35rem', opacity: 0.6 }}>
          Staking + Slashing 经济博弈机制 · 无需ZK证明 · 工业级可落地方案
        </p>
      </footer>
    </div>
  );
}
