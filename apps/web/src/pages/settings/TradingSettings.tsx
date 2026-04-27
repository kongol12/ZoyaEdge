import React, { useEffect, useState } from 'react';
import { useAuth, UserProfile } from '@shared/lib/auth';
import { useTranslation } from '@shared/lib/i18n';
import { db } from '@shared/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Save, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { hardDeleteAllTrades } from '@shared/lib/db';

export default function TradingSettings() {
  const { user, updateProfile } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmHardDelete, setShowConfirmHardDelete] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  const handleResetJournal = async () => {
    if (!user) return;
    setResetting(true);
    try {
      await hardDeleteAllTrades(user.uid);
      setMessage({ type: 'success', text: 'Journal réinitialisé (tous les trades ont été supprimés définitivement).' });
      setShowConfirmReset(false);
    } catch (error) {
      console.error("Error resetting journal:", error);
      setMessage({ type: 'error', text: 'Erreur lors de la réinitialisation du journal.' });
    } finally {
      setResetting(false);
    }
  };

  const handleHardDeleteImports = async () => {
    if (!user) return;
    setHardDeleting(true);
    try {
      const idToken = await (user as any).getIdToken();
      const res = await fetch('/api/debug/imported-trades', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ type: 'success', text: `Suppression définitive réussie (${data.count} trades).` });
      } else {
        throw new Error(data.error);
      }
      setShowConfirmHardDelete(false);
    } catch (error) {
      console.error("Error deleting imported trades:", error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression des anciens imports.' });
    } finally {
      setHardDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(profile);
      setMessage({ type: 'success', text: t.common.save + ' success!' });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Error updating profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zoya-red" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-2xl">
            <SettingsIcon size={24} />
          </div>
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">{t.settings.tradingPrefs}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.settings.style}</label>
              <select
                value={profile?.tradingStyle || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, tradingStyle: e.target.value } : null)}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              >
                <option value="">Select...</option>
                <option value="Scalping">Scalping</option>
                <option value="Day Trading">Day Trading</option>
                <option value="Swing Trading">Swing Trading</option>
                <option value="Position Trading">Position Trading</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.settings.currency}</label>
              <select
                value={profile?.currency || 'USD'}
                onChange={e => setProfile(prev => prev ? { ...prev, currency: e.target.value } : null)}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.settings.risk}</label>
              <input
                type="number"
                step="0.1"
                value={profile?.defaultRisk || ''}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  setProfile(prev => prev ? { ...prev, defaultRisk: val || 0 } : null);
                }}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.settings.lotSize}</label>
              <input
                type="number"
                step="0.01"
                value={profile?.defaultLotSize || ''}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  setProfile(prev => prev ? { ...prev, defaultLotSize: val || 0 } : null);
                }}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Solde Initial du Compte ($)</label>
              <input
                type="number"
                value={profile?.initialBalance || ''}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  setProfile(prev => prev ? { ...prev, initialBalance: val || 0 } : null);
                }}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Affichage Calendrier</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-gray-900 dark:text-white">Afficher le P&L</label>
                  <p className="text-xs text-gray-500">Affiche le gain/perte total de la journée sur chaque case.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfile(prev => prev ? { ...prev, calendarShowPnL: !prev.calendarShowPnL } : null)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zoya-red focus:ring-offset-2",
                    profile?.calendarShowPnL !== false ? "bg-zoya-red" : "bg-gray-200 dark:bg-gray-700"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    profile?.calendarShowPnL !== false ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-gray-900 dark:text-white">Afficher les Trades</label>
                  <p className="text-xs text-gray-500">Affiche les détails compacts des trades sur les cases (Bureau).</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfile(prev => prev ? { ...prev, calendarShowTrades: !prev.calendarShowTrades } : null)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zoya-red focus:ring-offset-2",
                    profile?.calendarShowTrades !== false ? "bg-zoya-red" : "bg-gray-200 dark:bg-gray-700"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    profile?.calendarShowTrades !== false ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl text-sm font-medium ${
              message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-zoya-red text-white py-3 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
            {saving ? t.common.saving : t.common.save}
          </button>
        </form>
      </motion.section>

      {/* Danger Zone */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-rose-100 dark:border-rose-900/30 overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Trash2 size={120} className="text-rose-600" />
        </div>

        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-poppins font-black text-rose-600">Zone de Danger</h2>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20">
            <div>
              <h3 className="font-bold text-rose-900 dark:text-rose-100">Réinitialiser le Journal</h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                Cette action supprimera définitivement tous vos trades actuels de la base de données. Cette opération est irréversible.
              </p>
            </div>
            {!showConfirmReset ? (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md shadow-rose-600/20 whitespace-nowrap"
              >
                Réinitialiser
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-300 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetJournal}
                  disabled={resetting}
                  className="px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
                >
                  {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Confirmer
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-100">Suppression Définitive (Fichiers Importés)</h3>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                Supprime de manière <span className="font-bold underline">irréversible</span> de la base de données tous vos anciens imports (CSV, HTML, XLSX). Ne supprime pas les trades de l'EA.
              </p>
            </div>
            {!showConfirmHardDelete ? (
              <button
                onClick={() => setShowConfirmHardDelete(true)}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-md shadow-red-600/20 whitespace-nowrap"
              >
                Supprimer Définitivement
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmHardDelete(false)}
                  className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-300 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleHardDeleteImports}
                  disabled={hardDeleting}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-md shadow-red-600/20 flex items-center gap-2"
                >
                  {hardDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Je supprime à jamais
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
