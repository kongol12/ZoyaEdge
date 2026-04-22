import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth';
import { importTrades, Trade } from '../../../lib/db';
import { calculateTradeStats, AssetType } from '../../../lib/tradeCalculations';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { UploadCloud, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';

type Platform = 'MT4' | 'MT5' | 'TradeLocker' | 'CTrader' | 'TradingView' | 'Tradovate' | 'NinjaTrader';

const PLATFORMS: { id: Platform; name: string; formats: string; logo: string; fallbackColor: string }[] = [
  { id: 'MT4', name: 'MetaTrader 4', formats: '.csv,.txt,.html', logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/MetaTrader_4_logo.png', fallbackColor: 'bg-blue-600' },
  { id: 'MT5', name: 'MetaTrader 5', formats: '.csv,.txt,.html', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/MetaTrader_5_logo.png', fallbackColor: 'bg-blue-700' },
  { id: 'TradeLocker', name: 'TradeLocker', formats: '.csv', logo: 'https://tradelocker.com/wp-content/uploads/2023/06/tradelocker-logo.svg', fallbackColor: 'bg-indigo-600' },
  { id: 'CTrader', name: 'cTrader', formats: '.csv,.xlsx', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/CTrader_logo.png', fallbackColor: 'bg-green-600' },
  { id: 'TradingView', name: 'TradingView', formats: '.csv', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/33/TradingView_logo.svg', fallbackColor: 'bg-black' },
  { id: 'Tradovate', name: 'Tradovate', formats: '.csv', logo: 'https://logos-world.net/wp-content/uploads/2021/04/Tradovate-Logo.png', fallbackColor: 'bg-blue-500' },
  { id: 'NinjaTrader', name: 'NinjaTrader', formats: '.csv', logo: 'https://ninjatrader.com/wp-content/uploads/2023/10/NinjaTrader-Logo.png', fallbackColor: 'bg-green-700' },
];

export default function CSVUploader({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    let normalized = String(dateStr).replace(/\./g, '-');
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      } else if (extension === 'html') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const tables = doc.querySelectorAll('table');
            let bestTable: HTMLTableElement | null = null;
            let maxRows = 0;
            
            tables.forEach(table => {
              if (table.rows.length > maxRows) {
                maxRows = table.rows.length;
                bestTable = table;
              }
            });

            if (!bestTable) {
              resolve([]);
              return;
            }

            const rows = Array.from(bestTable.rows);
            if (rows.length < 2) {
              resolve([]);
              return;
            }

            const headers = Array.from(rows[0].cells).map(c => c.innerText.trim());
            const data = rows.slice(1).map(row => {
              const obj: any = {};
              Array.from(row.cells).forEach((cell, i) => {
                if (headers[i]) obj[headers[i]] = cell.innerText.trim();
              });
              return obj;
            });
            resolve(data);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err)
        });
      }
    });
  };

  const extractTradeData = (row: any, platform: Platform): Partial<Trade> | null => {
    const normalizedRow: any = {};
    for (const key in row) {
      normalizedRow[key.toLowerCase().trim()] = row[key];
    }

    const getVal = (keys: string[]) => {
      for (const k of keys) {
        const foundKey = Object.keys(normalizedRow).find(rk => rk.includes(k));
        if (foundKey) return normalizedRow[foundKey];
      }
      return undefined;
    };

    const typeStr = String(getVal(['type', 'action', 'side', 'direction', 'comment']) || '').toLowerCase();
    
    let type: 'trade' | 'deposit' | 'withdrawal' | 'adjustment' = 'trade';
    let direction: 'buy' | 'sell' = 'buy';

    if (typeStr.includes('deposit') || typeStr.includes('depôt') || typeStr.includes('credit')) {
      type = 'deposit';
    } else if (typeStr.includes('withdrawal') || typeStr.includes('retrait') || typeStr.includes('debit')) {
      type = 'withdrawal';
    } else if (typeStr.includes('balance') || typeStr.includes('solde') || typeStr.includes('correction')) {
      type = 'adjustment';
    }

    if (type === 'trade') {
      if (typeStr.includes('sell') || typeStr.includes('short')) direction = 'sell';
      else if (typeStr.includes('buy') || typeStr.includes('long')) direction = 'buy';
    }

    const symbol = String(getVal(['symbol', 'item', 'market', 'instrument', 'pair']) || (type !== 'trade' ? 'BALANCE' : 'UNKNOWN')).toUpperCase();
    
    const entryPriceStr = getVal(['open price', 'entry price', 'price', 'avg price', 'fill price', 'open_price', 'entry_price']);
    const exitPriceStr = getVal(['close price', 'exit price', 'price', 'close_price', 'exit_price']);
    
    const entryPrice = parseFloat(String(entryPriceStr).replace(/[^0-9.-]/g, '')) || 0;
    const exitPrice = parseFloat(String(exitPriceStr).replace(/[^0-9.-]/g, '')) || entryPrice;

    const lotSizeStr = getVal(['size', 'volume', 'qty', 'quantity']);
    const lotSize = parseFloat(String(lotSizeStr).replace(/[^0-9.-]/g, '')) || 0;

    const pnlStr = getVal(['profit', 'pnl', 'net pnl', 'gross pnl', 'realized pnl', 'net', 'amount', 'gain']);
    const pnl = parseFloat(String(pnlStr).replace(/[^0-9.-]/g, '').replace(/ /g, '')) || 0;

    const slStr = getVal(['sl', 'stoploss', 'stop loss', 'stop_loss', 's/l']);
    const tpStr = getVal(['tp', 'takeprofit', 'take profit', 'take_profit', 't/p']);
    const sl = slStr ? parseFloat(String(slStr).replace(/[^0-9.-]/g, '')) : undefined;
    const tp = tpStr ? parseFloat(String(tpStr).replace(/[^0-9.-]/g, '')) : undefined;

    const dateStr = getVal(['time', 'open time', 'date', 'close time', 'open_time', 'close_time', 'timestamp']);
    const date = parseDate(String(dateStr));

    if (type === 'trade' && symbol.trim() === 'UNKNOWN' && pnl === 0 && lotSize === 0) return null;
    if (type !== 'trade' && pnl === 0) return null;

    // Double check if it's a deposit based on symbol (MT4/5 style)
    const sTrim = symbol.trim();
    if (sTrim === 'BALANCE' || sTrim === 'DBASE') {
      type = pnl >= 0 ? 'deposit' : 'withdrawal';
    }

    // Use shared calculation logic for R:R if it's a trade and we have SL/TP
    let risk = 0;
    let reward = 0;
    let rr = 0;

    // Detect Asset Type
    let assetType: AssetType = 'forex';
    const symbolStr = symbol.toUpperCase();
    if (symbolStr.includes('XAU') || symbolStr.includes('GOLD') || symbolStr.includes('OIL') || symbolStr.includes('WTI')) {
      assetType = 'commodities';
    } else if (symbolStr.includes('BTC') || symbolStr.includes('ETH') || symbolStr.includes('SOL')) {
      assetType = 'crypto';
    } else if (symbolStr.includes('NAS') || symbolStr.includes('US30') || symbolStr.includes('GER') || symbolStr.includes('DAX')) {
      assetType = 'indices';
    } else if (symbolStr.includes('VOLATILITY') || symbolStr.includes('BOOM') || symbolStr.includes('CRASH') || symbolStr.includes('INDEX')) {
      assetType = 'synthetic';
    }

    if (type === 'trade') {
      const calculated = calculateTradeStats(
        symbol,
        direction,
        entryPrice,
        exitPrice,
        sl,
        tp,
        lotSize,
        assetType
      );
      risk = calculated.risk;
      reward = calculated.reward;
      rr = calculated.rr;
    }

    return {
      pair: symbol.trim(),
      direction: type === 'trade' ? direction : undefined,
      assetType: type === 'trade' ? assetType : undefined,
      entryPrice: type === 'trade' ? entryPrice : 0,
      exitPrice: type === 'trade' ? exitPrice : 0,
      stopLoss: sl,
      takeProfit: tp,
      lotSize: type === 'trade' ? lotSize : 0,
      pnl,
      type,
      strategy: type === 'trade' ? `Import ${platform}` : 'Balance Movement',
      emotion: '😐',
      session: 'other',
      date,
      platform,
      risk,
      reward,
      rr
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedPlatform) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const rawData = await parseFile(file);
      
      if (rawData.length === 0) {
        throw new Error(t.dashboard.emptyFile || "Le fichier est vide ou invalide.");
      }

      const trades: Omit<Trade, 'id' | 'userId' | 'createdAt'>[] = [];

      for (const row of rawData) {
        const tradeData = extractTradeData(row, selectedPlatform);
        if (tradeData && tradeData.pair !== 'UNKNOWN') {
          trades.push(tradeData as Omit<Trade, 'id' | 'userId' | 'createdAt'>);
        }
      }

      if (trades.length === 0) {
        throw new Error(t.dashboard.noValidTrades || "Aucun trade valide trouvé dans ce fichier.");
      }

      await importTrades(user.uid, trades);
      setSuccess(`${trades.length} trades importés avec succès !`);
      
      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      } else {
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'importation.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!selectedPlatform) {
    return (
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white mb-2">Choisissez votre plateforme</h3>
          <p className="text-gray-500 dark:text-gray-400">Sélectionnez la plateforme d'où provient votre historique de trading.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => setSelectedPlatform(platform.id)}
              className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-zoya-red hover:shadow-lg hover:shadow-zoya-red/10 transition-all group"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 overflow-hidden ${!platform.logo ? platform.fallbackColor : 'bg-white dark:bg-gray-800'}`}>
                {platform.logo ? (
                  <img 
                    src={platform.logo} 
                    alt={platform.name} 
                    className={cn(
                      "w-12 h-12 object-contain group-hover:scale-110 transition-transform",
                      platform.id === 'TradingView' && "dark:invert"
                    )}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <span className={`text-white font-bold text-xl ${platform.logo ? 'hidden' : ''}`}>
                  {platform.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white mb-1">{platform.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{platform.formats}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const platformInfo = PLATFORMS.find(p => p.id === selectedPlatform);

  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg text-center relative">
      <button 
        onClick={() => {
          setSelectedPlatform(null);
          setError(null);
          setSuccess(null);
        }}
        className="absolute top-6 left-6 p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 rounded-full transition-colors"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-inner">
        {platformInfo?.logo ? (
          <img src={platformInfo.logo} alt={platformInfo.name} className="w-14 h-14 object-contain" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${platformInfo?.fallbackColor}`}>
            <span className="text-white font-bold text-2xl">{platformInfo?.name.substring(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>
      
      <h3 className="text-xl font-poppins font-black text-gray-900 dark:text-white mb-2">
        Importer depuis {platformInfo?.name}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 max-w-sm mx-auto">
        Formats acceptés : {platformInfo?.formats}
      </p>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-2xl text-sm font-medium flex items-center gap-2 justify-center">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-sm font-medium flex items-center gap-2 justify-center">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <label className="relative inline-flex items-center justify-center cursor-pointer bg-zoya-red text-white font-poppins font-bold py-4 px-8 rounded-2xl hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98] w-full max-w-xs mx-auto">
        <UploadCloud size={20} className="mr-2" />
        {loading ? "Traitement en cours..." : "Sélectionner le fichier"}
        <input
          ref={fileInputRef}
          type="file"
          accept={platformInfo?.formats}
          className="hidden"
          onChange={handleFileUpload}
          disabled={loading}
        />
      </label>
      
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Les données importées seront automatiquement analysées et ajoutées à vos statistiques ZoyaEdge.
        </p>
      </div>
    </div>
  );
}

