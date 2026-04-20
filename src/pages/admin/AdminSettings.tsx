import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Settings, Cpu, CreditCard, ShieldCheck, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { motion } from 'motion/react';
import { OperationType, handleFirestoreError } from '../../lib/db';

interface AppSettings {
  maintenanceMode: boolean;
  aiModel: string;
  defaultCredits: number;
  superAdmins: string[];
  exchangeRate: number;
  arakaUsdPageId: string;
  arakaCdfPageId: string;
  updatedAt: any;
}

export default function AdminSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSuperAdmin, setNewSuperAdmin] = useState('');

  useEffect(() => {
    if (!profile) return;

    const unsubscribe = onSnapshot(doc(db, 'app_settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          ...data,
          exchangeRate: data.exchangeRate || 2800,
          arakaUsdPageId: data.arakaUsdPageId || '',
          arakaCdfPageId: data.arakaCdfPageId || '',
        } as AppSettings);
      } else {
        // Initialize default settings if they don't exist
        const defaultSettings: AppSettings = {
          maintenanceMode: false,
          aiModel: 'gemini-1.5-pro',
          defaultCredits: 10,
          superAdmins: ['kongolmandf@gmail.com'],
          exchangeRate: 2800,
          arakaUsdPageId: '',
          arakaCdfPageId: '',
          updatedAt: serverTimestamp()
        };
        setDoc(doc(db, 'app_settings', 'global'), defaultSettings);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'app_settings/global');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleUpdate = async (field: keyof AppSettings, value: any) => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'app_settings', 'global'), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const addSuperAdmin = async () => {
    if (!settings || !newSuperAdmin || !newSuperAdmin.includes('@')) return;
    const updated = [...(settings.superAdmins || []), newSuperAdmin.toLowerCase().trim()];
    await handleUpdate('superAdmins', updated);
    setNewSuperAdmin('');
  };

  const removeSuperAdmin = async (email: string) => {
    if (!settings || email === 'kongolmandf@gmail.com') return;
    const updated = settings.superAdmins.filter(e => e !== email);
    await handleUpdate('superAdmins', updated);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-zoya-red" /></div>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Paramètres Système</h1>
        <p className="text-gray-500 dark:text-gray-400">Contrôlez les options globales de l'application et de l'IA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Super Admins Management */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Super Administrateurs (Secours)</h2>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Seuls ces comptes peuvent se connecter via Google. Les autres administrateurs/agents doivent utiliser Email/Mot de passe.
            </p>
            
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email@exemple.com"
                value={newSuperAdmin}
                onChange={(e) => setNewSuperAdmin(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              />
              <button
                onClick={addSuperAdmin}
                className="px-6 py-3 bg-zoya-red text-white rounded-2xl font-bold hover:bg-zoya-red/90 transition-all"
              >
                Ajouter
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settings?.superAdmins?.map((email) => (
                <div key={email} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate mr-2">{email}</span>
                  {email !== 'kongolmandf@gmail.com' && (
                    <button
                      onClick={() => removeSuperAdmin(email)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                    >
                      <AlertTriangle size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Control */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600">
              <Cpu size={24} />
            </div>
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Contrôle de l'IA</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Modèle Actif</label>
              <select
                value={settings?.aiModel}
                onChange={(e) => handleUpdate('aiModel', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              >
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Expert)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rapide)</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Crédits par Défaut (Nouveaux Users)</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={settings?.defaultCredits}
                  onChange={(e) => handleUpdate('defaultCredits', parseInt(e.target.value))}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                />
                <CreditCard className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Global Security / Status */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-600">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Sécurité Globale</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Mode Maintenance</p>
                <p className="text-xs text-gray-500">Bloque l'accès aux utilisateurs. Super Admin, Admins et Agents autorisés conservent l'accès.</p>
              </div>
              <button
                onClick={() => handleUpdate('maintenanceMode', !settings?.maintenanceMode)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  settings?.maintenanceMode ? "bg-zoya-red" : "bg-gray-300 dark:bg-gray-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  settings?.maintenanceMode ? "right-1" : "left-1"
                )} />
              </button>
            </div>

            {settings?.maintenanceMode && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                  Attention : Le mode maintenance est actif. Seuls le Super Admin, les Administrateurs et les Agents avec accès spécial peuvent accéder à l'application.
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Payment Configuration */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
              <CreditCard size={24} />
            </div>
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Configuration Paiements (Araka)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Taux de Change (1 USD en CDF)</label>
              <input
                type="number"
                value={settings?.exchangeRate || 2800}
                onChange={(e) => handleUpdate('exchangeRate', parseFloat(e.target.value))}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              />
            </div>
            {/* Keeping spacing */}
            <div className="hidden md:block"></div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Page ID Araka (USD)</label>
              <input
                type="text"
                value={settings?.arakaUsdPageId || ''}
                placeholder="Ex: xxx-xxxx-xxxx-xxxx"
                onBlur={(e) => handleUpdate('arakaUsdPageId', e.target.value)}
                onChange={(e) => setSettings({ ...settings, arakaUsdPageId: e.target.value } as AppSettings)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Page ID Araka (CDF)</label>
              <input
                type="text"
                value={settings?.arakaCdfPageId || ''}
                placeholder="Ex: xxx-xxxx-xxxx-xxxx"
                onBlur={(e) => handleUpdate('arakaCdfPageId', e.target.value)}
                onChange={(e) => setSettings({ ...settings, arakaCdfPageId: e.target.value } as AppSettings)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Ces Page IDs permettent d'activer le paiement multidevise. Si vide, le système utilisera la variable d'environnement de fallback.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg">
        <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-4">Dernière Mise à Jour</h3>
        <p className="text-sm text-gray-500">
          Les paramètres globaux ont été modifiés pour la dernière fois le : 
          <span className="font-bold text-gray-900 dark:text-white ml-2">
            {settings?.updatedAt?.toDate() ? settings.updatedAt.toDate().toLocaleString() : 'Inconnu'}
          </span>
        </p>
      </div>
    </div>
  );
}
