/**
 * ReputationCard — 信誉评分展示卡片组件
 *
 * 展示节点的综合信誉分及各分量明细
 * 支持颜色编码和星级评价
 *
 * 数据来源：后端信誉评分API
 */

import { useReputation } from '../hooks/useReputation';
import { getScoreColor, getScoreLabel } from '../utils/format';

export default function ReputationCard({ address }) {
  const { score, breakdown, loading } = useReputation(address);

  if (loading) {
    return (
      <div className="glass-card">
        <p style={{ color: 'var(--text-secondary)' }}>加载信誉数据中...</p>
      </div>
    );
  }

  if (score === null) {
    return (
      <div className="glass-card">
        <p style={{ color: 'var(--text-secondary)' }}>暂无信誉数据</p>
      </div>
    );
  }

  const scoreColor = getScoreColor(score);

  return (
    <div className="glass-card" style={{ textAlign: 'center' }}>
      {/* 综合评分大字展示 */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div
          className="data-font"
          style={{
            fontSize: '4rem',
            fontWeight: 700,
            color: scoreColor,
            lineHeight: '1',
            transition: 'color 0.5s ease',
          }}
        >
          {score}
        </div>
        <div style={{ fontSize: '0.9rem', color: scoreColor, fontWeight: 600 }}>
          {getScoreLabel(score)}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          综合信誉分 (0-100)
        </div>
      </div>

      {/* 分量明细 */}
      {breakdown && (
        <div style={{ display: 'grid', gap: '0.6rem', textAlign: 'left' }}>
          {Object.entries(breakdown).map(([key, component]) => {
            const barColor = getScoreColor(component.score);
            const weightPercent = Math.round(component.weight * 100);
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {component.label}
                    <span style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>({weightPercent}%)</span>
                  </span>
                  <span className="data-font" style={{ color: barColor, fontWeight: 600 }}>
                    {component.score}
                  </span>
                </div>
                {/* 进度条 */}
                <div style={{
                  width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)',
                  borderRadius: '2px', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${component.score}%`, height: '100%', background: barColor,
                    borderRadius: '2px', transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 信誉等级说明 */}
      <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
        <span style={{ color: '#00FF88' }}>90+ 优秀</span> · {' '}
        <span style={{ color: '#00D4FF' }}>70+ 良好</span> · {' '}
        <span style={{ color: '#FF8C00' }}>50+ 一般</span> · {' '}
        <span style={{ color: '#FF2D55' }}>&lt;50 高风险</span>
      </div>
    </div>
  );
}
