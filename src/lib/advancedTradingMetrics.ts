import { Trade } from './db';

export function calculateWinrate(trades: Trade[]): number {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  if (realTrades.length === 0) return 0;
  const wins = realTrades.filter(t => t.pnl > 0).length;
  return (wins / realTrades.length) * 100;
}

export function calculateRR(trade: Trade): number {
  if (trade.rr !== undefined) return trade.rr;
  if (trade.stopLoss && trade.takeProfit && trade.entryPrice) {
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entryPrice);
    if (risk > 0) return reward / risk;
  }
  return 0; // Default if no SL/TP
}

export function calculateAvgRR(trades: Trade[]): number {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  if (realTrades.length === 0) return 0;
  let totalRR = 0;
  let count = 0;
  for (const t of realTrades) {
    const rr = calculateRR(t);
    if (rr > 0) {
      totalRR += rr;
      count++;
    }
  }
  return count > 0 ? totalRR / count : 0;
}

export function calculateProfitFactor(trades: Trade[]): number {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  let grossProfit = 0;
  let grossLoss = 0;
  for (const t of realTrades) {
    if (t.pnl > 0) grossProfit += t.pnl;
    else if (t.pnl < 0) grossLoss += Math.abs(t.pnl);
  }
  if (grossLoss === 0) return grossProfit > 0 ? 99 : 0; // Arbitrary high number if no losses
  return grossProfit / grossLoss;
}

export function calculateExpectancy(trades: Trade[]): number {
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  if (realTrades.length === 0) return 0;
  const wins = realTrades.filter(t => t.pnl > 0);
  const losses = realTrades.filter(t => t.pnl < 0);
  
  const winrate = wins.length / realTrades.length;
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0)) / losses.length : 0;
  
  return (winrate * avgWin) - ((1 - winrate) * avgLoss);
}

export function calculateMaxDrawdown(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  
  let peak = 0;
  let currentEquity = 0;
  let maxDrawdown = 0;
  
  // Sort trades by date to ensure chronological order
  const sortedTrades = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (const t of sortedTrades) {
    currentEquity += t.pnl;
    if (currentEquity > peak) {
      peak = currentEquity;
    }
    const drawdown = peak - currentEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

export function calculateEquityCurve(trades: Trade[]): { date: string; equity: number }[] {
  const sortedTrades = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime());
  let equity = 0;
  return sortedTrades.map(t => {
    equity += t.pnl;
    return {
      date: t.date.toISOString().split('T')[0],
      equity
    };
  });
}

export function calculateStreaks(trades: Trade[]): { winStreak: number; lossStreak: number } {
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  
  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  const sortedTrades = [...realTrades].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (const t of sortedTrades) {
    if (t.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (t.pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  }
  
  return { winStreak: maxWinStreak, lossStreak: maxLossStreak };
}
