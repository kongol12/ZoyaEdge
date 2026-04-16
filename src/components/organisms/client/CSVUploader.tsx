import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth';
import { importTrades, Trade } from '../../../lib/db';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { UploadCloud, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';

type Platform = 'MT4' | 'MT5' | 'TradeLocker' | 'CTrader' | 'TradingView' | 'Tradovate' | 'NinjaTrader';

const PLATFORMS: { id: Platform; name: string; formats: string; logo: string; fallbackColor: string }[] = [
  { id: 'MT4', name: 'MetaTrader 4', formats: '.csv,.txt,.html', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/MetaTrader_4_logo.png/120px-MetaTrader_4_logo.png', fallbackColor: 'bg-blue-600' },
  { id: 'MT5', name: 'MetaTrader 5', formats: '.csv,.txt,.html', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/MetaTrader_5_logo.png/120px-MetaTrader_5_logo.png', fallbackColor: 'bg-blue-700' },
  { id: 'TradeLocker', name: 'TradeLocker', formats: '.csv', logo: 'https://tradelocker.com/wp-content/uploads/2023/06/tradelocker-logo.svg', fallbackColor: 'bg-indigo-600' },
  { id: 'CTrader', name: 'cTrader', formats: '.csv,.xlsx', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/CTrader_logo.png/120px-CTrader_logo.png', fallbackColor: 'bg-green-600' },
  { id: 'TradingView', name: 'TradingView', formats: '.csv', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/TradingView_logo.svg/120px-TradingView_logo.svg.png', fallbackColor: 'bg-black' },
  { id: 'Tradovate', name: 'Tradovate', formats: '.csv', logo: '', fallbackColor: 'bg-blue-500' },
  { id: 'NinjaTrader', name: 'NinjaTrader', formats: '.csv', logo: '', fallbackColor: 'bg-green-700' },
];

export default function CSVUploader() {
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

    const typeStr = String(getVal(['type', 'action', 'side', 'direction']) || '').toLowerCase();
    
    let direction: 'buy' | 'sell' = 'buy';
    if (typeStr.includes('sell') || typeStr.includes('short')) direction = 'sell';
    else if (typeStr.includes('buy') || typeStr.includes('long')) direction = 'buy';

    const symbol = String(getVal(['symbol', 'item', 'market', 'instrument', 'pair']) || 'UNKNOWN').toUpperCase();
    
    const entryPriceStr = getVal(['open price', 'entry price', 'price', 'avg price', 'fill price']);
    const exitPriceStr = getVal(['close price', 'exit price', 'price']);
    
    const entryPrice = parseFloat(String(entryPriceStr).replace(/,/g, '')) || 0;
    const exitPrice = parseFloat(String(exitPriceStr).replace(/,/g, '')) || entryPrice;

    const lotSizeStr = getVal(['size', 'volume', 'qty', 'quantity']);
    const lotSize = parseFloat(String(lotSizeStr).replace(/,/g, '')) || 0;

    const pnlStr = getVal(['profit', 'pnl', 'net pnl', 'gross pnl', 'realized pnl', 'net']);
    const pnl = parseFloat(String(pnlStr).replace(/,/g, '').replace(/ /g, '')) || 0;

    const dateStr = getVal(['time', 'open time', 'date', 'close time']);
    const date = parseDate(String(dateStr));

    if (symbol === 'UNKNOWN' && pnl === 0 && lotSize === 0) return null;

    return {
      pair: symbol,
      direction,
      entryPrice,
      exitPrice,
      lotSize,
      pnl,
      strategy: `Import ${platform}`,
      emotion: '😐',
      session: 'London',
      date,
      platform,
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
      setTimeout(() => navigate('/'), 1500);
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
                    className="w-12 h-12 object-contain group-hover:scale-110 transition-transform"
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

