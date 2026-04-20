import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Activity, ShieldAlert, Terminal, FileText, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  message: string;
  type: string;
  severity: string;
  metadata?: any;
  userId?: string;
  createdAt: any;
}

interface SystemLog {
  id: string;
  event: string;
  details?: any;
  createdAt: any;
}

export default function ActivityAdmin() {
  const [activeTab, setActiveTab] = useState<'activities' | 'logs'>('activities');
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [sysLogs, setSysLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to activities (Messages en dur)
    const qActivities = query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(100));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ActivityLog));
      setLoading(false);
    });

    // Listen to system_logs (Logs techniques)
    const qLogs = query(collection(db, 'system_logs'), orderBy('createdAt', 'desc'), limit(100));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setSysLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SystemLog));
    });

    return () => {
      unsubActivities();
      unsubLogs();
    };
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'info': return <CheckCircle2 className="text-blue-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={16} />;
      case 'error': return <AlertCircle className="text-rose-500" size={16} />;
      case 'critical': return <ShieldAlert className="text-red-600" size={16} />;
      default: return <Activity className="text-gray-500" size={16} />;
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return 'En cours...';
    try {
      return format(ts.toDate(), 'dd MMM yyyy HH:mm:ss', { locale: fr });
    } catch {
      return 'Date invalide';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Journal Industriel</h1>
        <p className="text-gray-500 dark:text-gray-400">Tracabilité de sécurité et activités système du backend.</p>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('activities')}
          className={cn(
            "flex items-center gap-2 px-6 py-4 font-bold transition-all relative",
            activeTab === 'activities' 
              ? "text-zoya-red" 
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <FileText size={20} />
          Messages & Alertes
          {activeTab === 'activities' && (
            <motion.div layoutId="indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-zoya-red rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            "flex items-center gap-2 px-6 py-4 font-bold transition-all relative",
            activeTab === 'logs' 
              ? "text-zoya-red" 
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Terminal size={20} />
          Logs Systèmes Transparents
          {activeTab === 'logs' && (
            <motion.div layoutId="indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-zoya-red rounded-t-full" />
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-zoya-red border-t-transparent rounded-full animate-spin"></div></div>
      ) : activeTab === 'activities' ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucune activité enregistrée.</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {activities.map(act => (
                <li key={act.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-4">
                  <div className="mt-1">{getSeverityIcon(act.severity)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{act.message}</p>
                    <div className="flex gap-4 mt-1 text-[11px] font-mono text-gray-500">
                      <span>[{act.type.toUpperCase()}]</span>
                      <span>{formatTime(act.createdAt)}</span>
                      {act.userId && <span>User: {act.userId}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="bg-[#0f172a] text-green-400 font-mono text-xs p-6 rounded-3xl border border-gray-800 shadow-xl overflow-x-auto min-h-[500px]">
          {sysLogs.length === 0 ? (
            <p className="text-gray-500">// Aucun log système trouvé dans la base de données.</p>
          ) : (
            sysLogs.map(log => (
              <div key={log.id} className="mb-2 pb-2 border-b border-gray-800/50">
                <span className="text-gray-500">[{formatTime(log.createdAt)}]</span>{' '}
                <span className="text-indigo-400 font-bold">{log.event}</span>{' '}
                {log.details && (
                  <span className="text-gray-400">
                    {JSON.stringify(log.details)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
