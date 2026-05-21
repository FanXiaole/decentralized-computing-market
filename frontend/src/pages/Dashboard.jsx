/**
 * Dashboard — 节点运营仪表盘
 *
 * 为GPU节点提供全面的运营视图：
 * - 质押余额 + 质押/提取操作
 * - 进行中的任务列表
 * - 收益历史统计
 * - 信誉分雷达图（使用recharts库）
 * - 快速提交结果操作
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useContract } from '../hooks/useContract';
import { useReputation } from '../hooks/useReputation';
import StakingPanel from '../components/StakingPanel/StakingPanel';
import ReputationCard from '../components/ReputationCard/ReputationCard';
import { formatETH, getTaskStatusInfo } from '../utils/format';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { address } = useAccount();
  const { tasks, submitResult } = useContract();
  const { score, breakdown, loading: repLoading } = useReputation(address);

  // 我的任务（作为节点的）
  const myTasks = tasks.filter(
    (t) => t.node?.toLowerCase() === address?.toLowerCase()
  );

  // 我发布的任务（作为需求方的）
  const myPostedTasks = tasks.filter(
    (t) => t.poster?.toLowerCase() === address?.toLowerCase()
  );

  // 提交结果
  const [submitTaskId, setSubmitTaskId] = useState('');
  const [resultData, setResultData] = useState('');

  const handleSubmitResult = async () => {
    if (!submitTaskId || !resultData) return;
    try {
      await submitResult(Number(submitTaskId), resultData);
      alert('结果提交成功！');
      setSubmitTaskId('');
      setResultData('');
    } catch (err) {
      alert('提交失败: ' + err.message);
    }
  };

  // 雷达图数据
  const radarData = breakdown ? [
    { name: '完成率', value: breakdown.completion_rate?.score || 0 },
    { name: '争议记录', value: breakdown.dispute_penalty?.score || 0 },
    { name: '响应速度', value: breakdown.response_speed?.score || 0 },
    { name: '成熟度', value: breakdown.maturity?.score || 0 },
  ] : [];

  // 收益统计
  const totalEarned = myTasks
    .filter((t) => t.status === 3)
    .reduce((sum, t) => sum + parseFloat(t.rewardETH || 0) * 0.97, 0); // 减去3%手续费

  if (!address) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }} className="neon-text">节点仪表盘</h2>
        <p style={{ color: 'var(--text-secondary)' }}>请先连接钱包以访问仪表盘</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>
          <span className="neon-text">节点仪表盘</span>
        </h1>
        <p className="data-font" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {address}
        </p>
      </div>

      {/* 概览卡片行 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>信誉分</div>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
            {repLoading ? '...' : (score ?? '--')}
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>进行中任务</div>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-orange)' }}>
            {myTasks.filter(t => t.status === 1).length}
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>已完成</div>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            {myTasks.filter(t => t.status === 3).length}
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>累计收益</div>
          <div className="data-font" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            {totalEarned.toFixed(2)} DAIT
          </div>
        </div>
      </div>

      {/* 质押 + 信誉 并排 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        <StakingPanel address={address} />
        <ReputationCard address={address} />
      </div>

      {/* 信誉分雷达图 */}
      {radarData.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', fontSize: '1rem' }}>
            信誉分量雷达图
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(0,212,255,0.15)" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <Radar name="评分" dataKey="value" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 我进行中的任务 */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', fontSize: '1rem' }}>
          我的进行中任务
        </h3>
        {myTasks.filter(t => t.status === 1).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>暂无进行中任务</p>
        ) : (
          myTasks.filter(t => t.status === 1).map((task) => (
            <div key={task.taskId} style={{
              padding: '0.75rem 0', borderBottom: '1px solid rgba(0,212,255,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: '0.85rem' }}>{task.description.slice(0, 60)}...</p>
                <p className="data-font" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>
                  报酬: {task.rewardETH} DAIT
                </p>
              </div>
              <div>
                <span className="status-dot status-progress" />
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-orange)', marginLeft: '0.35rem' }}>进行中</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 快速提交结果 */}
      <div className="glass-card">
        <h3 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', fontSize: '1rem' }}>
          提交计算结果
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="number"
            placeholder="任务ID"
            value={submitTaskId}
            onChange={(e) => setSubmitTaskId(e.target.value)}
            style={{
              flex: 1, minWidth: '100px', background: 'rgba(10,15,30,0.8)',
              border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px',
              color: 'var(--text-primary)', padding: '0.5rem 0.75rem',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
            }}
          />
          <input
            type="text"
            placeholder="计算结果（如: accuracy:0.95）"
            value={resultData}
            onChange={(e) => setResultData(e.target.value)}
            style={{
              flex: 3, minWidth: '200px', background: 'rgba(10,15,30,0.8)',
              border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px',
              color: 'var(--text-primary)', padding: '0.5rem 0.75rem',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
            }}
          />
          <button className="btn-primary" onClick={handleSubmitResult}
            disabled={!submitTaskId || !resultData}
            style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}>
            提交
          </button>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          结果数据将被哈希化后存储在链上。原始数据通过IPFS等链下方案传输。
        </p>
      </div>
    </div>
  );
}
