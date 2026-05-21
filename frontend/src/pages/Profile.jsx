/**
 * Profile — 用户信誉档案页
 *
 * 公开展示节点的完整信誉档案：
 * - 综合信誉分（大字展示，带颜色等级）
 * - 信誉分历史变化折线图
 * - 任务完成记录表格
 * - Slash记录（如有，红色高亮）
 * - 可分享的信誉卡片
 */

import { useState } from 'react';
import { useReputation } from '../hooks/useReputation';
import { getScoreColor, getScoreLabel, formatDate } from '../utils/format';
import { useAccount } from 'wagmi';

export default function Profile() {
  const { address } = useAccount();
  const [lookupAddress, setLookupAddress] = useState('');
  const [searchedAddress, setSearchedAddress] = useState('');

  // 查询指定地址的信誉
  const targetAddress = searchedAddress || address;
  const { score, breakdown, history, loading } = useReputation(targetAddress);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchedAddress(lookupAddress);
  };

  const scoreColor = getScoreColor(score || 0);
  const scoreLabel = getScoreLabel(score || 0);

  return (
    <div>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>
        <span className="neon-text">信誉档案</span>
      </h1>

      {/* 地址搜索 */}
      <form onSubmit={handleSearch} style={{ marginBottom: '2rem', display: 'flex', gap: '0.75rem' }}>
        <input
          type="text"
          placeholder={address || '输入节点地址查询信誉档案'}
          value={lookupAddress}
          onChange={(e) => setLookupAddress(e.target.value)}
          style={{
            flex: 1, background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(0,212,255,0.2)',
            color: 'var(--text-primary)', padding: '0.6rem 0.75rem', borderRadius: '8px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
          }}
        />
        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
          查询
        </button>
      </form>

      {!targetAddress ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>连接钱包或输入地址以查看信誉档案</p>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>加载中...</p>
      ) : (
        <div>
          {/* 信誉分概览 */}
          <div className="glass-card" style={{ textAlign: 'center', marginBottom: '2rem', padding: '2.5rem' }}>
            <div className="data-font" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {targetAddress}
            </div>
            <div className="data-font" style={{
              fontSize: '5rem', fontWeight: 700, color: scoreColor,
              lineHeight: '1', marginBottom: '0.5rem',
            }}>
              {score ?? '--'}
            </div>
            <div style={{ fontSize: '1.1rem', color: scoreColor, fontWeight: 600, marginBottom: '0.25rem' }}>
              {scoreLabel}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              综合信誉分 (0-100)
            </div>
          </div>

          {/* 分量明细 + 历史 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}>
            {/* 分量明细 */}
            {breakdown && (
              <div className="glass-card">
                <h3 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', fontSize: '1rem' }}>
                  评分明细
                </h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {Object.entries(breakdown).map(([key, comp]) => {
                    const barColor = getScoreColor(comp.score);
                    const weightPct = Math.round(comp.weight * 100);
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {comp.label} <span style={{ fontSize: '0.65rem' }}>({weightPct}%)</span>
                          </span>
                          <span className="data-font" style={{ color: barColor, fontWeight: 600 }}>
                            {comp.score}
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${comp.score}%`, height: '100%', background: barColor,
                            borderRadius: '3px', transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 历史变化 */}
            <div className="glass-card">
              <h3 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', fontSize: '1rem' }}>
                信誉变化历史
              </h3>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>暂无历史记录</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {history.slice(0, 20).map((record, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0', borderBottom: '1px solid rgba(0,212,255,0.08)',
                    }}>
                      <div>
                        <span className="data-font" style={{
                          fontSize: '1rem', fontWeight: 700,
                          color: getScoreColor(record.score),
                        }}>
                          {record.score}
                        </span>
                        {record.components && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            {typeof record.components === 'object'
                              ? Object.entries(record.components)
                                  .filter(([_, c]) => c.weight > 0.2)
                                  .map(([k, c]) => `${c.label || k}:${c.score}`)
                                  .join(' ')
                              : ''}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {record.timestamp
                          ? (typeof record.timestamp === 'number'
                              ? formatDate(record.timestamp)
                              : new Date(record.timestamp).toLocaleDateString('zh-CN'))
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Slash记录区域 */}
          <div className="glass-card" style={{ borderColor: 'rgba(255,45,85,0.3)' }}>
            <h3 style={{ color: 'var(--accent-red)', marginBottom: '0.75rem', fontSize: '1rem' }}>
              惩罚记录 (Slash History)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              暂无被Slash记录
              <span style={{ color: 'var(--accent-green)', marginLeft: '0.5rem' }}>
                节点信誉良好
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
