/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilteredTrades, FilterOptions } from '../../apps/web/src/features/trades/hooks/useFilteredTrades';

const mockTrades: any[] = [
  { id: '1', pair: 'EURUSD', strategy: 'Trend', session: 'London', pnl: 100, date: new Date('2024-01-01') },
  { id: '2', pair: 'GBPUSD', strategy: 'Range', session: 'NY', pnl: -50, date: new Date('2024-01-02') },
  { id: '3', pair: 'EURUSD', strategy: 'Breakout', session: 'Asia', pnl: 200, date: new Date('2024-02-01') },
];

describe('useFilteredTrades', () => {
  it('should return all trades when no filters are applied', () => {
    const filters: FilterOptions = {};
    const { result } = renderHook(() => useFilteredTrades(mockTrades, filters));
    expect(result.current).toHaveLength(3);
  });
  it('should filter by pair', () => {
    const filters: FilterOptions = { pair: 'GBPUSD' };
    const { result } = renderHook(() => useFilteredTrades(mockTrades, filters));
    expect(result.current).toHaveLength(1);
  });
  it('should filter by status (win)', () => {
    const filters: FilterOptions = { status: 'win' };
    const { result } = renderHook(() => useFilteredTrades(mockTrades, filters));
    expect(result.current).toHaveLength(2);
  });
  it('should filter by search query', () => {
    const filters: FilterOptions = { search: 'eur' };
    const { result } = renderHook(() => useFilteredTrades(mockTrades, filters));
    expect(result.current).toHaveLength(2);
  });
});
