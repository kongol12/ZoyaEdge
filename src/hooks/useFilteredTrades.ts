import { useState, useMemo } from 'react';
import { Trade } from '../lib/db';

export interface TradeFilters {
  dateRange: string;
  pair: string;
  strategy: string;
  session: string;
  platform: string;
}

export function useFilteredTrades(trades: Trade[]) {
  const [filters, setFilters] = useState<TradeFilters>({
    dateRange: 'all',
    pair: 'all',
    strategy: 'all',
    session: 'all',
    platform: 'all'
  });

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Date filter
      if (filters.dateRange !== 'all') {
        const tMonth = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        if (tMonth !== filters.dateRange) return false;
      }
      
      // Pair filter
      if (filters.pair !== 'all' && t.pair !== filters.pair) return false;
      
      // Strategy filter
      if (filters.strategy !== 'all' && t.strategy !== filters.strategy) return false;
      
      // Session filter
      if (filters.session !== 'all' && t.session !== filters.session) return false;

      // Platform filter
      if (filters.platform !== 'all' && t.platform !== filters.platform) return false;
      
      return true;
    });
  }, [trades, filters]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    trades.forEach(t => months.add(`${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`));
    return Array.from(months).sort().reverse();
  }, [trades]);

  const uniquePairs = useMemo(() => {
    const pairs = new Set<string>();
    trades.forEach(t => pairs.add(t.pair));
    return Array.from(pairs).sort();
  }, [trades]);

  const uniqueStrategies = useMemo(() => {
    const strategies = new Set<string>();
    trades.forEach(t => strategies.add(t.strategy));
    return Array.from(strategies).sort();
  }, [trades]);

  const uniqueSessions = useMemo(() => {
    const sessions = new Set<string>();
    trades.forEach(t => sessions.add(t.session));
    return Array.from(sessions).sort();
  }, [trades]);

  const uniquePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    trades.forEach(t => {
      if (t.platform) platforms.add(t.platform);
    });
    return Array.from(platforms).sort();
  }, [trades]);

  return {
    filters,
    setFilters,
    filteredTrades,
    uniqueMonths,
    uniquePairs,
    uniqueStrategies,
    uniqueSessions,
    uniquePlatforms
  };
}
