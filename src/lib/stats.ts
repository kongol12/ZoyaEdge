import { Trade } from './db';

export function computeEquityCurve(trades: Trade[]) {
  let cumulative = 0;
  return [...trades].sort((a, b) => a.date.getTime() - b.date.getTime()).map(t => {
    cumulative += Number(t.pnl);
    return {
      date: t.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cumulative: Number(cumulative.toFixed(2))
    };
  });
}

export function computeDrawdown(trades: Trade[]) {
  let cumulative = 0;
  let peak = 0;
  return [...trades].sort((a, b) => a.date.getTime() - b.date.getTime()).map(t => {
    cumulative += Number(t.pnl);
    if (cumulative > peak) peak = cumulative;
    const drawdown = cumulative - peak;
    return {
      date: t.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      drawdown: Number(drawdown.toFixed(2))
    };
  });
}

export function computeWinrate(trades: Trade[]) {
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => Number(t.pnl) > 0).length;
  return Number(((wins / trades.length) * 100).toFixed(2));
}

export function computePnLByGroup(trades: Trade[], key: keyof Trade) {
  const grouped = trades.reduce((acc, t) => {
    const groupKey = String(t[key] || 'Unknown');
    acc[groupKey] = (acc[groupKey] || 0) + Number(t.pnl);
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped).map(([name, pnl]) => ({ name, pnl: Number(pnl.toFixed(2)) }));
}

export function computeTradesPerDay(trades: Trade[]) {
  const grouped = trades.reduce((acc, t) => {
    const dateStr = t.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped).map(([date, count]) => ({ name: date, count }));
}

export function computeRiskReward(trades: Trade[]) {
  const wins = trades.filter(t => Number(t.pnl) > 0);
  const losses = trades.filter(t => Number(t.pnl) < 0);

  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + Number(t.pnl), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + Number(t.pnl), 0)) / losses.length : 0;

  const rr = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? avgWin : 0);
  return {
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    ratio: Number(rr.toFixed(2))
  };
}

export function computePerformanceMetrics(trades: Trade[]) {
  if (trades.length === 0) {
    return {
      metrics: [
        { subject: 'Profit Factor', A: 0, fullMark: 100, value: '0' },
        { subject: 'R/R', A: 0, fullMark: 100, value: '0' },
        { subject: 'Avg Return', A: 0, fullMark: 100, value: '$0' },
        { subject: 'Max DD', A: 0, fullMark: 100, value: '$0' },
      ],
      overallScore: 0,
      status: 'Faible',
      color: 'text-rose-500',
      bg: 'bg-rose-500'
    };
  }

  const wins = trades.filter(t => Number(t.pnl) > 0);
  const losses = trades.filter(t => Number(t.pnl) < 0);

  const grossProfit = wins.reduce((sum, t) => sum + Number(t.pnl), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + Number(t.pnl), 0));

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);
  
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const rr = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? avgWin : 0);

  const totalPnL = trades.reduce((sum, t) => sum + Number(t.pnl), 0);
  const avgReturn = totalPnL / trades.length;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  [...trades].sort((a, b) => a.date.getTime() - b.date.getTime()).forEach(t => {
    cumulative += Number(t.pnl);
    if (cumulative > peak) peak = cumulative;
    const drawdown = cumulative - peak; // will be <= 0
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  });

  // Normalization 0-100
  const scorePF = Math.min((profitFactor / 2) * 100, 100);
  const scoreRR = Math.min((rr / 2) * 100, 100);
  
  // Avg Return Score: 50 is break-even. 100 is avgReturn == avgWin. 0 is avgReturn == -avgLoss.
  const maxMove = Math.max(avgWin, avgLoss, 1);
  const scoreAvgReturn = Math.max(0, Math.min(100, 50 + (avgReturn / maxMove) * 50));

  // Max Drawdown Score: 100 is 0 DD. 0 is DD >= Gross Profit.
  const scoreMaxDD = Math.max(0, 100 - (Math.abs(maxDrawdown) / Math.max(grossProfit, 1)) * 100);

  const overallScore = (scorePF + scoreRR + scoreAvgReturn + scoreMaxDD) / 4;

  let status = 'Faible';
  let color = 'text-rose-500';
  let bg = 'bg-rose-500';
  
  if (overallScore >= 70) {
    status = 'Excellent';
    color = 'text-emerald-500';
    bg = 'bg-emerald-500';
  } else if (overallScore >= 40) {
    status = 'Équilibré';
    color = 'text-amber-500';
    bg = 'bg-amber-500';
  }

  return {
    metrics: [
      { subject: 'Profit Factor', A: Math.round(scorePF), fullMark: 100, value: profitFactor.toFixed(2) },
      { subject: 'R/R', A: Math.round(scoreRR), fullMark: 100, value: rr.toFixed(2) },
      { subject: 'Avg Return', A: Math.round(scoreAvgReturn), fullMark: 100, value: `$${avgReturn.toFixed(2)}` },
      { subject: 'Max DD', A: Math.round(scoreMaxDD), fullMark: 100, value: `$${Math.abs(maxDrawdown).toFixed(2)}` },
    ],
    overallScore: Math.round(overallScore),
    status,
    color,
    bg
  };
}
