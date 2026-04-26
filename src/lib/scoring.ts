import { differenceInDays, parseISO } from 'date-fns';

export interface Trade {
  id?: string;
  pair: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  pnl: number;
  strategy: string;
  emotion: string;
  session: string;
  date: any; // Timestamp or string
}

export interface ZoyaScores {
  risk_score: number;
  discipline_score: number;
  consistency_score: number;
  total_score: number;
  status: 'red' | 'orange' | 'green';
  journal_score: number;
}

export function calculateZoyaScores(trades: Trade[], notebookEntries: any[] = []): ZoyaScores {
  let risk = 100;
  let discipline = 100;
  let consistency = 100;
  let journalScore = 0;

  if (trades.length === 0) {
    return {
      risk_score: 100,
      discipline_score: 100,
      consistency_score: 100,
      total_score: 100,
      status: 'green',
      journal_score: 0
    };
  }

  // 0. JOURNAL ANALYSIS
  // If user has at least 1 journal entry for every 5 trades, they get full journal score
  const journalRatio = Math.min(1, notebookEntries.length / Math.max(1, trades.length / 5));
  journalScore = Math.round(journalRatio * 100);

  // Journaling improves discipline and consistency
  if (journalScore > 50) {
    discipline += 10; 
    consistency += 10;
  } else if (journalScore === 0 && trades.length > 10) {
    discipline -= 10;
    consistency -= 10;
  }

  // 1. RISK ANALYSIS
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const avgWin = wins.length > 0 ? wins.reduce((acc, t) => acc + t.pnl, 0) / wins.length : 0;
  const maxLoss = Math.min(...trades.map(t => t.pnl));

  // Risk imbalance
  if (Math.abs(maxLoss) > 3 * avgWin && avgWin > 0) {
    risk -= 25;
  }

  // Overtrading detection
  const tradesByDate: Record<string, number> = {};
  trades.forEach(t => {
    const d = t.date?.toDate?.() ? t.date.toDate().toISOString().split('T')[0] : t.date;
    tradesByDate[d] = (tradesByDate[d] || 0) + 1;
  });
  if (Object.values(tradesByDate).some(count => count > 5)) {
    risk -= 20;
  }

  // Consecutive losses (simple check)
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  // Sort trades by date descending for sequence
  const sortedTrades = [...trades].sort((a, b) => {
    const da = a.date?.toDate?.() ? a.date.toDate() : new Date(a.date);
    const db = b.date?.toDate?.() ? b.date.toDate() : new Date(b.date);
    return db.getTime() - da.getTime();
  });
  sortedTrades.forEach(t => {
    if (t.pnl < 0) {
      consecutiveLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    } else {
      consecutiveLosses = 0;
    }
  });
  if (maxConsecutiveLosses >= 3) {
    risk -= 20;
  }

  // 2. DISCIPLINE ANALYSIS
  // Emotional instability
  const negativeEmotions = ['😰', '😕', '🤑', '😤', 'fear'];
  const emotionalTrades = trades.filter(t => negativeEmotions.includes(t.emotion));
  if (emotionalTrades.length > 0) {
    const emotionalLossrate = emotionalTrades.filter(t => t.pnl < 0).length / emotionalTrades.length;
    if (emotionalLossrate > 0.5) {
      discipline -= 30;
    }
  }

  // Inconsistent lot size
  const lotSizes = trades.map(t => t.lotSize);
  const avgLot = lotSizes.reduce((a, b) => a + b, 0) / lotSizes.length;
  const lotVariance = lotSizes.some(l => Math.abs(l - avgLot) / avgLot > 0.5);
  if (lotVariance) {
    discipline -= 20;
  }

  // Random strategies
  const strategies = new Set(trades.map(t => t.strategy));
  if (strategies.size > 3) {
    discipline -= 20;
  }

  // 3. CONSISTENCY ANALYSIS
  // Winrate
  const winrate = wins.length / trades.length;
  if (winrate < 0.4) {
    consistency -= 25;
  }

  // Heavy fluctuations (PnL variance)
  const totalPnL = trades.reduce((a, b) => a + b.pnl, 0);
  const avgPnL = totalPnL / trades.length;
  const pnlVariance = trades.reduce((acc, t) => acc + Math.pow(t.pnl - avgPnL, 2), 0) / trades.length;
  if (pnlVariance > 1000) { // arbitrary threshold for now
    consistency -= 25;
  }

  // Irregular trading days
  if (trades.length > 5) {
      const uniqueDays = Object.keys(tradesByDate).length;
      if (uniqueDays < 3) {
        consistency -= 20;
      }
  }

  // Clamping
  risk = Math.max(0, Math.min(100, risk));
  discipline = Math.max(0, Math.min(100, discipline));
  consistency = Math.max(0, Math.min(100, consistency));

  const total = (risk + discipline + consistency) / 3;
  let status: 'red' | 'orange' | 'green' = 'green';
  if (risk < 50) status = 'red';
  else if (risk < 75) status = 'orange';

  return {
    risk_score: Math.round(risk),
    discipline_score: Math.round(discipline),
    consistency_score: Math.round(consistency),
    total_score: Math.round(total),
    status,
    journal_score: journalScore
  };
}
