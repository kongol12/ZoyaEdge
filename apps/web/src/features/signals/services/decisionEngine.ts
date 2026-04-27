import { format, isSameDay } from 'date-fns';

export interface Trade {
  id?: string;
  pair: string;
  direction: 'buy' | 'sell';
  entryPrice?: number;
  exitPrice?: number;
  lotSize?: number;
  pnl: number;
  strategy: string;
  emotion: string;
  session?: 'London' | 'NY' | 'Asia';
  date: any;
}

export interface DecisionEngineResult {
  summary: {
    total_pnl: number;
    winrate: number;
  };
  scores: {
    risk_score: number;
    discipline_score: number;
    consistency_score: number;
  };
  alerts: {
    type: 'risk' | 'behavior' | 'strategy' | 'discipline';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }[];
  actions: {
    priority: number;
    action: string;
    reason: string;
  }[];
  coach_decision: {
    status: 'green' | 'orange' | 'red';
    action: 'continue' | 'reduce_risk' | 'stop_trading';
  };
}

export function computeDecisionEngine(trades: Trade[]): DecisionEngineResult {
  if (trades.length === 0) {
    return {
      summary: { total_pnl: 0, winrate: 0 },
      scores: { risk_score: 100, discipline_score: 100, consistency_score: 100 },
      alerts: [],
      actions: [],
      coach_decision: { status: 'green', action: 'continue' }
    };
  }

  // 1. Basic Stats
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winners = trades.filter(t => t.pnl > 0);
  const winrate = (winners.length / trades.length) * 100;

  // 2. Analysis Helpers
  
  // Overtrading: More than 5 trades in a single day
  const tradesByDay: { [key: string]: number } = {};
  trades.forEach(t => {
    const d = t.date?.toDate ? format(t.date.toDate(), 'yyyy-MM-dd') : 'unknown';
    tradesByDay[d] = (tradesByDay[d] || 0) + 1;
  });
  const overtradingDetected = Object.values(tradesByDay).some(count => count > 5);

  // Risk imbalance: Maximum loss > 3x average winning trade
  const losses = trades.filter(t => t.pnl < 0);
  const maxLoss = losses.length > 0 ? Math.abs(Math.min(...losses.map(t => t.pnl))) : 0;
  const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length : 0;
  const riskImbalanceDetected = avgWin > 0 && maxLoss > (3 * avgWin);

  // Emotional instability: If "😰" trades exist AND more than 50% of them are losses
  const anxiousTrades = trades.filter(t => t.emotion === '😰' || t.emotion === 'fear');
  const anxiousLosses = anxiousTrades.filter(t => t.pnl < 0);
  const emotionalInstabilityDetected = anxiousTrades.length > 0 && (anxiousLosses.length / anxiousTrades.length) > 0.5;

  // Strategy weakness: Any strategy with total negative PnL
  const strategyPnl: { [key: string]: number } = {};
  trades.forEach(t => {
    strategyPnl[t.strategy] = (strategyPnl[t.strategy] || 0) + t.pnl;
  });
  const weakStrategies = Object.keys(strategyPnl).filter(s => strategyPnl[s] < 0);

  // Session weakness
  const sessionPnl: { [key: string]: number } = {};
  trades.forEach(t => {
    if (t.session) {
      sessionPnl[t.session] = (sessionPnl[t.session] || 0) + t.pnl;
    }
  });

  // Lot size inconsistency
  const lotSizes = trades.map(t => t.lotSize || 1);
  const avgLot = lotSizes.reduce((a, b) => a + b, 0) / lotSizes.length;
  const inconsistentLotSize = lotSizes.some(l => Math.abs(l - avgLot) > avgLot * 0.5);

  // Random strategies
  const uniqueStrategies = new Set(trades.map(t => t.strategy)).size;
  const randomStrategiesDetected = uniqueStrategies > 3;

  // Consecutive losses
  let maxConsecutiveLosses = 0;
  let currentConsecutive = 0;
  [...trades].sort((a,b) => (a.date?.toMillis?.() || 0) - (b.date?.toMillis?.() || 0)).forEach(t => {
    if (t.pnl < 0) {
      currentConsecutive++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  });
  const largeConsecutiveLosses = maxConsecutiveLosses >= 3;

  // 3. Scoring
  let risk_score = 100;
  if (riskImbalanceDetected) risk_score -= 25;
  if (overtradingDetected) risk_score -= 20;
  if (largeConsecutiveLosses) risk_score -= 20;
  risk_score = Math.max(0, Math.min(100, risk_score));

  let discipline_score = 100;
  if (emotionalInstabilityDetected) discipline_score -= 30;
  if (inconsistentLotSize) discipline_score -= 20;
  if (randomStrategiesDetected) discipline_score -= 20;
  discipline_score = Math.max(0, Math.min(100, discipline_score));

  let consistency_score = 100;
  if (winrate < 40) consistency_score -= 25;
  // variance penalty (simplified)
  const pnls = trades.map(t => t.pnl);
  const variance = pnls.reduce((a, b) => a + Math.pow(b - (totalPnl / trades.length), 2), 0) / trades.length;
  if (variance > Math.pow(Math.max(...pnls), 2) * 0.5) consistency_score -= 25;
  consistency_score = Math.max(0, Math.min(100, consistency_score));

  // 4. Decision
  let status: 'green' | 'orange' | 'red' = 'green';
  let actionStr: 'continue' | 'reduce_risk' | 'stop_trading' = 'continue';

  if (risk_score < 50) {
    status = 'red';
    actionStr = 'stop_trading';
  } else if (risk_score < 75) {
    status = 'orange';
    actionStr = 'reduce_risk';
  }

  // 5. Alerts & Actions
  const alerts: DecisionEngineResult['alerts'] = [];
  const actions: DecisionEngineResult['actions'] = [];

  if (overtradingDetected) {
    alerts.push({ type: 'behavior', severity: 'high', message: "Sur-trading détecté : plus de 5 trades par jour." });
    actions.push({ priority: 1, action: "Limiter à 3 trades maximum par session", reason: "Prévenir l'épuisement émotionnel et les pertes impulsives" });
  }
  if (riskImbalanceDetected) {
    alerts.push({ type: 'risk', severity: 'high', message: "Déséquilibre de risque : Pertes démesurées par rapport aux gains." });
    actions.push({ priority: 1, action: "Réduire la taille des lots de 50%", reason: "Stabiliser le compte après des pertes importantes" });
  }
  if (emotionalInstabilityDetected) {
    alerts.push({ type: 'discipline', severity: 'medium', message: "Instabilité émotionnelle détectée sur les trades perdants." });
    actions.push({ priority: 2, action: "Appliquer une pause de 15 min après chaque perte", reason: "Éviter le revenge trading émotionnel" });
  }
  if (weakStrategies.length > 0) {
    alerts.push({ type: 'strategy', severity: 'medium', message: `Faiblesse détectée sur les stratégies: ${weakStrategies.join(', ')}` });
    actions.push({ priority: 3, action: "Réviser les points d'entrée sur ces stratégies", reason: "Améliorer l'espérance mathématique du système" });
  }

  return {
    summary: { total_pnl: totalPnl, winrate },
    scores: { risk_score, discipline_score, consistency_score },
    alerts: alerts.slice(0, 5),
    actions: actions.slice(0, 5),
    coach_decision: { status, action: actionStr }
  };
}
