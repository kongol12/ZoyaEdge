import { Trade } from './db';

export function computeTradingStats(trades: Trade[]) {
  if (!trades || trades.length === 0) return null;

  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);

  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);

  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;
  const riskRewardRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  // Drawdown
  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  [...trades].sort((a, b) => a.date.getTime() - b.date.getTime()).forEach(t => {
    cumulative += t.pnl;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  // Groupings
  const byStrategy = groupBySum(trades, 'strategy');
  const bySession = groupBySum(trades, 'session');

  const bestStrategy = getBest(byStrategy);
  const worstStrategy = getWorst(byStrategy);
  const bestSession = getBest(bySession);
  const worstSession = getWorst(bySession);

  // Emotional Loss Rate
  const negativeEmotions = ['😰', '😕', '🤑', '😤', 'fear'];
  const emotionalTrades = trades.filter(t => t.emotion && negativeEmotions.includes(t.emotion));
  const emotionalLosses = emotionalTrades.filter(t => t.pnl < 0);
  const emotionalLossRate = emotionalTrades.length > 0 ? (emotionalLosses.length / emotionalTrades.length) * 100 : 0;

  // Overtrading (max trades in a day)
  const byDate = trades.reduce((acc, t) => {
    const d = t.date.toISOString().split('T')[0];
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const overtradingScore = Object.values(byDate).length > 0 ? Math.max(...Object.values(byDate)) : 0;

  // Consistency (heuristic 0-100)
  const consistencyScore = Math.min(100, Math.max(0, (winRate * 0.5) + (Math.min(riskRewardRatio, 2) * 25)));

  // Streak
  let streak = 0;
  if (trades.length > 0) {
    const sorted = [...trades].sort((a, b) => b.date.getTime() - a.date.getTime());
    const isWin = sorted[0].pnl >= 0;
    for (const t of sorted) {
      if ((t.pnl >= 0) === isWin) streak += (isWin ? 1 : -1);
      else break;
    }
  }

  return {
    totalTrades,
    winRate: Number(winRate.toFixed(2)),
    totalPnL: Number(totalPnL.toFixed(2)),
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    bestStrategy,
    worstStrategy,
    bestSession,
    worstSession,
    emotionalLossRate: Number(emotionalLossRate.toFixed(2)),
    overtradingScore,
    consistencyScore: Number(consistencyScore.toFixed(2)),
    streak
  };
}

function groupBySum(trades: Trade[], key: keyof Trade) {
  return trades.reduce((acc, t) => {
    const k = String(t[key] || 'Unknown');
    acc[k] = (acc[k] || 0) + t.pnl;
    return acc;
  }, {} as Record<string, number>);
}

function getBest(record: Record<string, number>) {
  const entries = Object.entries(record);
  if (entries.length === 0) return 'None';
  return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
}

function getWorst(record: Record<string, number>) {
  const entries = Object.entries(record);
  if (entries.length === 0) return 'None';
  return entries.reduce((a, b) => a[1] < b[1] ? a : b)[0];
}
