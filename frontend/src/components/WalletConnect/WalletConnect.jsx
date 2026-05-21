/**
 * WalletConnect — 钱包连接组件
 *
 * 使用RainbowKit的ConnectButton提供多钱包连接支持
 * 包含MetaMask、WalletConnect、Coinbase Wallet等选项
 */

import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

export default function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account, chain, openAccountModal, openChainModal,
        openConnectModal, mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && { 'aria-hidden': true })}
            style={{ display: 'inline-block' }}
          >
            {(() => {
              if (!connected) {
                return (
                  <button onClick={openConnectModal} className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
                    连接钱包
                  </button>
                );
              }

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* 链切换按钮 */}
                  <button
                    onClick={openChainModal}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  >
                    {chain.name}
                  </button>

                  {/* 账户按钮 */}
                  <button
                    onClick={openAccountModal}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#00FF88',
                      }}
                    />
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
