/**
 * WalletConnect — 钱包连接组件
 *
 * 使用 wagmi hooks 直接管理钱包连接
 * 支持 MetaMask 等浏览器注入钱包
 */

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { hardhat, sepolia } from 'wagmi/chains';

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // 连接 MetaMask 钱包
  const connectWallet = () => {
    connect({ connector: injected() });
  };

  // 断开钱包连接
  const disconnectWallet = () => {
    disconnect();
  };

  // 切换到 Sepolia 测试网
  const switchToSepolia = () => {
    switchChain({ chainId: sepolia.id });
  };

  // 切换到 Hardhat 本地网络
  const switchToHardhat = () => {
    switchChain({ chainId: hardhat.id });
  };

  if (!isConnected) {
    return (
      <button onClick={connectWallet} className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
        连接钱包
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      {/* 网络切换 */}
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <button
          onClick={switchToHardhat}
          className="btn-secondary"
          style={{
            fontSize: '0.7rem',
            padding: '0.3rem 0.5rem',
            opacity: chainId === hardhat.id ? 1 : 0.5,
          }}
        >
          Hardhat
        </button>
        <button
          onClick={switchToSepolia}
          className="btn-secondary"
          style={{
            fontSize: '0.7rem',
            padding: '0.3rem 0.5rem',
            opacity: chainId === sepolia.id ? 1 : 0.5,
          }}
        >
          Sepolia
        </button>
      </div>

      {/* 账户信息 + 断开按钮 */}
      <div className="glass-card" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.75rem',
        cursor: 'pointer',
        fontSize: '0.8rem',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00FF88' }} />
        <span className="data-font" style={{ fontSize: '0.75rem' }}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={disconnectWallet}
          style={{
            background: 'none', border: 'none', color: 'var(--accent-red)',
            cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem',
          }}
        >
          断开
        </button>
      </div>
    </div>
  );
}
