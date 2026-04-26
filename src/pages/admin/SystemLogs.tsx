import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { 
  Shield, 
  Activity, 
  Terminal, 
  User, 
  Clock, 
  ExternalLink, 
  Search,
  Filter,
  Monitor,
  AlertCircle,
  CheckCircle2,
  Lock,
  Globe
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SystemLog {
  id: string;
  type: 'auth' | 'navigation' | 'action' | 'system' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  userId?: string;
  userEmail?: string;
  ip?: string;
  path?: string;
  metadata?: any;
  createdAt: Timestamp;
}

export default function SystemLogs() {
  const [activeTab, setActiveTab] = useState<'messages' | 'tech'>('messages');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [slowConnection, setSlowConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setError(null);
    setSlowConnection(false);
    
    const timeout = setTimeout(() => {
      if (loading) setSlowConnection(true);
    }, 8000);

    const q = query(
      collection(db, 'system_logs'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const newLogs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SystemLog[];
        setLogs(newLogs.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        }));
        setLoading(false);
        clearTimeout(timeout);
      },
      (err) => {
        console.error("Error fetching logs:", err);
        setError(err.message);
        setLoading(false);
        clearTimeout(timeout);
      }
    );

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    // Tab level filter
    const matchesTab = activeTab === 'messages' 
      ? ['auth', 'action', 'security'].includes(log.type) 
      : ['navigation', 'system'].includes(log.type);
    
    // Manual filter
    const matchesFilter = filter === 'all' || log.type === filter;
    
    // Search
    const searchLow = (search || "").toLowerCase();
    const matchesSearch = (log.message?.toLowerCase() || "").includes(searchLow) || 
                         (log.userEmail?.toLowerCase() || "").includes(searchLow);
    
    return matchesTab && matchesFilter && matchesSearch;
  });

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      case 'error': return 'bg-rose-400/10 text-rose-500 border-rose-100';
      case 'warning': return 'bg-amber-400/10 text-amber-600 border-amber-100';
      default: return 'bg-emerald-400/10 text-emerald-600 border-emerald-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'auth': return <Lock size={14} />;
      case 'navigation': return <Globe size={14} />;
      case 'security': return <Shield size={14} />;
      case 'system': return <Terminal size={14} />;
      default: return <Activity size={14} />;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tighter">
            Journal Industriel
          </h1>
          <p className="text-sm md:text-base text-gray-500 font-bold mt-1">Traçabilité de sécurité et activités système.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-full md:w-auto">
          <div className="flex-1 md:flex-none px-4 py-2 border-r border-gray-100 dark:border-gray-700">
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Status</p>
             <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] md:text-xs font-black text-emerald-600">LIVE</span>
             </div>
          </div>
          <div className="flex-1 md:flex-none px-4 py-2">
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Dernière Sync</p>
             <p className="text-[10px] md:text-xs font-black text-gray-900 dark:text-white">Instant</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 md:gap-4 border-b border-gray-200 dark:border-gray-800 no-scrollbar">
        <button
          onClick={() => { setActiveTab('messages'); setFilter('all'); }}
          className={cn(
            "flex items-center gap-2 px-4 md:px-6 py-4 font-black uppercase tracking-widest text-[10px] md:text-xs transition-all relative whitespace-nowrap",
            activeTab === 'messages' 
              ? "text-zoya-red" 
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <AlertCircle size={16} className="md:w-[18px] md:h-[18px]" />
          Messages & Alertes
          {activeTab === 'messages' && (
            <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-zoya-red rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => { setActiveTab('tech'); setFilter('all'); }}
          className={cn(
            "flex items-center gap-2 px-4 md:px-6 py-4 font-black uppercase tracking-widest text-[10px] md:text-xs transition-all relative whitespace-nowrap",
            activeTab === 'tech' 
              ? "text-zoya-red" 
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Terminal size={16} className="md:w-[18px] md:h-[18px]" />
          Logs Systèmes
          {activeTab === 'tech' && (
            <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-zoya-red rounded-t-full" />
          )}
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl pl-12 pr-4 py-3 md:py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red transition-all"
          />
        </div>
        <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0 no-scrollbar">
          {activeTab === 'messages' ? (
            ['all', 'auth', 'action', 'security'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                  filter === t 
                    ? "bg-zoya-red text-white border-zoya-red shadow-lg shadow-zoya-red/20" 
                    : "bg-white dark:bg-gray-900 text-gray-500 border-gray-100 dark:border-gray-700"
                )}
              >
                {t}
              </button>
            ))
          ) : (
            ['all', 'navigation', 'system'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                  filter === t 
                    ? "bg-zoya-red text-white border-zoya-red shadow-lg shadow-zoya-red/20" 
                    : "bg-white dark:bg-gray-900 text-gray-500 border-gray-100 dark:border-gray-700"
                )}
              >
                {t}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-gray-900 rounded-[24px] md:rounded-[40px] border border-gray-800 shadow-2xl overflow-hidden min-h-[400px] md:min-h-[600px] flex flex-col">
        <div className="p-4 md:p-6 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between bg-gray-900/50 backdrop-blur-xl gap-4">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-800 rounded-xl">
                 <Terminal className="text-zoya-red" size={18} />
              </div>
              <div>
                 <h2 className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest font-mono">Surveillance Console</h2>
                 <p className="text-[8px] md:text-[10px] text-gray-500 font-bold font-mono">200 derniers événements</p>
              </div>
           </div>
           <div className="flex items-center gap-4 self-end sm:self-auto">
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-lg">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                 <span className="text-[8px] md:text-[10px] font-black text-gray-400 font-mono uppercase">Connected</span>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 font-mono custom-scrollbar">
          <AnimatePresence initial={false}>
            {filteredLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group flex flex-col gap-2 md:gap-4 p-3 rounded-xl hover:bg-gray-800/30 transition-colors border border-transparent hover:border-gray-800 md:flex-row md:items-center"
              >
                <div className="flex items-center justify-between md:justify-start gap-3 min-w-[140px]">
                   <span className="text-[9px] md:text-[10px] font-bold text-gray-600">
                     {log.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </span>
                   <div className={cn(
                     "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] md:text-[9px] font-black uppercase tracking-widest",
                     getSeverityStyles(log.severity)
                   )}>
                     {getTypeIcon(log.type)}
                     <span>{log.type}</span>
                   </div>
                </div>

                <div className="flex-1 min-w-0">
                   <p className="text-[11px] md:text-[13px] text-gray-300 font-medium leading-relaxed break-words">
                     <span className="text-gray-500 font-bold mr-2">[{log.userEmail || 'SYSTEM'}]</span>
                     {log.message}
                   </p>
                   {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata).length > 0 && (
                     <div className="mt-2 flex flex-wrap gap-1 md:gap-2">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <span key={key} className="text-[8px] md:text-[9px] bg-gray-800/50 text-gray-500 px-1.5 py-0.5 rounded border border-gray-800 flex items-center gap-1">
                             <span className="font-bold text-gray-600 uppercase tracking-tighter">{key}:</span>
                             <span className="text-zoya-red/70">{String(value)}</span>
                          </span>
                        ))}
                     </div>
                   )}
                   {log.path && (
                     <p className="text-[9px] md:text-[10px] text-gray-600 mt-1 flex items-center gap-1 truncate">
                        <ExternalLink size={10} /> {log.path}
                     </p>
                   )}
                </div>

                <div className="flex items-center justify-between mt-1 md:mt-0 md:justify-end gap-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                   {log.ip ? (
                     <div className="flex items-center gap-1 text-[8px] md:text-[10px] text-gray-500">
                        <Monitor size={10} /> {log.ip}
                     </div>
                   ) : <div />}
                   <button className="p-1 md:p-1.5 text-gray-600 hover:text-white transition-colors">
                      <AlertCircle size={14} />
                   </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex flex-col items-center justify-center h-40">
               <div className="w-8 h-8 border-2 border-zoya-red border-t-transparent rounded-full animate-spin mb-4" />
               {slowConnection && (
                 <p className="text-[10px] text-gray-500 font-bold animate-pulse uppercase tracking-widest">
                   Connection lente... vérification des permissions...
                 </p>
               )}
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-40 text-rose-500">
               <AlertCircle size={40} className="mb-4" />
               <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
               <button onClick={() => window.location.reload()} className="mt-4 text-xs underline">Recharger</button>
            </div>
          )}
          {!loading && !error && filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
               <Terminal size={40} className="mb-4 opacity-20" />
               <p className="text-sm font-bold uppercase tracking-widest">Aucun log trouvé</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-md">
           <div className="flex justify-between items-center px-4">
              <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em]">Zoya Systems Kernel v1.0.4 - Secure Logs Feed</p>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-gray-500 font-bold">STABLE</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
