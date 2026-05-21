/**
 * StakingPanel — 质押管理面板组件
 *
 * 允许GPU节点存入/提取质押代币
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { formatETH } from '../utils/format';
import { getProvider, getStakingContract, getTokenContract, CONTRACTS } from '../utils/web3';

export default function StakingPanel({ address, onStakeComplete }) {
  const [stakeBalance, setStakeBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBalances = useCallback(async () => {
    if (!address) return;
    try {
      const provider = getProvider();
      const staking = getStakingContract(provider);
      const token = getTokenContract(provider);
      if (staking) {
        const bal = await staking.getStakeBalance(address);
        setStakeBalance(ethers.formatEther(bal));
      }
      if (token) {
        const bal = await token.balanceOf(address);
        setTokenBalance(ethers.formatEther(bal));
      }
    } catch (err) { console.error('加载余额失败:', err); }
  }, [address]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  const handleStake = async () => {
    if (!stakeAmount) return;
    setLoading(true);
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const staking = getStakingContract(signer);
      const token = getTokenContract(signer);
      const amountWei = ethers.parseEther(stakeAmount);

      const approveTx = await token.approve(CONTRACTS.stakingManager, amountWei);
      await approveTx.wait();
      const stakeTx = await staking.stake(amountWei);
      await stakeTx.wait();

      setStakeAmount('');
      await loadBalances();
      if (onStakeComplete) onStakeComplete();
    } catch (err) { alert('质押失败: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount) return;
    setLoading(true);
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const staking = getStakingContract(signer);
      const amountWei = ethers.parseEther(unstakeAmount);

      const tx = await staking.unstake(amountWei);
      await tx.wait();

      setUnstakeAmount('');
      await loadBalances();
      if (onStakeComplete) onStakeComplete();
    } catch (err) { alert('提取质押失败: ' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="glass-card">
      <h3 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', fontSize: '1.1rem' }}>质押管理</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>当前质押余额</span>
          <p className="data-font neon-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {Number(stakeBalance).toFixed(2)} DAIT
          </p>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>钱包余额</span>
          <p className="data-font" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {Number(tokenBalance).toFixed(2)} DAIT
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <input type="number" placeholder="质押金额" value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          style={{ flex: 1, background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '8px', color: 'var(--text-primary)', padding: '0.5rem 0.75rem',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }} />
        <button className="btn-primary" onClick={handleStake} disabled={loading || !stakeAmount}
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
          {loading ? '处理中...' : '质押'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <input type="number" placeholder="提取金额" value={unstakeAmount}
          onChange={(e) => setUnstakeAmount(e.target.value)}
          style={{ flex: 1, background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '8px', color: 'var(--text-primary)', padding: '0.5rem 0.75rem',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }} />
        <button className="btn-secondary" onClick={handleUnstake} disabled={loading || !unstakeAmount}
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
          {loading ? '处理中...' : '提取'}
        </button>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
        注意：有进行中任务时无法提取质押。质押需至少为任务报酬的150%才能接单。
      </p>
    </div>
  );
}
