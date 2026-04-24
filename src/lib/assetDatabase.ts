/**
 * Base de données unifiée des actifs tradables (Deriv + TradingView)
 * Couvre : Forex, Indices, Commodities, Crypto, Synthetics, Futures
 */

export type AssetCategory = 'forex' | 'indices' | 'crypto' | 'commodities' | 'futures' | 'synthetic';
export type ContractType = 'spot' | 'cfds' | 'indices_cash' | 'crypto_spot' | 'futures' | 'options' | 'multipliers' | 'synthetic' | 'unknown';
export type Platform = 'mt5' | 'cTrader' | 'derivx' | 'derivtrader' | 'smarttrader' | 'derivgo' | 'tradingview';

export interface TradingHours {
  days: string;
  session: string;
  timezone: string;
  notes?: string;
}

export interface AssetDefinition {
  id: string;
  canonical: string;              // Nom normalisé unique (ex: "XAUUSD", "CME:6E1!")
  displayName: string;
  aliases: string[];              // Variantes de noms (ex: ["GOLD", "XAU/USD", "XAUUSD.i", "FX:XAUUSD"])
  category: AssetCategory;
  contractType: ContractType;
  platforms: Platform[];
  pipSize: number;
  pipValue: number;
  precision: number;
  lotSize: number;
  minLot: number;
  maxLot: number;
  isMicro: boolean;
  swapEnabled: boolean;           // False pour Synthetics et Futures
  tradingHours: TradingHours;
  tickSize?: number;              // Spécifique aux futures
}

