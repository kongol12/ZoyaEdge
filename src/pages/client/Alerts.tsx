import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, Trash2, Info, AlertTriangle, XCircle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { subscribeToNotifications, subscribeToGlobalNotifications, markNotificationAsRead, Notification } from '../../lib/db';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

export default function Alerts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [personalNotifs, setPersonalNotifs] = useState<Notification[]>([]);
  const [globalNotifs, setGlobalNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubPersonal = subscribeToNotifications(user.uid, (data) => {
      setPersonalNotifs(data);
      setLoading(false);
    });

    const unsubGlobal = subscribeToGlobalNotifications((data) => {
      setGlobalNotifs(data);
    });

    return () => {
      unsubPersonal();
      unsubGlobal();
    };
  }, [user]);

  const allNotifications = [...globalNotifs.map(n => ({ ...n, isGlobal: true })), ...personalNotifs]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="text-amber-500" />;
      case 'error': return <XCircle className="text-rose-500" />;
      case 'success': return <CheckCircle2 className="text-emerald-500" />;
      default: return <Info className="text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">
            {t.common.alerts}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Restez informé des alertes de trading et des messages système.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-2">
          <Bell size={18} className="text-zoya-red" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {allNotifications.filter(n => !n.read).length} Non lues
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {allNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "bg-white dark:bg-gray-800 p-6 rounded-3xl border shadow-lg flex items-center gap-6 transition-all",
                notif.read ? "border-gray-100 dark:border-gray-700 opacity-75" : "border-zoya-red/20 dark:border-zoya-red/30 ring-1 ring-zoya-red/5"
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0">
                {getIcon(notif.type)}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-poppins font-black text-gray-900 dark:text-white", notif.read ? "opacity-70" : "")}>
                    {notif.title}
                  </h3>
                  {(notif as any).isGlobal && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      Global
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{notif.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock size={12} className="text-gray-400" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    {format(notif.createdAt, 'dd MMM, HH:mm')}
                  </p>
                </div>
              </div>

              {!notif.read && !(notif as any).isGlobal && (
                <button
                  onClick={() => markNotificationAsRead(user!.uid, notif.id!)}
                  className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                  title="Marquer comme lu"
                >
                  <Check size={20} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {allNotifications.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <Bell size={48} className="mx-auto text-gray-300 mb-4 opacity-20" />
            <p className="text-gray-400 font-medium">Aucune alerte pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
