/**
 * useReputation — 信誉数据Hook
 *
 * 从后端API获取节点信誉评分数据
 * 包括综合分、分量明细、历史变化记录
 *
 * 使用方式：
 *   const { score, breakdown, history, loading } = useReputation(address);
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useReputation(address) {
  const [score, setScore] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * 加载节点信誉分及分量明细
   */
  const loadScore = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/nodes/${address}/score`);
      if (!res.ok) throw new Error('API请求失败');
      const data = await res.json();
      setScore(data.overall);
      setBreakdown(data.components);
    } catch (err) {
      console.error('加载信誉分失败:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  /**
   * 加载信誉历史记录
   */
  const loadHistory = useCallback(async () => {
    if (!address) return;

    try {
      const res = await fetch(`${API_BASE}/api/reputation/${address}/history`);
      if (!res.ok) throw new Error('API请求失败');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('加载信誉历史失败:', err);
    }
  }, [address]);

  useEffect(() => {
    loadScore();
    loadHistory();
  }, [loadScore, loadHistory]);

  return {
    score,
    breakdown,
    history,
    loading,
    refresh: () => {
      loadScore();
      loadHistory();
    },
  };
}

/**
 * 获取市场统计数据（供首页展示）
 */
export function useMarketStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE}/api/market/stats`);
        if (!res.ok) throw new Error('API请求失败');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('加载市场统计失败:', err);
        // 提供默认模拟数据
        setStats({
          active_nodes: 12,
          total_tasks: 156,
          total_staked_wei: '100000000000000000000000',
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  return { stats, loading };
}
