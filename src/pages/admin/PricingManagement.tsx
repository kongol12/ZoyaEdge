import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CreditCard, Save, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { OperationType, handleFirestoreError } from '../../lib/db';

interface AppSettings {
  exchangeRate: number;
  arakaUsdPageId: string;
  arakaCdfPageId: string;
  discoveryMonthlyUSD: number;
  discoveryYearlyUSD: number;
  proMonthlyUSD: number;
  proYearlyUSD: number;
  premiumMonthlyUSD: number;
  premiumYearlyUSD: number;
  globalDiscount: number;
  transactionFee: number; // Now as percentage
  vatRate: number; // Added VAT Rate
  updatedAt: any;
}

export default function PricingManagement() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPageIds, setShowPageIds] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const unsubscribe = onSnapshot(doc(db, 'app_settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          exchangeRate: data.exchangeRate || 2800,
          arakaUsdPageId: data.arakaUsdPageId || '',
          arakaCdfPageId: data.arakaCdfPageId || '',
          discoveryMonthlyUSD: data.discoveryMonthlyUSD ?? 0,
          discoveryYearlyUSD: data.discoveryYearlyUSD ?? 0,
          proMonthlyUSD: data.proMonthlyUSD ?? 20,
          proYearlyUSD: data.proYearlyUSD ?? 200,
          premiumMonthlyUSD: data.premiumMonthlyUSD ?? 50,
          premiumYearlyUSD: data.premiumYearlyUSD ?? 500,
          globalDiscount: data.globalDiscount ?? 0,
          transactionFee: data.transactionFee ?? 2,
          vatRate: data.vatRate ?? 16, // Default TVA 16%
          updatedAt: data.updatedAt
        } as AppSettings);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'app_settings/global');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'app_settings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      alert("Configurations de tarification enregistrées avec succès !");
    } catch (error) {
      console.error("Error updating pricing settings:", error);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-zoya-red" /></div>;

  return (
    <div className="space-y-8 max-w-5xl">
       <div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Tarification & Finance</h1>
        <p className="text-gray-500 dark:text-gray-400">Gérez les prix des abonnements, les taux de change et les passerelles de paiement.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
            <CreditCard size={24} />
          </div>
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Grille Tarifaire</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Taux et Réduction */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Taux de Change (1 USD en CDF)</label>
              <input
                type="number"
                value={settings?.exchangeRate || 2800}
                onChange={(e) => setSettings({ ...settings, exchangeRate: parseFloat(e.target.value) } as AppSettings)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Réduction Globale (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings?.globalDiscount || 0}
                  onChange={(e) => setSettings({ ...settings, globalDiscount: parseFloat(e.target.value) } as AppSettings)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Frais ZoyaPay (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings?.transactionFee || 0}
                  step="0.1"
                  onChange={(e) => setSettings({ ...settings, transactionFee: parseFloat(e.target.value) } as AppSettings)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">TVA (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings?.vatRate || 0}
                  step="0.1"
                  onChange={(e) => setSettings({ ...settings, vatRate: parseFloat(e.target.value) } as AppSettings)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
              </div>
            </div>
          </div>

          {[
            { id: 'discovery', label: 'DISCOVERY', color: 'bg-emerald-500' },
            { id: 'pro', label: 'Plan PRO', color: 'bg-blue-500' },
            { id: 'premium', label: 'PREMIUM', color: 'bg-amber-500' }
          ].map((plan) => (
            <div key={plan.id} className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl space-y-4 border border-gray-100 dark:border-gray-800">
              <h3 className="font-poppins font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", plan.color)} /> {plan.label}
              </h3>
              {plan.id === 'discovery' && <p className="text-[10px] text-gray-500">Mettez 0 pour "Gratuit".</p>}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Mensuel (USD)</label>
                <input
                  type="number"
                  value={settings?.[`${plan.id}MonthlyUSD` as keyof AppSettings] as number}
                  onChange={(e) => setSettings({ ...settings, [`${plan.id}MonthlyUSD`]: parseFloat(e.target.value) } as any)}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                />
                {plan.id !== 'discovery' && (
                   <p className="text-[10px] text-gray-500 mt-1">≈ {((settings?.[`${plan.id}MonthlyUSD` as keyof AppSettings] as number || 0) * (settings?.exchangeRate || 1)).toLocaleString()} CDF</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Annuel (USD)</label>
                <input
                  type="number"
                  value={settings?.[`${plan.id}YearlyUSD` as keyof AppSettings] as number}
                  onChange={(e) => setSettings({ ...settings, [`${plan.id}YearlyUSD`]: parseFloat(e.target.value) } as any)}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                />
                {plan.id !== 'discovery' && (
                  <p className="text-[10px] text-gray-500 mt-1">≈ {((settings?.[`${plan.id}YearlyUSD` as keyof AppSettings] as number || 0) * (settings?.exchangeRate || 1)).toLocaleString()} CDF</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Page ID Araka (USD)</label>
              <button 
                onClick={() => setShowPageIds(!showPageIds)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPageIds ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input
              type={showPageIds ? "text" : "password"}
              value={settings?.arakaUsdPageId || ''}
              placeholder="Ex: xxx-xxxx-xxxx-xxxx"
              onChange={(e) => setSettings({ ...settings, arakaUsdPageId: e.target.value } as AppSettings)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Page ID Araka (CDF)</label>
              <button 
                onClick={() => setShowPageIds(!showPageIds)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPageIds ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input
              type={showPageIds ? "text" : "password"}
              value={settings?.arakaCdfPageId || ''}
              placeholder="Ex: xxx-xxxx-xxxx-xxxx"
              onChange={(e) => setSettings({ ...settings, arakaCdfPageId: e.target.value } as AppSettings)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
            />
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">Sécurité des Données Sensibles</p>
            <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Les <strong>Page IDs Araka</strong> sont isolés et protégés. Même s'ils sont configurables ici, ils ne sont jamais exposés aux navigateurs des clients finaux. Les paiements sont validés exclusivement via nos serveurs sécurisés. L'accès à cette configuration est limité aux administrateurs de haut niveau.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Save size={18} /> {saving ? "Enregistrement..." : "Enregistrer la Tarification"}
          </button>
        </div>
      </div>
    </div>
  );
}
