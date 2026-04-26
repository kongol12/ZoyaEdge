import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Settings, Cpu, CreditCard, ShieldCheck, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { OperationType, handleFirestoreError } from '../../lib/db';

interface AppSettings {
  maintenanceMode: boolean;
  aiModel: string;
  defaultCredits: number;
  superAdmins: string[];
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

    const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();
    const unsubscribe = onSnapshot(doc(db, 'app_settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          maintenanceMode: data.maintenanceMode || false,
          aiModel: data.aiModel || 'gemini-1.5-pro',
          defaultCredits: data.defaultCredits || 10,
          superAdmins: data.superAdmins || [PRIMARY_EMAIL],
          updatedAt: data.updatedAt
        } as AppSettings);
      } else {
        // Initialize default settings if they don't exist
        const defaultSettings: AppSettings = {
          maintenanceMode: false,
          aiModel: 'gemini-1.5-pro',
          defaultCredits: 10,
          superAdmins: [PRIMARY_EMAIL],
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
    const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();
    if (!settings || email.toLowerCase() === PRIMARY_EMAIL) return;
    const updated = settings.superAdmins.filter(e => e.toLowerCase() !== email.toLowerCase());
    await handleUpdate('superAdmins', updated);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-zoya-red" /></div>;

  const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();

  return (
    <div className="space-y-6 md:space-y-8 max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white">Paramètres Système</h1>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Contrôlez les options globales de l'application et de l'IA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Super Admins Management */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl md:rounded-2xl flex items-center justify-center text-amber-600">
              <ShieldCheck size={20} />
            </div>
            <h2 className="text-lg md:text-xl font-poppins font-black text-gray-900 dark:text-white">Super Administrateurs</h2>
          </div>

          <div className="space-y-4">
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              Seuls ces comptes peuvent se connecter via Google.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="email@exemple.com"
                value={newSuperAdmin}
                onChange={(e) => setNewSuperAdmin(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 font-bold text-sm md:text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              />
              <button
                onClick={addSuperAdmin}
                className="w-full sm:w-auto px-6 py-3 bg-zoya-red text-white rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest hover:bg-zoya-red/90 transition-all"
              >
                Ajouter
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settings?.superAdmins?.map((email) => (
                <div key={email} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate mr-2">{email}</span>
                  {email.toLowerCase() !== PRIMARY_EMAIL && (
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
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl md:rounded-2xl flex items-center justify-center text-indigo-600">
              <Cpu size={20} />
            </div>
            <h2 className="text-lg md:text-xl font-poppins font-black text-gray-900 dark:text-white">Contrôle de l'IA</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Modèle Actif</label>
              <select
                value={settings?.aiModel}
                onChange={(e) => handleUpdate('aiModel', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 font-bold text-sm md:text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
              >
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Crédits (New Users)</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={settings?.defaultCredits}
                  onChange={(e) => handleUpdate('defaultCredits', parseInt(e.target.value))}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 font-bold text-sm md:text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                />
                <CreditCard className="text-gray-400 shrink-0" size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Global Security / Status */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-50 dark:bg-rose-900/20 rounded-xl md:rounded-2xl flex items-center justify-center text-rose-600">
              <ShieldCheck size={20} />
            </div>
            <h2 className="text-lg md:text-xl font-poppins font-black text-gray-900 dark:text-white">Sécurité Globale</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
              <div className="flex-1 mr-4">
                <p className="font-bold text-sm md:text-base text-gray-900 dark:text-white">Mode Maintenance</p>
                <p className="text-[10px] md:text-xs text-gray-500 leading-tight">Bloque l'accès aux utilisateurs normaux.</p>
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
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg">
        <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-4">Dernière Mise à Jour</h3>
        <p className="text-sm text-gray-500">
          Les paramètres globaux (Système) ont été modifiés pour la dernière fois le : 
          <span className="font-bold text-gray-900 dark:text-white ml-2">
            {settings?.updatedAt?.toDate() ? settings.updatedAt.toDate().toLocaleString() : 'Inconnu'}
          </span>
        </p>
      </div>
    </div>
  );
}
