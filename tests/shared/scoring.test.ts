import { describe, it, expect } from 'vitest';
import { calculateZoyaScores } from '../../apps/web/src/shared/lib/scoring';

describe('Scoring Logic', () => {
  it('should return default scores for empty trades', () => {
    const scores = calculateZoyaScores([]);
    expect(scores.risk_score).toBe(100);
    expect(scores.status).toBe('green');
  });

  it('should detect risk imbalance', () => {
    const trades = [
      { id: '1', pair: 'XAUUSD', direction: 'buy', entryPrice: 1, exitPrice: 2, lotSize: 1, pnl: 10, strategy: 'S1', emotion: '😐', session: 'NY', date: '2026-01-01' },
      { id: '2', pair: 'XAUUSD', direction: 'buy', entryPrice: 1, exitPrice: 2, lotSize: 1, pnl: -40, strategy: 'S1', emotion: '😐', session: 'NY', date: '2026-01-02' }
    ];
    const scores = calculateZoyaScores(trades as any);
    expect(scores.risk_score).toBeLessThan(100);
  });
});
