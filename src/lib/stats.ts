import { Trade } from './db';
import { formatRR } from './utils';
import { 
  calculateAvgRR, 
  calculateWinrate, 
  calculateProfitFactor, 
  calculateMaxDrawdown 
} from './advancedTradingMetrics';

export function computeEquityCurve(trades: Trade[], initialBalance: number = 0) {
  let cumulative = initialBalance;
  const sorted = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Add an initial point at t=0
  const points = [{
    date: 'Start',
    cumulative: Number(initialBalance.toFixed(2))
  }];
  
  sorted.forEach(t => {
    cumulative += Number(t.pnl);
    points.push({
      date: t.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cumulative: Number(cumulative.toFixed(2))
    });
  });
  
  return points;
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
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  if (realTrades.length === 0) return 0;
  const wins = realTrades.filter(t => Number(t.pnl) > 0).length;
  return Number(((wins / realTrades.length) * 100).toFixed(2));
}

export function computePnLByGroup(trades: Trade[], key: keyof Trade) {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  const grouped = realTrades.reduce((acc, t) => {
    const groupKey = String(t[key] || 'Unknown');
    acc[groupKey] = (acc[groupKey] || 0) + Number(t.pnl);
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped).map(([name, pnl]) => ({ name, pnl: Number(pnl.toFixed(2)) }));
}

export function computeTradesPerDay(trades: Trade[]) {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  const grouped = realTrades.reduce((acc, t) => {
    const dateStr = t.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped).map(([date, count]) => ({ name: date, count }));
}

export function computeRiskReward(trades: Trade[]) {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  const wins = realTrades.filter(t => Number(t.pnl || 0) > 0);
  const losses = realTrades.filter(t => Number(t.pnl || 0) < 0);

  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + Number(t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + Number(t.pnl || 0), 0)) / losses.length : 0;

  const rr = calculateAvgRR(realTrades);
  return {
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    ratio: Number(rr.toFixed(2))
  };
}

import { calculateZoyaScores } from './scoring';

export function computePerformanceMetrics(trades: Trade[]) {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  
  if (realTrades.length === 0) {
    return {
      summary: {
        totalPnL: 0,
        winRate: 0,
        profitFactor: 0,
        avgRR: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        avgWin: 0,
        avgLoss: 0,
        consistency: 0,
        avgReturn: 0
      },
      metrics: [
        { subject: 'Profit Factor', A: 0, fullMark: 100, value: '0' },
        { subject: 'R/R', A: 0, fullMark: 100, value: '0' },
        { subject: 'Avg Return', A: 0, fullMark: 100, value: '$0' },
        { subject: 'Max DD', A: 0, fullMark: 100, value: '$0' },
        { subject: 'Consistency', A: 0, fullMark: 100, value: '0%' },
      ],
      overallScore: 0,
      status: 'Faible',
      color: 'text-rose-500',
      bg: 'bg-rose-500'
    };
  }

  const totalPnL = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const avgReturn = totalPnL / Math.max(1, realTrades.length);

  const winRate = calculateWinrate(realTrades);
  const profitFactor = calculateProfitFactor(realTrades);
  const rr = calculateAvgRR(realTrades);
  const maxDrawdown = calculateMaxDrawdown(realTrades);

  // Consistency Calculation from Zoya Engine
  const zoyaScores = calculateZoyaScores(realTrades as any);
  const consistency = zoyaScores.consistency_score;

  const wins = realTrades.filter(t => t.pnl > 0);
  const losses = realTrades.filter(t => t.pnl < 0);
  const grossProfit = wins.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + Number(t.pnl || 0), 0)) / losses.length : 0;

  // Normalization 0-100
  const scorePF = Math.min((profitFactor / 1.5) * 100, 100);
  const scoreRR = Math.min((rr / 1.2) * 100, 100); 
  const maxMove = Math.max(avgWin, avgLoss, 1);
  const scoreAvgReturn = Math.max(0, Math.min(100, 50 + (avgReturn / maxMove) * 50));
  const scoreMaxDD = Math.max(0, 100 - (Math.abs(maxDrawdown) / Math.max(grossProfit || 1, 1)) * 100);

  // Psychology Score based on emotion fill rate and balance
  const tradesWithEmotion = realTrades.filter(t => t.emotion && typeof t.emotion === 'string' && t.emotion.trim() !== '');
  const positiveEmotions = ['🔥', '🤩', '🧠', '😊', 'confidence'];
  const negativeEmotions = ['😰', '😕', '🤑', '😤', 'fear'];
  
  let psychologyScore = 0;
  if (tradesWithEmotion.length > 0) {
    const positives = tradesWithEmotion.filter(t => positiveEmotions.includes(t.emotion as string)).length;
    const negatives = tradesWithEmotion.filter(t => negativeEmotions.includes(t.emotion as string)).length;
    // Ratio of positive to total non-neutral
    const activeEmotions = positives + negatives;
    if (activeEmotions > 0) {
      psychologyScore = (positives / activeEmotions) * 100;
    } else {
      psychologyScore = 100; // All neutral is good discipline
    }
  } else {
    psychologyScore = 0; // Empty psychology if not filled
  }

  const overallScore = Math.round((scorePF + scoreRR + scoreAvgReturn + scoreMaxDD + consistency + psychologyScore) / 6);

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
    summary: {
      totalPnL,
      winRate,
      profitFactor,
      avgRR: rr,
      maxDrawdown,
      totalTrades: realTrades.length,
      wins: wins.length,
      losses: losses.length,
      avgWin,
      avgLoss,
      consistency,
      avgReturn,
      psychologyScore
    },
    metrics: [
      { subject: 'Profit Factor', A: Math.round(scorePF), fullMark: 100, value: profitFactor.toFixed(2) },
      { subject: 'R/R', A: Math.round(scoreRR), fullMark: 100, value: formatRR(rr) },
      { subject: 'Avg Return', A: Math.round(scoreAvgReturn), fullMark: 100, value: `$${avgReturn.toFixed(2)}` },
      { subject: 'Max DD', A: Math.round(scoreMaxDD), fullMark: 100, value: `$${Math.abs(maxDrawdown).toFixed(2)}` },
      { subject: 'Consistency', A: Math.round(consistency), fullMark: 100, value: `${Math.round(consistency)}%` },
      { subject: 'Psychologie', A: Math.round(psychologyScore), fullMark: 100, value: tradesWithEmotion.length > 0 ? `${Math.round(psychologyScore)}%` : 'N/A' },
    ],
    overallScore,
    status,
    color,
    bg
  };
}

export function calculateTradeZoyaScore(trade: Trade) {
  let score = 50; // Baseline

  // 1. Result: Win is positive
  if (trade.pnl > 0) score += 20;
  if (trade.pnl < 0) score -= 10;

  // 2. Risk Mgmt: Has SL/TP?
  if (trade.stopLoss && trade.takeProfit) score += 10;
  
  // 3. RR: Is it a high Quality RR?
  if (trade.rr && trade.rr >= 2) score += 10;
  else if (trade.rr && trade.rr >= 1) score += 5;

  // 4. Psychology: Emotion
  const positiveEmotions = ['🔥', '🤩', '🧠', '😊', 'confidence'];
  const negativeEmotions = ['😰', '😕', '🤑', '😤', 'fear'];
  
  if (trade.emotion && trade.emotion.trim() !== '') {
    if (positiveEmotions.includes(trade.emotion as string)) score += 10;
    if (negativeEmotions.includes(trade.emotion as string)) score -= 15;
  } else {
    // Neural score for missing emotion
    score += 0;
  }

  // 5. Discipline: Strategy
  if (trade.strategy && trade.strategy !== 'Autre' && trade.strategy !== 'Other') score += 10;

  return Math.max(0, Math.min(100, score));
}
