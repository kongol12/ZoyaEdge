import React, { useState } from 'react';
import TradeForm from '../../components/organisms/client/TradeForm';
import CSVUploader from '../../components/organisms/client/CSVUploader';
import { cn } from '../../lib/utils';
import { PlusCircle, Upload } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

export default function AddTrade() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'manual' | 'import'>('manual');

  return (
    <div className="max-w-4xl mx-auto w-full pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">{t.common.addTrade}</h1>
        <p className="text-zinc-500 dark:text-zinc-400">{t.common.chooseLogMethod}</p>
      </div>

      <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-8">
        <button
          onClick={() => setMode('manual')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
            mode === 'manual' 
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          )}
        >
          <PlusCircle size={18} />
          {t.common.manualEntry}
        </button>
        <button
          onClick={() => setMode('import')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
            mode === 'import' 
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          )}
        >
          <Upload size={18} />
          {t.common.importFile}
        </button>
      </div>

      {mode === 'manual' ? (
        <TradeForm />
      ) : (
        <CSVUploader />
      )}
    </div>
  );
}
