/**
 * Home — 首页/Landing Page
 *
 * 包含：
 * - Hero区：项目标语 + CTA按钮
 * - 实时统计数据：活跃节点数、已完成任务数
 * - 平台工作原理三步图解
 * - 最近成交任务滚动列表
 */

import { Link } from 'react-router-dom';
import { useMarketStats } from '../hooks/useReputation';
import { formatETH } from '../utils/format';
import { ethers } from 'ethers';

export default function Home() {
  const { stats, loading: statsLoading } = useMarketStats();

  return (
    <div>
      {/* Hero区域 */}
      <section style={{
        textAlign: 'center',
        padding: '4rem 1rem 3rem',
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 700,
          marginBottom: '1rem',
          lineHeight: 1.2,
        }}>
          <span style={{ color: 'var(--text-primary)' }}>去中心化</span>{' '}
          <span className="neon-text">AI算力</span>
          <br />
          <span style={{ color: 'var(--text-primary)' }}>租赁平台</span>
        </h1>
        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '600px',
          margin: '0 auto 2rem',
          lineHeight: 1.6,
        }}>
          通过经济博弈机制（Staking + Slashing）保证计算可信，无需复杂的零知识证明。
          发布AI训练任务，让全球GPU节点为你工作。
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/market" className="btn-primary" style={{ textDecoration: 'none', fontSize: '1rem', padding: '0.85rem 2.5rem' }}>
            发布任务
          </Link>
          <Link to="/dashboard" className="btn-secondary" style={{ textDecoration: 'none', fontSize: '1rem', padding: '0.85rem 2.5rem' }}>
            成为节点
          </Link>
        </div>
      </section>

      {/* 实时统计数据 */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.25rem',
        padding: '1rem 0 3rem',
      }}>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
            {statsLoading ? '...' : (stats?.active_nodes || 0)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            活跃GPU节点
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            {statsLoading ? '...' : (stats?.total_tasks || 0)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            已完成任务
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-orange)' }}>
            {statsLoading ? '...' : formatETH(stats?.total_staked_wei || 0)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            流通质押总额 (DAIT)
          </div>
        </div>
      </section>

      {/* 工作原理三步图解 */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.5rem', color: 'var(--accent-blue)' }}>
          工作原理
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
        }}>
          {[
            { step: '01', title: '发布任务', desc: '需求方发布AI算力任务，锁定DAIT代币作为报酬到智能合约中' },
            { step: '02', title: '匹配节点', desc: 'GPU节点根据信誉分和质押金额接单，合约自动验证资格' },
            { step: '03', title: '自动结算', desc: '完成后合约自动释放报酬，平台收取3%手续费。作恶节点质押金被罚没' },
          ].map((item) => (
            <div key={item.step} className="glass-card" style={{ textAlign: 'center' }}>
              <div className="data-font" style={{
                fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-blue)',
                marginBottom: '0.75rem', opacity: 0.4,
              }}>
                {item.step}
              </div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>{item.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 核心技术亮点 */}
      <section style={{
        padding: '2rem 0 4rem',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', color: 'var(--accent-blue)' }}>
          核心技术：经济博弈替代ZK证明
        </h2>
        <div className="glass-card" style={{ textAlign: 'left', lineHeight: 1.7, fontSize: '0.9rem' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: 'var(--accent-green)' }}>传统方案：</strong>
            零知识证明(ZKP)可提供完美数学保证，但生成证明的计算开销是原始计算的100-1000倍，无法实用。
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: 'var(--accent-blue)' }}>我们的方案：</strong>
            通过<strong>质押+随机抽查+重罚</strong>的经济博弈机制保证计算可信。
          </p>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
            <li>节点质押150%于任务报酬的保证金</li>
            <li>随机抽取10%的任务重新验证</li>
            <li>作恶节点被Slash 50%质押金，信誉归零</li>
            <li>博弈均衡：诚实是最优策略</li>
          </ul>
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--accent-orange)' }}>
            类比：Filecoin的罚没机制、Eigenlayer的Slashing设计
          </p>
        </div>
      </section>
    </div>
  );
}
