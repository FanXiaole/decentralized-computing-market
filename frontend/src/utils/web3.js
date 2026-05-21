/**
 * Web3工具函数
 * 提供合约ABI导入、地址配置、Provider/Signer获取等通用功能
 *
 * 使用方式：
 *   import { getProvider, getMarketContract, CONTRACTS } from '../utils/web3';
 *   const provider = getProvider();
 *   const market = getMarketContract(provider);
 */

import { ethers } from 'ethers';

// ========== 合约地址配置 ==========
// 从环境变量读取，未配置时使用本地默认地址（开发用）

export const CONTRACTS = {
  token: import.meta.env.VITE_CONTRACT_ADDRESS_TOKEN || '',
  stakingManager: import.meta.env.VITE_CONTRACT_ADDRESS_STAKING_MANAGER || '',
  reputationOracle: import.meta.env.VITE_CONTRACT_ADDRESS_REPUTATION_ORACLE || '',
  computeMarket: import.meta.env.VITE_CONTRACT_ADDRESS_COMPUTE_MARKET || '',
};

// ========== 合约ABI（最小接口定义） ==========
// 只包含前端需要调用的函数ABI

export const COMPUTE_MARKET_ABI = [
  // 写操作
  'function postTask(string description, uint256 reward, uint256 deadline, uint8 minReputation) external returns (uint256)',
  'function acceptTask(uint256 taskId) external',
  'function submitResult(uint256 taskId, bytes32 resultHash) external',
  'function confirmResult(uint256 taskId) external',
  'function disputeResult(uint256 taskId, string reason) external',
  // 读操作
  'function getTask(uint256 taskId) external view returns (tuple(address poster, address node, uint8 status, uint96 reward, uint256 deadline, uint8 minReputation, bytes32 resultHash, string description))',
  'function getTaskCount() external view returns (uint256)',
  'function platformFeeRate() external view returns (uint16)',
  'function collateralRate() external view returns (uint16)',
  // 事件
  'event TaskPosted(uint256 indexed taskId, address indexed poster, uint256 reward, uint8 minReputation, uint256 deadline)',
  'event TaskAccepted(uint256 indexed taskId, address indexed node)',
  'event ResultSubmitted(uint256 indexed taskId, address indexed node, bytes32 resultHash)',
  'event PaymentReleased(uint256 indexed taskId, address indexed node, uint256 nodeAmount, uint256 platformFee)',
  'event StakeSlashed(address indexed node, uint256 amount, string reason)',
];

export const STAKING_MANAGER_ABI = [
  'function stake(uint256 amount) external',
  'function unstake(uint256 amount) external',
  'function getStakeBalance(address node) external view returns (uint256)',
  'function isEligible(address node, uint256 requiredStake) external view returns (bool)',
  'event Staked(address indexed node, uint256 amount)',
  'event Unstaked(address indexed node, uint256 amount)',
];

export const REPUTATION_ORACLE_ABI = [
  'function getScore(address node) external view returns (uint8)',
  'function getHistory(address node) external view returns (tuple(uint8 score, uint64 timestamp, string breakdown)[])',
  'function isQualified(address node, uint8 minScore) external view returns (bool)',
  'event ScoreUpdated(address indexed node, uint8 oldScore, uint8 newScore, string breakdown)',
];

export const TOKEN_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// ========== Provider工厂 ==========

/**
 * 获取Ethers Provider
 * 优先级：window.ethereum (MetaMask) > 环境变量RPC URL > 本地默认
 */
export function getProvider() {
  if (window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  // 回退到RPC URL
  const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * 获取Signer（需要用户已连接钱包）
 * 调用合约写操作时必须使用Signer
 */
export async function getSigner() {
  const provider = getProvider();
  return await provider.getSigner();
}

// ========== 合约实例工厂 ==========

export function getMarketContract(providerOrSigner) {
  if (!CONTRACTS.computeMarket) return null;
  return new ethers.Contract(CONTRACTS.computeMarket, COMPUTE_MARKET_ABI, providerOrSigner);
}

export function getStakingContract(providerOrSigner) {
  if (!CONTRACTS.stakingManager) return null;
  return new ethers.Contract(CONTRACTS.stakingManager, STAKING_MANAGER_ABI, providerOrSigner);
}

export function getReputationContract(providerOrSigner) {
  if (!CONTRACTS.reputationOracle) return null;
  return new ethers.Contract(CONTRACTS.reputationOracle, REPUTATION_ORACLE_ABI, providerOrSigner);
}

export function getTokenContract(providerOrSigner) {
  if (!CONTRACTS.token) return null;
  return new ethers.Contract(CONTRACTS.token, TOKEN_ABI, providerOrSigner);
}

// ========== 便捷检查 ==========

export function isContractsConfigured() {
  return !!CONTRACTS.computeMarket && !!CONTRACTS.stakingManager && !!CONTRACTS.token;
}
