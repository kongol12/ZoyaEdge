import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth';
import { importTrades, Trade } from '../../../lib/db';
import { calculateTradeMetrics, normalizeSymbol } from '../../../lib/tradeCalculations';
import { getAssetDefinition } from '../../../lib/assetDatabase';
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
    const cleaned = String(dateStr).replace(/\u00a0/g, ' ').trim();
    
    // Try YYYY.MM.DD HH:mm:ss (or with / or -)
    if (/^\d{4}[\.\/-]\d{2}[\.\/-]\d{2}/.test(cleaned)) {
      return new Date(cleaned.replace(/[\.\/]/g, '-'));
    }
    
    // Try DD.MM.YYYY HH:mm:ss (or with / or -)
    const dmh = cleaned.match(/^(\d{2,4})[\.\/-](\d{2})[\.\/-](\d{2,4})/);
    if (dmh) {
      const [_, part1, m, part3] = dmh;
      // If part1 is 4 digits, it's YYYY-MM-DD
      if (part1.length === 4) {
        return new Date(cleaned.replace(/[\.\/]/g, '-'));
      }
      // Otherwise DD-MM-YYYY
      const d = part1;
      const y = part3;
      const timePart = cleaned.split(/\s+/)[1] || '00:00:00';
      return new Date(`${y}-${m}-${d}T${timePart.replace(/[\.\/]/g, ':')}`);
    }
    
    const date = new Date(cleaned.replace(/\./g, '-'));
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (rows.length < 2) {
              resolve([]);
              return;
            }

            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(rows.length, 20); i++) {
              const row = rows[i];
              if (!row) continue;
              const cellTexts = row.map(c => String(c || '').toLowerCase().trim());
              const hasSymbol = cellTexts.some(c => c.includes('symbol') || c.includes('symbole') || c.includes('ticket'));
              const hasProfit = cellTexts.some(c => c.includes('profit') || c.includes('résultat') || c.includes('gain') || c.includes('balance'));
              
              if (hasSymbol && hasProfit) {
                headerRowIndex = i;
                break;
              }
            }

            if (headerRowIndex === -1) {
              resolve(XLSX.utils.sheet_to_json(worksheet));
              return;
            }

            const rawHeaders = rows[headerRowIndex].map(h => String(h || '').trim());
            const uniqueHeaders: string[] = [];
            const counts: Record<string, number> = {};
            rawHeaders.forEach(h => {
              const h_clean = h || 'Column';
              const lowerH = h_clean.toLowerCase();
              if (!counts[lowerH]) {
                uniqueHeaders.push(h_clean);
                counts[lowerH] = 1;
              } else {
                uniqueHeaders.push(`${h_clean}_${counts[lowerH]}`);
                counts[lowerH]++;
              }
            });

            const jsonResults = rows.slice(headerRowIndex + 1).map(row => {
              const obj: any = {};
              uniqueHeaders.forEach((h, idx) => {
                if (row[idx] !== undefined) obj[h] = row[idx];
              });
              return obj;
            }).filter(obj => Object.keys(obj).length > 2);

            resolve(jsonResults);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const uint8 = new Uint8Array(buffer);
            let text = '';
            
            if (uint8[0] === 0xFF && uint8[1] === 0xFE) {
              text = new TextDecoder('utf-16le').decode(buffer);
            } else if (uint8[0] === 0xFE && uint8[1] === 0xFF) {
              text = new TextDecoder('utf-16be').decode(buffer);
            } else {
              let zeroCount = 0;
              const testLimit = Math.min(uint8.length, 1000);
              for (let i = 1; i < testLimit; i += 2) {
                if (uint8[i] === 0) zeroCount++;
              }
              if (zeroCount > (testLimit / 4)) {
                text = new TextDecoder('utf-16le').decode(buffer);
              } else {
                text = new TextDecoder('utf-8').decode(buffer);
              }
            }

            if (extension === 'html') {
              const parser = new DOMParser();
              const doc = parser.parseFromString(text, 'text/html');
              const tables = Array.from(doc.querySelectorAll('table'));
              let bestData: any[] = [];

              if (tables.length === 0) {
                 throw new Error("Aucune table de données trouvée dans le fichier HTML.");
              }
              
              tables.forEach(table => {
                const rows = Array.from(table.rows);
                if (rows.length < 2) return;
                
                let headerRowIndex = -1;
                let rawHeaders: string[] = [];
                
                for (let i = 0; i < Math.min(rows.length, 15); i++) {
                   const cellTexts = Array.from(rows[i].cells).map(c => c.innerText.replace(/\u00a0/g, ' ').trim().toLowerCase());
                   const hasSymbol = cellTexts.some(c => c.includes('symbol') || c.includes('symbole') || c.includes('ticket'));
                   const hasProfit = cellTexts.some(c => c.includes('profit') || c.includes('résultat') || c.includes('gain') || c.includes('balance'));
                   const hasType = cellTexts.some(c => c.includes('type') || c.includes('direction') || c.includes('action'));
                   
                   if (hasSymbol && (hasProfit || hasType)) {
                      headerRowIndex = i;
                      rawHeaders = Array.from(rows[i].cells).map(c => c.innerText.replace(/\u00a0/g, ' ').trim());
                      break;
                   }
                }
                
                if (headerRowIndex !== -1) {
                   const uniqueHeaders: string[] = [];
                   const counts: Record<string, number> = {};
                   rawHeaders.forEach(h => {
                     const lowerH = h.toLowerCase();
                     if (!counts[lowerH]) {
                       uniqueHeaders.push(h);
                       counts[lowerH] = 1;
                     } else {
                       uniqueHeaders.push(`${h}_${counts[lowerH]}`);
                       counts[lowerH]++;
                     }
                   });

                   const tableData = rows.slice(headerRowIndex + 1).map(row => {
                     const obj: any = {};
                     const cells = Array.from(row.cells);
                     
                     uniqueHeaders.forEach((h, idx) => {
                        if (cells[idx]) obj[h] = cells[idx].innerText.replace(/\u00a0/g, ' ').trim();
                     });
                     return obj;
                   }).filter(obj => Object.keys(obj).length > 2);
                   
                   if (tableData.length > bestData.length) {
                      bestData = tableData;
                   }
                }
              });

              if (bestData.length === 0) {
                 const largestTable = tables.reduce((prev, curr) => curr.rows.length > prev.rows.length ? curr : prev);
                 if (largestTable.rows.length > 2) {
                    const headers = Array.from(largestTable.rows[0].cells).map(c => c.innerText.trim() || 'Col');
                    bestData = Array.from(largestTable.rows).slice(1).map(row => {
                      const obj: any = {};
                      Array.from(row.cells).forEach((c, i) => {
                        if (headers[i]) obj[headers[i]] = c.innerText.trim();
                      });
                      return obj;
                    });
                 }
              }

              resolve(bestData);
            } else {
              Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
              });
            }
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
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
        const foundKey = Object.keys(normalizedRow).find(rk => rk === k || rk.includes(k));
        if (foundKey) return normalizedRow[foundKey];
      }
      return undefined;
    };

    const normalizeNumber = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      
      let str = String(val).replace(/\u00a0/g, ' ').trim();
      
      // Robust decimal detection for formats like "3 971,10" or "90 664,211"
      if (str.includes(' ') && str.includes(',')) {
        // Space is thousands, comma is decimal
        str = str.replace(/\s+/g, '').replace(',', '.');
      } else if (str.includes(' ') && str.includes('.')) {
        // Space is thousands, dot is decimal
        str = str.replace(/\s+/g, '');
      } else {
        // Existing logic for ambiguous cases
        const hasComma = str.includes(',');
        const hasDot = str.includes('.');
        
        if (hasComma && hasDot) {
          if (str.indexOf(',') < str.indexOf('.')) {
            str = str.replace(/,/g, ''); 
          } else {
            str = str.replace(/\./g, '').replace(',', '.');
          }
        } else if (hasComma) {
          const lastCommaIndex = str.lastIndexOf(',');
          if (str.length - lastCommaIndex <= 3 || str.split(',').length > 2) {
            str = str.replace(',', '.');
          } else {
            str = str.replace(',', '');
          }
        } else if (hasDot) {
          const lastDotIndex = str.lastIndexOf('.');
          if (str.length - lastDotIndex > 3 || str.split('.').length > 2) {
            str = str.replace(/\./g, '');
          }
        }
      }

      str = str.replace(/\s+/g, '').replace(/[^-0-9.]/g, '');
      return parseFloat(str) || 0;
    };

    const typeStr = String(getVal(['type', 'action', 'side', 'direction', 'side', 'type_1']) || '').toLowerCase();
    
    let type: 'trade' | 'deposit' | 'withdrawal' | 'adjustment' = 'trade';
    let direction: 'buy' | 'sell' = 'buy';

    if (typeStr.includes('deposit') || typeStr.includes('dépot') || typeStr.includes('dépôt') || typeStr.includes('credit')) {
      type = 'deposit';
    } else if (typeStr.includes('withdrawal') || typeStr.includes('retrait') || typeStr.includes('debit')) {
      type = 'withdrawal';
    } else if (typeStr.includes('balance') || typeStr.includes('solde') || typeStr.includes('correction')) {
      type = 'adjustment';
    }

    if (type === 'trade') {
      if (typeStr.includes('sell') || typeStr.includes('short') || typeStr.includes('vente')) direction = 'sell';
      else if (typeStr.includes('buy') || typeStr.includes('long') || typeStr.includes('achat')) direction = 'buy';
    }

    const symbol = String(getVal(['symbol', 'symbole', 'item', 'market', 'instrument', 'pair']) || (type !== 'trade' ? 'BALANCE' : 'UNKNOWN')).toUpperCase();
    
    const entryPriceStr = getVal(['open price', 'entry price', 'prix d\'ouverture', 'prix', 'open_price', 'entry_price', 'prix_1']);
    const exitPriceStr = getVal(['close price', 'exit price', 'prix de fermeture', 'prix_1', 'exit_price', 'close_price']) || entryPriceStr;
    
    const entryPrice = normalizeNumber(entryPriceStr);
    const exitPrice = normalizeNumber(exitPriceStr) || entryPrice;

    const lotSizeStr = getVal(['size', 'volume', 'qty', 'quantity', 'taille', 'v o l u m e']);
    const lotSize = normalizeNumber(lotSizeStr);

    const pnlStr = getVal(['profit', 'pnl', 'net pnl', 'gross pnl', 'realized pnl', 'net', 'amount', 'gain', 'résultat', 'benefice']);
    const pnlRaw = normalizeNumber(pnlStr);

    const commStr = getVal(['commission', 'comm', 'frais']);
    const swapStr = getVal(['swap', 'echange', 'échanges', 'èchanges', 'swap_1', 'echange_1']);
    const commission = normalizeNumber(commStr);
    const swap = normalizeNumber(swapStr);

    // Some MT5 reports already include commission and swap in the profit column.
    // However, usually "Profit" is raw and we should sum up. 
    // We'll trust the summed value for net.
    const netPnl = pnlRaw + commission + swap;

    const slStr = getVal(['sl', 'stoploss', 'stop loss', 'stop_loss', 's / l', 's/l']);
    const tpStr = getVal(['tp', 'takeprofit', 'take profit', 'take_profit', 't / p', 't/p']);
    const sl = normalizeNumber(slStr);
    const tp = normalizeNumber(tpStr);
    
    const dateStr = getVal(['time', 'heure', 'date', 'open time', 'heure_1', 'close time', 'timestamp']);
    const date = parseDate(String(dateStr));

    if (type === 'trade' && (symbol.trim() === 'UNKNOWN' || symbol.trim() === '') && Math.abs(netPnl) < 0.0001 && lotSize === 0) return null;
    if (type !== 'trade' && Math.abs(netPnl) < 0.0001) return null;

    const sTrim = symbol.trim();
    if (sTrim === 'BALANCE' || sTrim === 'DBASE') {
      type = netPnl >= 0 ? 'deposit' : 'withdrawal';
    }

    const normalizedPair = normalizeSymbol(symbol.trim());
    const asset = getAssetDefinition(normalizedPair);

    const tradeObj: any = {
      pair: normalizedPair,
      pnl: netPnl,
      type,
      strategy: type === 'trade' ? `Import ${platform}` : 'Balance Movement',
      emotion: '😐',
      session: 'other',
      date,
      platform,
      isDemo: false,
      hiddenByClient: false
    };

    if (type === 'trade') {
      const metrics = calculateTradeMetrics(
        normalizedPair,
        direction,
        entryPrice,
        exitPrice,
        lotSize,
        sl || undefined,
        tp || undefined
      );

      const positionId = getVal(['position', 'ticket', 'order', 'deal']);
      const openTimeStr = getVal(['time', 'heure', 'open time', 'heure_1', 'date']);
      const closeTimeStr = getVal(['heure_1', 'close time', 'time_1', 'date_1']);

      tradeObj.direction = direction;
      tradeObj.assetType = asset?.category || 'forex';
      tradeObj.entryPrice = entryPrice;
      tradeObj.exitPrice = exitPrice;
      tradeObj.lotSize = lotSize;
      tradeObj.stopLoss = sl || 0;
      tradeObj.takeProfit = tp || 0;

      tradeObj.pips = metrics.pips;
      tradeObj.risk = metrics.risk;
      tradeObj.reward = metrics.reward;
      tradeObj.rr = metrics.rr;
      tradeObj.pnl = metrics.pnl;
      tradeObj.label = metrics.label;

      tradeObj.commission = commission;
      tradeObj.swap = swap;
      tradeObj.positionId = positionId ? String(positionId) : undefined;
      tradeObj.openTime = openTimeStr ? parseDate(String(openTimeStr)) : date;
      tradeObj.closeTime = closeTimeStr ? parseDate(String(closeTimeStr)) : date;
    }

    return tradeObj;
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

