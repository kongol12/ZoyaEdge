import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LifeBuoy, Send, Bug, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useTranslation } from '@shared/lib/i18n';
import { db } from '@shared/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@shared/lib/auth';
import { cn } from '@shared/lib/utils';

export default function Support() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('low');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'bug_reports'), {
        userId: user.uid,
        title,
        description,
        severity,
        status: 'open',
        type: 'client',
        createdAt: serverTimestamp()
      });
      
      // Also create an admin notification in DB
      await addDoc(collection(db, 'admin_notifications'), {
        title: `Nouveau Bug: ${title}`,
        message: `Signalé par ${user.email}`,
        type: severity === 'high' ? 'warning' : 'info',
        read: false,
        createdAt: serverTimestamp()
      });

      // Trigger server-side alert (Email/External)
      if (severity === 'high') {
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/admin/notify', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              title: `ALERTE CRITIQUE: ${title}`,
              message: `Un bug critique a été signalé par ${user.email}.\n\nDescription: ${description}`,
              severity: 'critical',
              userId: user.uid
            })
          });
        } catch (e) {
          console.error("Failed to trigger server notification:", e);
        }
      }

      setSuccess(true);
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error("Error reporting bug:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-12">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-zoya-red-accent text-zoya-red rounded-3xl mb-2">
          <LifeBuoy size={32} />
        </div>
        <h1 className="text-4xl font-poppins font-black text-gray-900 dark:text-white">{t.common.support}</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          Un problème ? Une suggestion ? Notre équipe technique est à votre écoute.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <AlertCircle className="text-zoya-red" />
              Assistance Rapide
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Email</p>
                <p className="font-bold text-gray-900 dark:text-white">support@zoyaedge.com</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Horaires</p>
                <p className="font-bold text-gray-900 dark:text-white">Lundi - Vendredi, 9h - 18h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bug Report Form */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg">
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Bug className="text-zoya-red" />
            Signaler un Bug
          </h2>

          {success ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <p className="font-bold text-gray-900 dark:text-white">Rapport envoyé avec succès !</p>
              <button 
                onClick={() => setSuccess(false)}
                className="text-zoya-red font-bold text-sm hover:underline"
              >
                Signaler un autre problème
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Sujet</label>
                <input 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Erreur lors de l'import CSV"
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-zoya-red"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Sévérité</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                        severity === s 
                          ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                          : "bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Description</label>
                <textarea 
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Décrivez le problème en détail..."
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-zoya-red resize-none"
                />
              </div>
              <button 
                disabled={loading}
                className="w-full py-4 bg-zoya-red text-white rounded-2xl font-poppins font-black flex items-center justify-center gap-2 hover:bg-zoya-red/90 transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                Envoyer le Rapport
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
