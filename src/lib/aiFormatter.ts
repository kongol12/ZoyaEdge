export function formatStatsForAI(stats: any) {
  if (!stats) return "{}";
  return JSON.stringify({
    performance: {
      pnl: stats.totalPnL,
      winRate: stats.winRate,
      consistency: stats.consistencyScore,
      streak: stats.streak
    },
    risk: {
      drawdown: stats.maxDrawdown,
      riskReward: stats.riskRewardRatio,
      emotionalLossRate: stats.emotionalLossRate,
      overtrading: stats.overtradingScore
    },
    behavior: {
      bestStrategy: stats.bestStrategy,
      worstStrategy: stats.worstStrategy,
      bestSession: stats.bestSession,
      worstSession: stats.worstSession
    }
  });
}
