/**
 * useWallet — 钱包状态管理Hook
 *
 * 封装wagmi的useAccount，提供统一的钱包连接状态
 * 前端通过此Hook获取当前账户、链ID、连接状态
 */

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // 连接MetaMask钱包
  const connectWallet = async () => {
    try {
      connect({ connector: injected() });
    } catch (error) {
      console.error('钱包连接失败:', error);
    }
  };

  // 断开钱包连接
  const disconnectWallet = () => {
    disconnect();
  };

  return {
    address,
    isConnected,
    chainId,
    connectWallet,
    disconnectWallet,
    // 快捷查询：是否为Sepolia测试网
    isSepolia: chainId === 11155111,
    // 快捷查询：是否为本地Hardhat网络
    isLocalhost: chainId === 31337,
  };
}
