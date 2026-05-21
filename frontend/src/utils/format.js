/**
 * 数据格式化工具函数
 * 提供地址截断、ETH单位转换、日期格式化等通用功能
 */

import { ethers } from 'ethers';

/**
 * 截断以太坊地址显示（0x1234...abcd）
 * @param {string} address - 完整地址
 * @param {number} start - 开头保留位数（默认6）
 * @param {number} end - 结尾保留位数（默认4）
 * @returns {string} 截断后的地址
 */
export function truncateAddress(address, start = 6, end = 4) {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * 将wei转换为ETH字符串（保留4位小数）
 * @param {bigint|string} wei - wei值
 * @returns {string} ETH格式字符串
 */
export function formatETH(wei) {
  if (!wei) return '0';
  try {
    const eth = ethers.formatEther(wei);
    const num = parseFloat(eth);
    // 小于0.0001时显示完整精度，否则保留4位
    if (num < 0.0001 && num > 0) return eth;
    return num.toFixed(4);
  } catch {
    return '0';
  }
}

/**
 * 格式化Unix时间戳为可读日期
 * @param {number} timestamp - Unix时间戳（秒）
 * @returns {string} 格式化日期
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(Number(timestamp) * 1000);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化Unix时间戳为相对时间（如"3天前"）
 * @param {number} timestamp - Unix时间戳（秒）
 * @returns {string} 相对时间描述
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now() / 1000;
  const diff = now - Number(timestamp);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  return formatDate(timestamp);
}

/**
 * 任务状态文本映射
 * @param {number} status - 状态枚举值
 * @returns {object} { label: string, color: string }
 */
export function getTaskStatusInfo(status) {
  const map = {
    0: { label: '待接单', color: 'var(--accent-blue)' },
    1: { label: '进行中', color: 'var(--accent-orange)' },
    2: { label: '审核中', color: 'var(--accent-orange)' },
    3: { label: '已完成', color: 'var(--accent-green)' },
    4: { label: '已争议', color: 'var(--accent-red)' },
  };
  return map[status] || { label: '未知', color: '#666' };
}

/**
 * 信誉分颜色映射
 * @param {number} score - 0-100的信誉分
 * @returns {string} 颜色代码
 */
export function getScoreColor(score) {
  if (score >= 90) return '#00FF88';
  if (score >= 70) return '#00D4FF';
  if (score >= 50) return '#FF8C00';
  return '#FF2D55';
}

/**
 * 信誉分文字评级
 * @param {number} score - 0-100的信誉分
 * @returns {string} 评级文字
 */
export function getScoreLabel(score) {
  if (score >= 90) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 50) return '一般';
  return '较差';
}