export const ASSET_DATABASE: AssetDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FOREX
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fx_eurusd",
    canonical: "EURUSD",
    displayName: "Euro / US Dollar",
    aliases: ["EUR/USD", "EURUSD.i", "EURUSD#", "EUR USD", "FX:EURUSD"],
    category: "forex",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 0.0001,
    pipValue: 10,
    precision: 5,
    lotSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "fx_gbpusd",
    canonical: "GBPUSD",
    displayName: "British Pound / US Dollar",
    aliases: ["GBP/USD", "GBPUSD.i", "GBPUSD#", "GBP USD", "FX:GBPUSD", "CABLE"],
    category: "forex",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 0.0001,
    pipValue: 10,
    precision: 5,
    lotSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "fx_usdjpy",
    canonical: "USDJPY",
    displayName: "US Dollar / Japanese Yen",
    aliases: ["USD/JPY", "USDJPY.i", "USDJPY#", "USD JPY", "FX:USDJPY"],
    category: "forex",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 0.01,
    pipValue: 10,
    precision: 3,
    lotSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMODITIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "cmd_xauusd",
    canonical: "XAUUSD",
    displayName: "Gold Spot",
    aliases: ["GOLD", "XAU/USD", "XAUUSD.i", "GOLD#", "FX:XAUUSD", "GOLDSPOT"],
    category: "commodities",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 0.01,
    pipValue: 1,
    precision: 2,
    lotSize: 100,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "cmd_xauusdmicro",
    canonical: "XAUUSDmicro",
    displayName: "Gold Spot Micro",
    aliases: ["XAUUSDMicro", "XAUUSD MICRO", "GOLD MICRO", "FX:XAUUSDMICRO", "XAUUSD.micro"],
    category: "commodities",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 0.01,
    pipValue: 0.5,
    precision: 2,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 500,
    isMicro: true,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "cmd_tvc_usoil",
    canonical: "TVC:USOIL",
    displayName: "WTI Crude Oil",
    aliases: ["WTIUSD", "USOIL", "CL", "WTI", "CRUDEOIL"],
    category: "commodities",
    contractType: "cfds",
    platforms: ["tradingview"],
    pipSize: 0.01,
    pipValue: 10,
    precision: 2,
    lotSize: 1000,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDICES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "idx_nas100",
    canonical: "NAS100",
    displayName: "US Nasdaq 100",
    aliases: ["US100", "NQ100", "USTEC", "NASDAQ", "NDX"],
    category: "indices",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx"],
    pipSize: 1,
    pipValue: 1,
    precision: 1,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "idx_us30",
    canonical: "US30",
    displayName: "Wall Street 30",
    aliases: ["Wall Street 30", "DOW30", "DJ30", "US30", "DJI", "WS30"],
    category: "indices",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 1,
    pipValue: 1,
    precision: 1,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "idx_us500",
    canonical: "US500",
    displayName: "S&P 500",
    aliases: ["SPX", "SP500", "S&P500", "SP:SPX"],
    category: "indices",
    contractType: "cfds",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 1,
    pipValue: 1,
    precision: 1,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "Mon-Fri", session: "24h", timezone: "UTC" }
  },
  {
    id: "idx_lse_ukx",
    canonical: "LSE:UKX",
    displayName: "FTSE 100",
    aliases: ["UK100", "FTSE", "FTSE100"],
    category: "indices",
    contractType: "indices_cash",
    platforms: ["tradingview"],
    pipSize: 1,
    pipValue: 1,
    precision: 1,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: false, // Cash indices usually don't have rolling swaps like CFDs
    tradingHours: { days: "Mon-Fri", session: "market hours", timezone: "exchange-local" }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CRYPTO
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "crypto_btcusd",
    canonical: "BTCUSD",
    displayName: "Bitcoin / US Dollar",
    aliases: ["BTC/USD", "BITCOIN", "CRYPTO:BTCUSD", "BTC"],
    category: "crypto",
    contractType: "crypto_spot",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 1,
    pipValue: 1,
    precision: 2,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "24/7", session: "24h", timezone: "UTC" }
  },
  {
    id: "crypto_ethusd",
    canonical: "ETHUSD",
    displayName: "Ethereum / US Dollar",
    aliases: ["ETH/USD", "ETHEREUM", "CRYPTO:ETHUSD"],
    category: "crypto",
    contractType: "crypto_spot",
    platforms: ["mt5", "cTrader", "derivx", "tradingview"],
    pipSize: 0.01,
    pipValue: 1,
    precision: 2,
    lotSize: 1,
    minLot: 0.01,
    maxLot: 100,
    isMicro: false,
    swapEnabled: true,
    tradingHours: { days: "24/7", session: "24h", timezone: "UTC" }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNTHETICS (Deriv Only)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "synth_vol100",
    canonical: "VOLATILITY_100",
    displayName: "Volatility 100 Index",
    aliases: ["Volatility 100 Index", "V100", "VOL100"],
    category: "synthetic",
    contractType: "synthetic",
    platforms: ["mt5", "derivx", "derivtrader"],
    pipSize: 0.01,
    pipValue: 1,
    precision: 2,
    lotSize: 1,
    minLot: 0.1,
    maxLot: 500,
    isMicro: false,
    swapEnabled: false,
    tradingHours: { days: "24/7", session: "24h", timezone: "UTC" }
  },
  {
    id: "synth_boom1000",
    canonical: "BOOM_1000",
    displayName: "Boom 1000 Index",
    aliases: ["Boom 1000 Index", "B1000", "BOOM1000"],
    category: "synthetic",
    contractType: "synthetic",
    platforms: ["mt5", "derivx", "derivtrader"],
    pipSize: 0.01,
    pipValue: 1,
    precision: 2,
    lotSize: 1,
    minLot: 0.1,
    maxLot: 500,
    isMicro: false,
    swapEnabled: false,
    tradingHours: { days: "24/7", session: "24h", timezone: "UTC" }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURES (TradingView)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fut_cme_6e1",
    canonical: "CME:6E1!",
    displayName: "Euro FX Futures",
    aliases: ["6E1!", "EURO FX FUTURES"],
    category: "futures",
    contractType: "futures",
    platforms: ["tradingview"],
    pipSize: 0.00005,
    pipValue: 6.25,
    precision: 5,
    lotSize: 125000,
    minLot: 1,
    maxLot: 100,
    isMicro: false,
    swapEnabled: false,
    tradingHours: { days: "Sun-Fri", session: "nearly 24h", timezone: "exchange-local" },
    tickSize: 0.00005
  },
  {
    id: "fut_iceeur_tfn1",
    canonical: "ICEEUR:TFN1!",
    displayName: "Dutch TTF Natural Gas Futures",
    aliases: ["TFN1!", "TTF NATURAL GAS FUTURES"],
    category: "futures",
    contractType: "futures",
    platforms: ["tradingview"],
    pipSize: 0.01,
    pipValue: 10,
    precision: 3,
    lotSize: 1,
    minLot: 1,
    maxLot: 100,
    isMicro: false,
    swapEnabled: false,
    tradingHours: { days: "Mon-Fri", session: "exchange hours", timezone: "exchange-local" },
    tickSize: 0.01
  },
  {
    id: "fut_eurex_fdax1",
    canonical: "EUREX:FDAX1!",
    displayName: "DAX Futures",
    aliases: ["FDAX1!", "DAX FUTURES"],
    category: "indices",
    contractType: "futures",
    platforms: ["tradingview"],
    pipSize: 1,
    pipValue: 25,
    precision: 1,
    lotSize: 1,
    minLot: 1,
    maxLot: 100,
    isMicro: false,
    swapEnabled: false,
    tradingHours: { days: "Mon-Fri", session: "exchange hours", timezone: "exchange-local" },
    tickSize: 1
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalise un nom de symbole (retire les espaces, slashes, suffixes .i)
 * pour trouver la correspondance exacte dans la base unifiée
 */
export function normalizeSymbol(input: string): string {
  if (!input) return "";

  const cleaned = input.trim().toUpperCase();
  
  // Nettoyages initiaux : enlever '.i', '.I', ou '#' à la fin
  const baseCleaned = cleaned.replace(/\.[iI]$/, "").replace(/#$/, "");
  
  // Créer une version "compacte" pour la recherche profonde en ignorant la casse et les séparateurs
  const compact = baseCleaned.replace(/[\/\s.\-_]/g, "");

  // Recherche dans la base
  const found = ASSET_DATABASE.find(a => {
    // Check du canonical exact
    if (a.canonical.toUpperCase().replace(/[\/\s.\-_]/g, "") === compact) return true;
    
    // Check des alias
    return a.aliases.some(alias => {
      const aliasCompact = alias
        .toUpperCase()
        .replace(/\.[iI]$/, "")
        .replace(/#$/, "")
        .replace(/[\/\s.\-_]/g, "");
      return aliasCompact === compact;
    });
  });

  return found ? found.canonical : input.trim();
}

/**
 * Récupère la définition complète d'un actif via son nom (normalisé automatiquement)
 */
export function getAssetDefinition(symbol: string): AssetDefinition | null {
  const normalized = normalizeSymbol(symbol);
  return ASSET_DATABASE.find(a => a.canonical === normalized) || null;
}

/**
 * Filtre les actifs par catégorie
 */
export function getAssetsByCategory(category: AssetCategory): AssetDefinition[] {
  return ASSET_DATABASE.filter(a => a.category === category);
}

/**
 * Filtre les actifs supportés par une plateforme spécifique
 */
export function getAssetsByPlatform(platform: Platform): AssetDefinition[] {
  return ASSET_DATABASE.filter(a => a.platforms.includes(platform));
}

/**
 * Map inversée pour retrouver les alias depuis le canonical
 */
export const INVERSE_NORMALIZATION_MAP: Record<string, string[]> = ASSET_DATABASE.reduce((acc, asset) => {
  acc[asset.canonical] = [asset.canonical, ...asset.aliases];
  return acc;
}, {} as Record<string, string[]>);
