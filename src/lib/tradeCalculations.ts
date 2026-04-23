/**
 * Shared logic for trade calculations (PnL, R:R, Pips/Points)
 */

export interface AssetSettings {
  multiplier: number;
  pipFactor: number;
  label: 'Pips' | 'Points' | 'Ticks';
}

export type AssetType = 'forex' | 'indices' | 'crypto' | 'commodities' | 'futures' | 'synthetic';

export const detectAssetType = (pair: string): AssetType => {
  const p = pair.toUpperCase().trim();
  
  // Synthetics (Deriv) - Added support for common MT5 truncations or spaces
  if (
    p.includes('VOLATILITY') || p.includes('BOOM') || p.includes('CRASH') || 
    p.includes('STEP INDEX') || p.includes('JUMP INDEX') || p.includes('DEX') ||
    p.includes('RANGE BREAK') || p.match(/^V\d{1,3}/) || p.match(/^[BC]\d{3,4}/) ||
    p.includes('1S') || p.includes('SYNTHETIC') || p.includes('ATILITY') || p.includes('INDEX')
  ) {
    // If it's a known index symbol but not a synthetic, let indices check catch it later
    const isMajorIndex = p.includes('US30') || p.includes('NAS') || p.includes('US100') || p.includes('SPX');
    if (!isMajorIndex) return 'synthetic';
  }

  // Indices
  if (
    p.includes('NAS') || p.includes('NDX') || p.includes('USTEC') || p.includes('US100') || p.includes('NASDAQ') ||
    p.includes('US30') || p.includes('WS30') || p.includes('DOW') || p.includes('DJIA') || p.includes('WALLSTREET') ||
    p.includes('SPX') || p.includes('US500') || p.includes('SP500') || p.includes('WALL STREET') ||
    p.includes('GER') || p.includes('DE30') || p.includes('DE40') || p.includes('DAX') ||
    p.includes('UK100') || p.includes('FTSE') || p.includes('Z30') || p.includes('E30') ||
    p.includes('FRA40') || p.includes('CAC') || p.includes('F40') ||
    p.includes('JP225') || p.includes('NI225') || p.includes('NIKKEI') ||
    p.includes('HK50') || p.includes('HSI') || p.includes('CHINA50') ||
    p.includes('ESP35') || p.includes('IBEX') ||
    p.includes('EUSTX') || p.includes('STOXX') || p.includes('VIX')
  ) {
    return 'indices';
  }

  // Commodities & Metals
  if (
    p.includes('XAU') || p.includes('GOLD') || p.includes('XAG') || p.includes('SILVER') ||
    p.includes('XPT') || p.includes('XPD') || p.includes('PLATINUM') || p.includes('PALLADIUM') ||
    p.includes('WTI') || p.includes('OIL') || p.includes('BRENT') || p.includes('UKOIL') || p.includes('USOIL') ||
    p.includes('NGAS') || p.includes('NATURAL GAS') || p.includes('COPPER') || p.includes('XCU')
  ) {
    return 'commodities';
  }

  // Crypto
  if (
    p.includes('BTC') || p.includes('BITCOIN') || p.includes('ETH') || p.includes('ETHEREUM') || 
    p.includes('SOL') || p.includes('XRP') || p.includes('DOGE') || p.includes('CRYPTO') ||
    p.includes('LTC') || p.includes('BNB') || p.includes('ADA') || p.includes('DOT') ||
    p.includes('AVAX') || p.includes('LINK') || p.includes('UNI')
  ) {
    return 'crypto';
  }

  return 'forex';
};

export const getAssetSettings = (pair: string, assetType?: AssetType): AssetSettings => {
  const p = pair.toUpperCase().trim();
  const type = assetType || detectAssetType(p);
  
  if (type === 'synthetic') {
    return { multiplier: 1, pipFactor: 1, label: 'Points' };
  }

  if (type === 'indices') {
    return { multiplier: 1, pipFactor: 1, label: 'Points' };
  }

  if (type === 'commodities') {
    if (p.includes('XAU') || p.includes('GOLD')) {
      // Logic for Micro vs Standard gold
      if (p.includes('MICRO') || p.includes('CENT') || p.includes('M')) {
        return { multiplier: 1, pipFactor: 10, label: 'Pips' };
      }
      return { multiplier: 100, pipFactor: 10, label: 'Pips' };
    }
    if (p.includes('XAG') || p.includes('SILVER')) return { multiplier: 50, pipFactor: 100, label: 'Pips' }; // 50 for 1.0 lot, 0.01 silver move is $0.50? Usually $50 per $1 move for 1 lot. 
    // Gold: 1.0 Lot, $1 move = $100. Silver: 1.0 Lot, $1 move = $5000 (standard) or $50 (CFD). MT5 common is $50.
    if (p.includes('WTI') || p.includes('OIL') || p.includes('BRENT') || p.includes('UKOIL') || p.includes('USOIL')) {
      return { multiplier: 1000, pipFactor: 100, label: 'Pips' }; // 1.0 Lot, $1 move = $1000
    }
    return { multiplier: 100, pipFactor: 1, label: 'Points' };
  }

  if (type === 'crypto') {
    return { multiplier: 1, pipFactor: 1, label: 'Points' };
  }

  if (type === 'futures') {
    return { multiplier: 1, pipFactor: 1, label: 'Ticks' };
  }

  // Forex
  if (p.includes('JPY')) return { multiplier: 1000, pipFactor: 100, label: 'Pips' };
  return { multiplier: 100000, pipFactor: 10000, label: 'Pips' };
};

export const calculateTradeStats = (
  pair: string, 
  direction: 'buy' | 'sell', 
  entryPrice: number, 
  exitPrice?: number, 
  stopLoss?: number, 
  takeProfit?: number, 
  lotSize?: number,
  assetType?: AssetType
) => {
  const settings = getAssetSettings(pair, assetType);
  let pips = 0;
  let riskAmount = 0;
  let rewardAmount = 0;
  let rrRatio = 0;

  if (exitPrice !== undefined && !isNaN(exitPrice)) {
    const diff = direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
    pips = parseFloat((diff * settings.pipFactor).toFixed(1));
  }

  const lots = lotSize || 1;
  const pnlMultiplier = settings.multiplier;

  if (stopLoss !== undefined && !isNaN(stopLoss) && stopLoss > 0) {
    const riskDiff = direction === 'buy' ? entryPrice - stopLoss : stopLoss - entryPrice;
    riskAmount = Math.abs(riskDiff * lots * settings.multiplier);
  }

  if (takeProfit !== undefined && !isNaN(takeProfit) && takeProfit > 0) {
    const rewardDiff = direction === 'buy' ? takeProfit - entryPrice : entryPrice - takeProfit;
    rewardAmount = Math.abs(rewardDiff * lots * settings.multiplier);
  } else if (exitPrice !== undefined && !isNaN(exitPrice)) {
    // Realized RR if trade is closed but TP was not set
    const rewardDiff = direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
    rewardAmount = Math.max(0, rewardDiff * lots * settings.multiplier);
  }

  if (riskAmount > 0.0000001 && rewardAmount > 0) {
    rrRatio = parseFloat((rewardAmount / riskAmount).toFixed(2));
  }

  return {
    pips,
    label: settings.label,
    risk: parseFloat(riskAmount.toFixed(2)),
    reward: parseFloat(rewardAmount.toFixed(2)),
    rr: rrRatio,
    pnl: exitPrice !== undefined ? parseFloat(((direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice) * lots * pnlMultiplier).toFixed(2)) : 0
  };
};
