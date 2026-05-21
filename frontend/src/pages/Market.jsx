/**
 * Market — 算力市场页
 *
 * 核心功能：
 * - 任务看板：浏览所有开放的AI算力任务
 * - 筛选器：按报酬、信誉要求、GPU类型筛选
 * - 发布任务：需求方可创建新任务（锁定报酬）
 * - 接单：节点可直接从市场页面接单
 * - 确认/争议：需求方管理自己的任务
 *
 * 智能合约交互：
 * - postTask: 发布任务并锁定报酬
 * - acceptTask: 节点接单（检查质押和信誉）
 * - confirmResult: 确认并付款
 * - disputeResult: 发起争议
 */

import { useAccount } from 'wagmi';
import { useContract } from '../hooks/useContract';
import TaskBoard from '../components/TaskBoard';

export default function Market() {
  const { address } = useAccount();
  const {
    tasks, loading,
    postTask, acceptTask, confirmResult, disputeResult,
  } = useContract();

  const handlePostTask = async (description, rewardWei, deadline, minRep) => {
    await postTask(description, rewardWei, deadline, minRep);
  };

  const handleAcceptTask = async (taskId) => {
    if (!address) { alert('请先连接钱包'); return; }
    try {
      await acceptTask(taskId);
      alert('接单成功！');
    } catch (err) {
      alert('接单失败: ' + err.message);
    }
  };

  const handleConfirmTask = async (taskId) => {
    try {
      await confirmResult(taskId);
      alert('报酬已释放！');
    } catch (err) {
      alert('确认失败: ' + err.message);
    }
  };

  const handleDisputeTask = async (taskId) => {
    const reason = prompt('请输入争议原因：');
    if (!reason) return;
    try {
      await disputeResult(taskId, reason);
      alert('争议已发起，报酬已退回');
    } catch (err) {
      alert('争议失败: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>
            <span className="neon-text">算力市场</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            浏览和发布AI算力任务
          </p>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {tasks.length} 个任务
        </div>
      </div>

      <TaskBoard
        tasks={tasks}
        loading={loading}
        onAcceptTask={handleAcceptTask}
        onConfirmTask={handleConfirmTask}
        onDisputeTask={handleDisputeTask}
        onPostTask={handlePostTask}
        userAddress={address}
      />
    </div>
  );
}
