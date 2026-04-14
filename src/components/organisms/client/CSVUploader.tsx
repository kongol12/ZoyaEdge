import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth';
import { importTrades, Trade } from '../../../lib/db';
import Papa from 'papaparse';
import { UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';

export default function CSVUploader() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parseMT5Date = (dateStr: string) => {
    if (!dateStr) return new Date();
    // MT5 often uses YYYY.MM.DD HH:MM:SS
    const normalized = dateStr.replace(/\./g, '-');
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const trades: Omit<Trade, 'id' | 'userId' | 'createdAt'>[] = [];
          const rawData = results.data as any[];

          if (rawData.length === 0) {
            throw new Error(t.dashboard.emptyFile);
          }

          for (const row of rawData) {
            // MT5 CSV columns can vary, we check common variations
            const type = (row.Type || row['Type'] || '').toLowerCase();
            
            // Only process buy/sell orders, skip balance/credit/etc.
            if (!type.includes('buy') && !type.includes('sell')) continue;

            const symbol = row.Symbol || row['Item'] || 'UNKNOWN';
            const entryPrice = parseFloat(row['Price'] || row['Open Price'] || '0');
            const exitPrice = parseFloat(row['Close Price'] || row['Price'] || '0'); // Heuristic
            const lotSize = parseFloat(row.Size || row.Volume || '0');
            const pnl = parseFloat(row.Profit || '0');
            const dateStr = row.Time || row['Open Time'] || row['Date'];

            // Validation de base
            if (symbol === 'UNKNOWN' || isNaN(entryPrice) || isNaN(pnl) || lotSize <= 0) {
              console.warn("Ligne ignorée car invalide:", row);
              continue;
            }

            trades.push({
              pair: symbol.toUpperCase(),
              direction: type.includes('buy') ? 'buy' : 'sell',
              entryPrice,
              exitPrice: exitPrice || entryPrice, // Fallback if exit price not found
              lotSize,
              pnl,
              strategy: 'Import MT5',
              emotion: '😐',
              session: 'London', // Default session
              date: parseMT5Date(dateStr),
            });
          }

          if (trades.length === 0) {
            throw new Error(t.dashboard.noValidTrades);
          }

          await importTrades(user.uid, trades);
          setSuccess(`${trades.length} ${t.dashboard.importSuccess}`);
          setTimeout(() => navigate('/'), 1500);
        } catch (err: any) {
          setError(err.message || t.dashboard.importError);
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(`${t.dashboard.fileReadError} ${err.message}`);
        setLoading(false);
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg text-center">
      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
        <UploadCloud size={32} className="text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-2">{t.dashboard.importMT5}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-sm mx-auto">
        {t.dashboard.importMT5Desc}
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

      <label className="relative inline-flex items-center justify-center cursor-pointer bg-zoya-red text-white font-poppins font-bold py-3 px-6 rounded-2xl hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98]">
        {loading ? t.dashboard.processing : t.dashboard.selectFile}
        <input
          type="file"
          accept=".csv,.html,.xml"
          className="hidden"
          onChange={handleFileUpload}
          disabled={loading}
        />
      </label>
      
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {t.dashboard.importNote}
        </p>
      </div>
    </div>
  );
}

