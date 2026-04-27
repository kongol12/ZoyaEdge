export interface Trade {
  id: string;
  pair: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  pnl: number;
  strategy?: string;
  session?: string;
  emotion?: string;
  notes?: string;
  platform?: string;
  date: string; // ISO date
  userId: string;
}

export interface TradeFilter {
  dateRange?: string;
  pair?: string;
  strategy?: string;
  session?: string;
  platform?: string;
}

export interface TradeStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
}
