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

  // On extrait d'abord UNIQUEMENT les vrais trades (on exclut les dépôts, retraits, ajustements)
  const realTrades = useMemo(() => {
    return trades.filter(t => !t.type || t.type === 'trade');
  }, [trades]);

  const filteredTrades = useMemo(() => {
    return realTrades.filter(t => {
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
  }, [realTrades, filters]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    realTrades.forEach(t => months.add(`${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`));
    return Array.from(months).sort().reverse();
  }, [realTrades]);

  const uniquePairs = useMemo(() => {
    const pairs = new Set<string>();
    realTrades.forEach(t => pairs.add(t.pair));
    return Array.from(pairs).sort();
  }, [realTrades]);

  const uniqueStrategies = useMemo(() => {
    const strategies = new Set<string>();
    realTrades.forEach(t => strategies.add(t.strategy));
    return Array.from(strategies).sort();
  }, [realTrades]);

  const uniqueSessions = useMemo(() => {
    const sessions = new Set<string>();
    realTrades.forEach(t => sessions.add(t.session));
    return Array.from(sessions).sort();
  }, [realTrades]);

  const uniquePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    realTrades.forEach(t => {
      if (t.platform) platforms.add(t.platform);
    });
    return Array.from(platforms).sort();
  }, [realTrades]);

  return {
    filters,
    setFilters,
    filteredTrades, // Ne contient plus que les vrais trades (pas de deposit/withdrawal)
    realTrades, // Tous les vrais trades sans aucun filtre
    uniqueMonths,
    uniquePairs,
    uniqueStrategies,
    uniqueSessions,
    uniquePlatforms
  };
}
