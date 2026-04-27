import { useState, useMemo } from 'react';
import { Trade } from '@shared/lib/db';

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

  // On extrait d'abord UNIQUEMENT les vrais trades (on exclut les dépôts, retraits, ajustements) pour les filtres
  const realTrades = useMemo(() => {
    return trades.filter(t => !t.type || t.type === 'trade');
  }, [trades]);

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

  const handleSetFilters = (newFilters: TradeFilters | ((prev: TradeFilters) => TradeFilters)) => {
    setFilters((prev) => {
      const updated = typeof newFilters === 'function' ? newFilters(prev) : newFilters;
      
      // Strict input validation & sanitization
      const sanitize = (val: any) => {
        if (typeof val !== 'string' || !val) return 'all';
        // Limit length and remove potentially dangerous characters for XSS/NoSQLi
        return val.substring(0, 100).replace(/[<>$"{};=]/g, '').trim();
      };

      return {
        dateRange: sanitize(updated.dateRange),
        pair: sanitize(updated.pair),
        strategy: sanitize(updated.strategy),
        session: sanitize(updated.session),
        platform: sanitize(updated.platform)
      };
    });
  };

  return {
    filters,
    setFilters: handleSetFilters,
    filteredTrades, // Ne contient plus que les vrais trades (pas de deposit/withdrawal)
    realTrades, // Tous les vrais trades sans aucun filtre
    uniqueMonths,
    uniquePairs,
    uniqueStrategies,
    uniqueSessions,
    uniquePlatforms
  };
}
