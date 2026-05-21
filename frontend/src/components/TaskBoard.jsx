/**
 * TaskBoard — 任务市场看板组件
 *
 * 展示算力任务列表，支持：
 * - 按报酬范围、最低信誉要求筛选
 * - 任务卡片展示（描述、报酬、状态、信誉要求）
 * - 节点可直接从卡片"接单"
 *
 * 与区块链交互方式：
 * - 使用useContract Hook读取任务列表和写操作
 * - 监听链上事件实时更新
 */

import { useState, useMemo } from 'react';
import { formatETH, formatRelativeTime, getTaskStatusInfo, STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_UNDER_REVIEW, STATUS_COMPLETED } from '../utils/format';

export default function TaskBoard({ tasks, loading, onAcceptTask, onConfirmTask, onDisputeTask, onPostTask, userAddress }) {
  // 筛选条件
  const [minReward, setMinReward] = useState('');
  const [minReputation, setMinReputation] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPostModal, setShowPostModal] = useState(false);

  // 过滤后的任务列表
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (minReward && parseFloat(task.rewardETH) < parseFloat(minReward)) return false;
      if (minReputation && task.minReputation < Number(minReputation)) return false;
      if (statusFilter === 'open' && task.status !== STATUS_OPEN) return false;
      if (statusFilter === 'active' && ![STATUS_OPEN, STATUS_IN_PROGRESS].includes(task.status)) return false;
      if (statusFilter === 'completed' && task.status !== STATUS_COMPLETED) return false;
      return true;
    });
  }, [tasks, minReward, minReputation, statusFilter]);

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="number"
          placeholder="最低报酬 (ETH)"
          value={minReward}
          onChange={(e) => setMinReward(e.target.value)}
          style={{
            background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(0,212,255,0.2)',
            color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '8px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', width: '160px',
          }}
        />
        <input
          type="number"
          placeholder="最低信誉分 (0-100)"
          value={minReputation}
          onChange={(e) => setMinReputation(e.target.value)}
          style={{
            background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(0,212,255,0.2)',
            color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '8px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', width: '160px',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(0,212,255,0.2)',
            color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '8px',
            fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          <option value="all">全部状态</option>
          <option value="open">待接单</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
        </select>
        <button className="btn-primary" onClick={() => setShowPostModal(true)} style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>
          + 发布任务
        </button>
      </div>

      {/* 任务列表 */}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>加载中...</p>}

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        {filteredTasks.map((task) => {
          const status = getTaskStatusInfo(task.status);
          return (
            <div key={task.taskId} className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="data-font" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  #{task.taskId}
                </span>
                <span style={{ fontSize: '0.75rem', color: status.color, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="status-dot" style={{ background: status.color }} />
                  {status.label}
                </span>
              </div>

              <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                {task.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>报酬</span>
                  <p className="data-font neon-text" style={{ fontWeight: 600 }}>
                    {task.rewardETH} DAIT
                  </p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>最低信誉</span>
                  <p className="data-font" style={{ color: task.minReputation >= 80 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                    {task.minReputation}分
                  </p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>截止时间</span>
                  <p className="data-font" style={{ fontSize: '0.75rem' }}>{formatRelativeTime(task.deadline)}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>需求方</span>
                  <p className="data-font" style={{ fontSize: '0.7rem' }}>
                    {task.poster.slice(0, 6)}...{task.poster.slice(-4)}
                  </p>
                </div>
              </div>

              {task.status === STATUS_OPEN && task.poster.toLowerCase() !== userAddress?.toLowerCase() && (
                <button
                  className="btn-primary"
                  onClick={() => onAcceptTask(task.taskId)}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem' }}
                >
                  接单
                </button>
              )}

              {task.status === STATUS_UNDER_REVIEW && task.poster.toLowerCase() === userAddress?.toLowerCase() && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    onClick={() => onConfirmTask(task.taskId)}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                  >
                    确认并付款
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => onDisputeTask(task.taskId)}
                    style={{ fontSize: '0.8rem', padding: '0.5rem', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                  >
                    争议
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && filteredTasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>暂无任务</p>
          <p style={{ fontSize: '0.85rem' }}>成为第一个发布任务的需求方吧！</p>
        </div>
      )}

      {/* 发布任务Modal（简化版） */}
      {showPostModal && (
        <PostTaskModal onClose={() => setShowPostModal(false)} onSubmit={onPostTask} />
      )}
    </div>
  );
}

/**
 * PostTaskModal — 发布任务表单弹窗
 */
function PostTaskModal({ onClose, onSubmit }) {
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [minRep, setMinRep] = useState('70');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !reward) return;

    setSubmitting(true);
    try {
      const { ethers } = await import('ethers');
      const rewardWei = ethers.parseEther(reward);
      const deadline = Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400;
      await onSubmit(description, rewardWei, deadline, Number(minRep));
      onClose();
    } catch (err) {
      alert('发布失败: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }}>
      <div className="glass-card" style={{ width: '480px', maxWidth: '90vw' }}>
        <h2 style={{ marginBottom: '1.25rem', color: 'var(--accent-blue)' }}>发布新任务</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如: 训练GPT-2模型（124M参数），10个epoch，需要8x H100 GPU"
              rows={3}
              required
              style={{
                width: '100%', background: 'rgba(10,15,30,0.8)',
                border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px',
                color: 'var(--text-primary)', padding: '0.6rem', fontSize: '0.85rem',
                fontFamily: 'Space Grotesk, sans-serif', resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                报酬 (DAIT)
              </label>
              <input type="number" value={reward} onChange={(e) => setReward(e.target.value)}
                placeholder="100" step="0.01" min="0.01" required
                style={{ width: '100%', background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: '8px', color: 'var(--text-primary)', padding: '0.5rem', fontSize: '0.85rem',
                  fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                截止天数
              </label>
              <input type="number" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)}
                min="1" max="30" required
                style={{ width: '100%', background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: '8px', color: 'var(--text-primary)', padding: '0.5rem', fontSize: '0.85rem',
                  fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              最低信誉要求: {minRep}分
            </label>
            <input type="range" min="0" max="100" value={minRep}
              onChange={(e) => setMinRep(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.5rem' }}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.5rem' }}>
              {submitting ? '发布中...' : '发布任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
