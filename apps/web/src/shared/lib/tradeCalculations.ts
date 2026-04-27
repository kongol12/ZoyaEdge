import { ASSET_DATABASE, normalizeSymbol, getAssetDefinition, type AssetCategory } from './assetDatabase';
export type { AssetCategory };

export interface TradeMetrics {
  pips: number;
  pnl: number;
  risk: number;
  reward: number;
  rr: number;
  label: 'Pips' | 'Points' | 'Ticks';
}

/**
 * Calcule les points d'un mouvement de prix pour un actif donné
 * @param entryPrice Prix d'entrée
 * @param exitPrice Prix de sortie
 * @param assetId ID de l'actif (ex: 'cmd_xauusdmicro')
 * @returns Nombre de points (variation / pipSize)
 */
export function calculatePoints(entryPrice: number, exitPrice: number, assetId: string): number {
  const asset = ASSET_DATABASE.find(a => a.id === assetId);
  const pipSize = asset?.pipSize ?? 0.0001;
  return (exitPrice - entryPrice) / pipSize;
}

/**
 * Calcule le PnL monétaire d'un trade
 * @param points Nombre de points calculés
 * @param volume Volume en lots
 * @param assetId ID de l'actif
 * @returns PnL en devise de base
 */
export function calculatePnL(points: number, volume: number, assetId: string): number {
  const asset = ASSET_DATABASE.find(a => a.id === assetId);
  const pipValue = asset?.pipValue ?? 1;
  return points * pipValue * volume;
}

/**
 * TEST VALIDATION cmd_xauusdmicro (XAUUSD Micro Deriv)
 * Example Buy 1.00 lot: 2000.00 -> 2001.00 (+1.00 USD)
 * points = (2001.00 - 2000.00) / 0.01 = 100 points
 * pnl = 100 * 0.01 * 1.00 = 1.00 USD
 */

function calculateFallback(
  symbol: string,
  priceDiff: number,
  lotSize: number,
  entryPrice: number
): { pips: number; pnl: number; label: TradeMetrics['label'] } {
  const upperSymbol = symbol.toUpperCase();
  
  let pipSize = 0.0001;
  let pipValue = 10;
  let label: TradeMetrics['label'] = 'Points';

  if (upperSymbol.includes('JPY')) {
    pipSize = 0.01;
    pipValue = 10;
    label = 'Pips';
  } else if (upperSymbol.includes('XAU') || upperSymbol.includes('GOLD')) {
    pipSize = 0.01;
    pipValue = 1;
    label = 'Points';
  } else if (upperSymbol.includes('BTC') || upperSymbol.includes('ETH')) {
    pipSize = 1;
    pipValue = 1;
    label = 'Points';
  } else if (upperSymbol.includes('100') || upperSymbol.includes('500') || upperSymbol.includes('30')) {
    pipSize = 1;
    pipValue = 1;
    label = 'Points';
  } else if (upperSymbol.length === 6 && !upperSymbol.includes(':')) {
    // Default Forex
    pipSize = 0.0001;
    pipValue = 10;
    label = 'Pips';
  } else if (upperSymbol.includes('VOLATILITY') || upperSymbol.includes('BOOM') || upperSymbol.includes('CRASH')) {
    pipSize = 0.01;
    pipValue = 1;
    label = 'Points';
  }

  const pips = priceDiff / pipSize;
  const pnl = pips * pipValue * lotSize;

  return { pips, pnl, label };
}

export function calculateTradeMetrics(
  symbol: string,
  direction: 'buy' | 'sell',
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  stopLoss?: number,
  takeProfit?: number
): TradeMetrics {
  const normalized = normalizeSymbol(symbol);
  const asset = getAssetDefinition(normalized);

  const realizedExitPrice = exitPrice || entryPrice;
  const priceDiff = direction === 'buy' 
    ? realizedExitPrice - entryPrice 
    : entryPrice - realizedExitPrice;

  let pips = 0;
  let pnl = 0;
  let label: TradeMetrics['label'] = 'Points';

  if (asset) {
    let rawPips = priceDiff / asset.pipSize;
    if (asset.category === 'futures' && asset.tickSize) {
      rawPips = priceDiff / asset.tickSize;
    }

    pips = rawPips;
    pnl = rawPips * asset.pipValue * lotSize;

    if (asset.category === 'forex') {
      label = 'Pips';
    } else if (asset.category === 'futures') {
      label = 'Ticks';
    } else {
      label = 'Points';
    }
  } else {
    const fallback = calculateFallback(symbol, priceDiff, lotSize, entryPrice);
    pips = fallback.pips;
    pnl = fallback.pnl;
    label = fallback.label;
  }

  const sl = stopLoss || 0;
  const tp = takeProfit || 0;

  let risk = 0;
  if (sl > 0) {
    const riskDiff = direction === 'buy' ? entryPrice - sl : sl - entryPrice;
    if (riskDiff > 0) {
      if (asset) {
        const riskUnits = asset.category === 'futures' && asset.tickSize
          ? riskDiff / asset.tickSize
          : riskDiff / asset.pipSize;
        risk = riskUnits * asset.pipValue * lotSize;
      } else {
        const fallbackRisk = calculateFallback(symbol, riskDiff, lotSize, entryPrice);
        risk = fallbackRisk.pnl;
      }
    }
  }

  let reward = 0;
  if (tp > 0) {
    const rewardDiff = direction === 'buy' ? tp - entryPrice : entryPrice - tp;
    if (rewardDiff > 0) {
      if (asset) {
        const rewardUnits = asset.category === 'futures' && asset.tickSize
          ? rewardDiff / asset.tickSize
          : rewardDiff / asset.pipSize;
        reward = rewardUnits * asset.pipValue * lotSize;
      } else {
        const fallbackReward = calculateFallback(symbol, rewardDiff, lotSize, entryPrice);
        reward = fallbackReward.pnl;
      }
    }
  } else if (pnl > 0) {
    reward = pnl; // Realized reward if no TP
  }

  let rr = 0;
  if (risk > 0) {
    rr = reward / risk;
  }

  return {
    pips: Number(pips.toFixed(2)),
    pnl: Number(pnl.toFixed(2)),
    risk: Number(risk.toFixed(2)),
    reward: Number(reward.toFixed(2)),
    rr: Number(rr.toFixed(2)),
    label
  };
}

export { normalizeSymbol, normalizeSymbol as detectAssetType };
