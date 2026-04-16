import { Trade } from './db';

export interface ZoyaMetrics {
  totalPnL: number;
  winrate: number;
  profitFactor: number;
  avgRR: number;
  maxDrawdown: number;
  daily: {
    bestDay: number;
    worstDay: number;
    avgDayPnL: number;
  };
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    breakeven: number;
    maxWinStreak: number;
    maxLossStreak: number;
    openTrades: number;
  };
  time: {
    avgDurationHours: number;
    avgWinDurationHours: number;
    avgLossDurationHours: number;
  };
  fees: {
    totalCommission: number;
    totalSwaps: number;
  };
}

export function computeZoyaMetrics(trades: Trade[]): ZoyaMetrics {
  if (!trades || trades.length === 0) {
    return {
      totalPnL: 0, winrate: 0, profitFactor: 0, avgRR: 0, maxDrawdown: 0,
      daily: { bestDay: 0, worstDay: 0, avgDayPnL: 0 },
      stats: { totalTrades: 0, wins: 0, losses: 0, breakeven: 0, maxWinStreak: 0, maxLossStreak: 0, openTrades: 0 },
      time: { avgDurationHours: 0, avgWinDurationHours: 0, avgLossDurationHours: 0 },
      fees: { totalCommission: 0, totalSwaps: 0 }
    };
  }

  let totalPnL = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  let totalRR = 0;
  let rrCount = 0;

  let peak = -Infinity;
  let maxDrawdown = 0;
  let currentEquity = 0;

  const dailyPnL: Record<string, number> = {};

  let totalDuration = 0;
  let winDuration = 0;
  let lossDuration = 0;
  let durationCount = 0;
  let winDurationCount = 0;
  let lossDurationCount = 0;

  let totalCommission = 0;
  let totalSwaps = 0;

  const sortedTrades = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime());

  sortedTrades.forEach(trade => {
    const pnl = Number(trade.pnl) || 0;
    totalPnL += pnl;
    currentEquity += pnl;

    if (currentEquity > peak) {
      peak = currentEquity;
    }
    const drawdown = peak - currentEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      breakeven++;
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    if (trade.rr && trade.rr > 0) {
      totalRR += trade.rr;
      rrCount++;
    } else if (trade.risk && trade.reward && trade.risk > 0) {
      totalRR += (trade.reward / trade.risk);
      rrCount++;
    }

    const dateStr = trade.date.toISOString().split('T')[0];
    dailyPnL[dateStr] = (dailyPnL[dateStr] || 0) + pnl;

    if (trade.closedAt) {
      const durationMs = trade.closedAt.getTime() - trade.date.getTime();
      if (durationMs > 0) {
        const durationHours = durationMs / (1000 * 60 * 60);
        totalDuration += durationHours;
        durationCount++;
        if (pnl > 0) {
          winDuration += durationHours;
          winDurationCount++;
        } else if (pnl < 0) {
          lossDuration += durationHours;
          lossDurationCount++;
        }
      }
    }

    totalCommission += Number(trade.commission) || 0;
    totalSwaps += Number(trade.swap) || 0;
  });

  const totalTrades = trades.length;
  const winrate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
  const avgRR = rrCount > 0 ? totalRR / rrCount : 0;

  const dailyValues = Object.values(dailyPnL);
  const bestDay = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
  const worstDay = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
  const avgDayPnL = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;

  return {
    totalPnL,
    winrate,
    profitFactor,
    avgRR,
    maxDrawdown,
    daily: {
      bestDay,
      worstDay,
      avgDayPnL
    },
    stats: {
      totalTrades,
      wins,
      losses,
      breakeven,
      maxWinStreak,
      maxLossStreak,
      openTrades: trades.filter(t => !t.closedAt && t.exitPrice === 0).length // Rough estimate if closedAt not present
    },
    time: {
      avgDurationHours: durationCount > 0 ? totalDuration / durationCount : 0,
      avgWinDurationHours: winDurationCount > 0 ? winDuration / winDurationCount : 0,
      avgLossDurationHours: lossDurationCount > 0 ? lossDuration / lossDurationCount : 0
    },
    fees: {
      totalCommission,
      totalSwaps
    }
  };
}
