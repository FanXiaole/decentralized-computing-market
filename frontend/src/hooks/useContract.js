/**
 * useContract — 智能合约交互Hook
 *
 * 封装与DecentAI Compute Market合约的所有交互逻辑
 * 包括任务发布、接单、提交结果、确认、争议等操作
 *
 * 使用方式：
 *   const { postTask, acceptTask, tasks, loading } = useContract();
 *   await postTask("描述", reward, deadline, minRep);
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  getProvider, getSigner, getMarketContract,
  getStakingContract, getReputationContract, getTokenContract,
  CONTRACTS, isContractsConfigured,
} from '../utils/web3';

export function useContract() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ========== 读取任务列表 ==========

  /**
   * 加载链上任务列表（最新20条）
   * 使用合约的getTasksPaginated方法
   */
  const loadTasks = useCallback(async () => {
    if (!isContractsConfigured()) return;

    setLoading(true);
    try {
      const provider = getProvider();
      const market = getMarketContract(provider);
      if (!market) return;

      const count = await market.getTaskCount();
      const total = Number(count);

      if (total === 0) {
        setTasks([]);
        return;
      }

      // 从最新任务开始加载，最多20条
      const start = Math.max(0, total - 20);
      const countToLoad = total - start;

      // 逐个获取任务（简化版，生产环境用getTasksPaginated）
      const taskList = [];
      for (let i = start + 1; i <= total; i++) {
        try {
          const task = await market.getTask(i);
          taskList.push({
            taskId: i,
            poster: task.poster,
            node: task.node,
            status: Number(task.status),
            reward: task.reward,
            rewardETH: ethers.formatEther(task.reward),
            deadline: Number(task.deadline),
            minReputation: Number(task.minReputation),
            resultHash: task.resultHash,
            description: task.description,
          });
        } catch (e) {
          // 跳过无法加载的任务
        }
      }
      // 最新任务在前
      setTasks(taskList.reverse());
    } catch (err) {
      console.error('加载任务失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 每15秒自动刷新任务列表
  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 15000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  // ========== 写操作 ==========

  /**
   * 发布新任务
   * @param {string} description - 任务描述
   * @param {bigint} rewardWei - 报酬（wei）
   * @param {number} deadline - 截止时间（Unix时间戳秒）
   * @param {number} minReputation - 最低信誉分（0-100）
   */
  const postTask = async (description, rewardWei, deadline, minReputation) => {
    try {
      const signer = await getSigner();
      const market = getMarketContract(signer);
      const token = getTokenContract(signer);
      if (!market || !token) throw new Error('合约未配置');

      // 步骤1：先approve代币给Market合约
      const approveTx = await token.approve(CONTRACTS.computeMarket, rewardWei);
      await approveTx.wait();

      // 步骤2：发布任务
      const tx = await market.postTask(description, rewardWei, deadline, minReputation);
      const receipt = await tx.wait();

      // 刷新任务列表
      await loadTasks();
      return receipt;
    } catch (err) {
      console.error('发布任务失败:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * 节点接受任务
   * @param {number} taskId - 任务ID
   */
  const acceptTask = async (taskId) => {
    try {
      const signer = await getSigner();
      const market = getMarketContract(signer);
      if (!market) throw new Error('合约未配置');

      const tx = await market.acceptTask(taskId);
      const receipt = await tx.wait();
      await loadTasks();
      return receipt;
    } catch (err) {
      console.error('接单失败:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * 提交计算结果
   * @param {number} taskId - 任务ID
   * @param {string} resultData - 结果数据（字符串，将被哈希化）
   */
  const submitResult = async (taskId, resultData) => {
    try {
      const signer = await getSigner();
      const market = getMarketContract(signer);
      if (!market) throw new Error('合约未配置');

      // 将结果数据哈希化（只存哈希，节省Gas）
      const resultHash = ethers.keccak256(ethers.toUtf8Bytes(resultData));
      const tx = await market.submitResult(taskId, resultHash);
      const receipt = await tx.wait();
      await loadTasks();
      return receipt;
    } catch (err) {
      console.error('提交结果失败:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * 需求方确认结果并释放报酬
   * @param {number} taskId - 任务ID
   */
  const confirmResult = async (taskId) => {
    try {
      const signer = await getSigner();
      const market = getMarketContract(signer);
      if (!market) throw new Error('合约未配置');

      const tx = await market.confirmResult(taskId);
      const receipt = await tx.wait();
      await loadTasks();
      return receipt;
    } catch (err) {
      console.error('确认结果失败:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * 需求方发起争议
   * @param {number} taskId - 任务ID
   * @param {string} reason - 争议原因
   */
  const disputeResult = async (taskId, reason) => {
    try {
      const signer = await getSigner();
      const market = getMarketContract(signer);
      if (!market) throw new Error('合约未配置');

      const tx = await market.disputeResult(taskId, reason);
      const receipt = await tx.wait();
      await loadTasks();
      return receipt;
    } catch (err) {
      console.error('发起争议失败:', err);
      setError(err.message);
      throw err;
    }
  };

  // ========== 质押相关 ==========

  /**
   * 节点质押代币
   * @param {bigint} amountWei - 质押金额（wei）
   */
  const stake = async (amountWei) => {
    try {
      const signer = await getSigner();
      const staking = getStakingContract(signer);
      const token = getTokenContract(signer);
      if (!staking || !token) throw new Error('合约未配置');

      // 先approve
      const approveTx = await token.approve(staking.target, amountWei);
      await approveTx.wait();

      // 再stake
      const tx = await staking.stake(amountWei);
      await tx.wait();
      return true;
    } catch (err) {
      console.error('质押失败:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * 节点提取质押
   * @param {bigint} amountWei - 提取金额（wei）
   */
  const unstake = async (amountWei) => {
    try {
      const signer = await getSigner();
      const staking = getStakingContract(signer);
      if (!staking) throw new Error('合约未配置');

      const tx = await staking.unstake(amountWei);
      await tx.wait();
      return true;
    } catch (err) {
      console.error('提取质押失败:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * 查询节点质押余额
   * @param {string} address - 节点地址
   * @returns {bigint} 质押余额（wei）
   */
  const getStakeBalance = async (address) => {
    try {
      const provider = getProvider();
      const staking = getStakingContract(provider);
      if (!staking) return 0n;
      return await staking.getStakeBalance(address);
    } catch (err) {
      console.error('查询质押余额失败:', err);
      return 0n;
    }
  };

  return {
    tasks,
    loading,
    error,
    loadTasks,
    postTask,
    acceptTask,
    submitResult,
    confirmResult,
    disputeResult,
    stake,
    unstake,
    getStakeBalance,
  };
}
