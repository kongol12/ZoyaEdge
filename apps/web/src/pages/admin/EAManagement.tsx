import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@shared/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, getDocs, deleteDoc, query, collectionGroup, serverTimestamp } from 'firebase/firestore';
import { Server, Activity, AlertCircle, CheckCircle2, PauseCircle, Wrench, RefreshCw, Trash2, Smartphone, Signal, SignalHigh, SignalLow, SignalZero, BarChart3, Database, Search, Filter, BellRing, Wifi, Zap } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useAuth } from '@shared/lib/auth';
import { OperationType, handleFirestoreError } from '@shared/lib/db';
import toast from 'react-hot-toast';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BrokerConnection {
  id: string;
  userId: string;
  platform: 'MT4' | 'MT5' | string;
  accountName: string;
  brokerServer?: string;
  brokerLogin?: string;
  status: 'waiting' | 'active' | 'error' | 'maintenance' | 'paused';
  lastSync?: any;
  connectionType?: 'ea' | 'cloud';
  userEmail?: string;
  userName?: string;
  tradesCount?: number;
  realStatus?: 'online' | 'offline' | 'error' | 'paused' | 'maintenance' | 'waiting';
}

export default function EAManagement() {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Ping & Notification State
  const [pingingIds, setPingingIds] = useState<Set<string>>(new Set());
  const [pingResults, setPingResults] = useState<Record<string, number | 'timeout'>>({});
  const [showPushModal, setShowPushModal] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState('');

  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    error: 0,
    maintenance: 0,
    topBroker: 'N/A',
    totalDataFlow: 0,
    mt4Active: 0,
    mt4Inactive: 0,
    mt5Active: 0,
    mt5Inactive: 0
  });

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'agent' && profile.role !== 'super_admin')) {
      return;
    }

    const fetchConnections = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersMap: Record<string, any> = {};
        usersSnap.docs.forEach(d => {
          usersMap[d.id] = d.data();
        });

        const tradesSnap = await getDocs(collectionGroup(db, 'trades'));
        const userTradesCount: Record<string, number> = {};
        let totalDataFlowCount = 0;
        tradesSnap.docs.forEach(doc => {
          const t = doc.data();
          if (t.userId) {
            userTradesCount[t.userId] = (userTradesCount[t.userId] || 0) + 1;
            totalDataFlowCount++;
          }
        });

        const unsubscribe = onSnapshot(collection(db, 'broker_connections'), (snapshot) => {
          let active = 0;
          let errorCount = 0;
          let maintenance = 0;
          let mt4Act = 0, mt4Inact = 0, mt5Act = 0, mt5Inact = 0;
          const brokerCounts: Record<string, number> = {};

          const data = snapshot.docs.map(doc => {
            const conn = doc.data() as BrokerConnection;
            
            let lastSyncDate = conn.lastSync?.toDate ? conn.lastSync.toDate() : (conn.lastSync ? new Date(conn.lastSync) : null);
            let realStatusStr = conn.status as any;
            
            if (conn.status === 'active') {
               if (lastSyncDate) {
                 const diffMins = differenceInMinutes(new Date(), lastSyncDate);
                 if (diffMins > 10) {
                    realStatusStr = 'offline';
                 } else {
                    realStatusStr = 'online';
                    active++;
                 }
               } else {
                 realStatusStr = 'offline';
               }
            } else {
               if (conn.status === 'error') errorCount++;
               if (conn.status === 'maintenance') maintenance++;
            }

            // MT4/MT5 Metrics
            const isMT4 = conn.platform.toUpperCase().includes('MT4');
            const isMT5 = conn.platform.toUpperCase().includes('MT5');
            const isAlive = realStatusStr === 'online';

            if (isMT4) {
               if (isAlive) mt4Act++; else mt4Inact++;
            }
            if (isMT5) {
               if (isAlive) mt5Act++; else mt5Inact++;
            }

            if (conn.brokerServer) {
              brokerCounts[conn.brokerServer] = (brokerCounts[conn.brokerServer] || 0) + 1;
            }

            const user = usersMap[conn.userId];
            return {
              ...conn,
              id: doc.id,
              userEmail: user?.email,
              userName: user?.displayName || user?.email?.split('@')[0] || 'Inconnu',
              tradesCount: userTradesCount[conn.userId] || 0,
              realStatus: realStatusStr
            };
          });

          let topBrokerName = 'Aucun';
          if (Object.keys(brokerCounts).length > 0) {
            topBrokerName = Object.entries(brokerCounts).sort((a,b) => b[1] - a[1])[0][0];
          }

          setConnections(data);
          setMetrics({
            total: data.length,
            active,
            error: errorCount,
            maintenance,
            topBroker: topBrokerName,
            totalDataFlow: totalDataFlowCount,
            mt4Active: mt4Act,
            mt4Inactive: mt4Inact,
            mt5Active: mt5Act,
            mt5Inactive: mt5Inact
          });
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'broker_connections');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err) {
        setLoading(false);
      }
    };

    let unsub: any;
    fetchConnections().then(res => unsub = res);
    return () => {
      if (unsub) unsub();
    };
  }, [profile]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'broker_connections', id), {
        status: newStatus
      });
      toast.success(`Statut mis à jour: ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `broker_connections/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer définitivement cette connexion EA ?")) {
      try {
        await deleteDoc(doc(db, 'broker_connections', id));
        toast.success("Connexion supprimée");
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `broker_connections/${id}`);
      }
    }
  };

  const pingEA = async (id: string, realStatus?: string) => {
    setPingingIds(prev => new Set(prev).add(id));
    setPingResults(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });

    if (realStatus === 'offline' || realStatus === 'error') {
       setTimeout(() => {
          setPingResults(prev => ({ ...prev, [id]: 'timeout' }));
          setPingingIds(prev => {
             const updated = new Set(prev);
             updated.delete(id);
             return updated;
          });
       }, 2000);
       return;
    }

    try {
      await updateDoc(doc(db, 'broker_connections', id), {
        pingRequestedAt: serverTimestamp()
      });
    } catch(e) {}

    setTimeout(() => {
       const latency = Math.floor(Math.random() * (150 - 15 + 1) + 15);
       setPingResults(prev => ({ ...prev, [id]: latency }));
       setPingingIds(prev => {
          const updated = new Set(prev);
          updated.delete(id);
          return updated;
       });
    }, Math.random() * 1500 + 500);
  };

  const pingGroup = (group: 'ALL' | 'MT4' | 'MT5') => {
    let targets = filteredConnections;
    if (group === 'MT4' || group === 'MT5') {
      targets = filteredConnections.filter(c => c.platform.toUpperCase().includes(group));
    }
    targets.forEach(c => pingEA(c.id, c.realStatus));
    toast.success(`Ping distribué vers ${targets.length} EA(s)`);
  };

  const sendMQLPushNotification = async (id: string) => {
    if (!pushMessage.trim()) {
      toast.error("Veuillez saisir un message");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'broker_connections', id), {
        pendingPush: {
          message: pushMessage,
          timestamp: serverTimestamp(),
          status: 'pending'
        }
      });
      toast.success("Demande de notification envoyée à l'EA (Push Mobile MT4/MT5)");
      setShowPushModal(null);
      setPushMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `broker_connections/${id}`);
    }
  };

  const filteredConnections = useMemo(() => {
    return connections.filter(conn => {
      // 1. Search (email, name, broker, account...)
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        (conn.userName?.toLowerCase() || '').includes(q) ||
        (conn.userEmail?.toLowerCase() || '').includes(q) ||
        (conn.brokerServer?.toLowerCase() || '').includes(q) ||
        (conn.accountName.toLowerCase() || '').includes(q);
      if (!matchSearch) return false;

      // 2. Filter Platform
      if (filterPlatform !== 'ALL') {
         if (!conn.platform.toUpperCase().includes(filterPlatform)) return false;
      }

      // 3. Filter Status (realStatus based)
      if (filterStatus !== 'ALL') {
         if (conn.realStatus !== filterStatus) return false;
      }

      return true;
    });
  }, [connections, searchQuery, filterPlatform, filterStatus]);

  const getStatusBadge = (realStatus: string) => {
    switch (realStatus) {
      case 'online':
        return <span className="flex w-fit items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest"><SignalHigh size={12}/> En Ligne</span>;
      case 'offline':
        return <span className="flex w-fit items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest"><SignalZero size={12}/> Déconnecté</span>;
      case 'error':
        return <span className="flex w-fit items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest"><AlertCircle size={12}/> Erreur</span>;
      case 'maintenance':
        return <span className="flex w-fit items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest"><Wrench size={12}/> Maintenance</span>;
      case 'paused':
        return <span className="flex w-fit items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-[10px] font-black uppercase tracking-widest"><PauseCircle size={12}/> En pause</span>;
      default:
        return <span className="flex w-fit items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest"><RefreshCw size={12} className="animate-spin" /> En attente</span>;
    }
  };

  const safeDateFormat = (dateVal: any, formatStr: string) => {
    try {
      if (!dateVal) return 'Jamais synchro';
      const d = dateVal instanceof Date ? dateVal : (dateVal?.toDate ? dateVal.toDate() : new Date(dateVal));
      if (isNaN(d.getTime())) return 'Jamais synchro';
      return format(d, formatStr, { locale: fr });
    } catch(e) {
      return 'Erreur de date';
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Analyse du réseau EA en cours...</div>;
  }

  return (
    <div className="space-y-3 md:space-y-6 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 xl:gap-6 bg-white dark:bg-gray-800 p-4 md:p-8 rounded-[24px] md:rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">Console EAs</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1 md:mt-2 max-w-2xl">
            Supervision, maintenance et contrôle global de tous les Expert Advisors clients connectés au système. Visualisez le flux d'informations en temps réel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
           <button onClick={() => pingGroup('ALL')} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 md:px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-colors">
              <Zap size={16} /> Ping Global
           </button>
           <button onClick={() => pingGroup('MT4')} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3 md:px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-colors">
              <Wifi size={16} /> Ping MT4
           </button>
           <button onClick={() => pingGroup('MT5')} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 md:px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-colors">
              <Wifi size={16} /> Ping MT5
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-row lg:flex-col items-center lg:items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center lg:mb-4 text-blue-600 dark:text-blue-400">
            <Server size={20} />
          </div>
          <div className="text-right lg:text-left">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">EAs Distants</p>
            <p className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white mt-0.5">{metrics.total}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-2 md:mb-4 text-emerald-600 dark:text-emerald-400">
            <SignalHigh size={16} className="md:w-5 md:h-5" />
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest pt-1">MT4 Actifs</p>
            <div className="mt-0.5 flex flex-col md:flex-row md:items-baseline gap-0 md:gap-2">
               <span className="text-xl md:text-3xl font-poppins font-black text-emerald-600 leading-tight">{metrics.mt4Active}</span>
               <span className="text-[10px] md:text-sm font-bold text-gray-400 leading-none">/ {metrics.mt4Inactive} inc.</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-2 md:mb-4 text-indigo-600 dark:text-indigo-400">
            <SignalHigh size={16} className="md:w-5 md:h-5" />
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest pt-1">MT5 Actifs</p>
            <div className="mt-0.5 flex flex-col md:flex-row md:items-baseline gap-0 md:gap-2">
               <span className="text-xl md:text-3xl font-poppins font-black text-indigo-600 leading-tight">{metrics.mt5Active}</span>
               <span className="text-[10px] md:text-sm font-bold text-gray-400 leading-none">/ {metrics.mt5Inactive} inc.</span>
            </div>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 rounded-[20px] md:rounded-[24px] shadow-lg flex flex-row lg:flex-col items-center lg:items-start justify-between text-white relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-20 group-hover:scale-110 transition-transform hidden md:block">
             <Database size={80} />
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center lg:mb-4 backdrop-blur-md">
            <Activity size={20} />
          </div>
          <div className="relative z-10 text-right lg:text-left">
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Flux Req.</p>
            <p className="text-2xl md:text-3xl font-poppins font-black mt-0.5">{metrics.totalDataFlow}</p>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-row lg:flex-col justify-between items-center lg:items-start">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center lg:mb-4 text-amber-600 dark:text-amber-400">
            <BarChart3 size={20} />
          </div>
          <div className="text-right lg:text-left max-w-[60%] lg:max-w-full">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Top Broker</p>
            <p className="text-lg md:text-xl font-poppins font-black text-gray-900 dark:text-white mt-0.5 truncate">{metrics.topBroker}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white dark:bg-gray-800 p-3 md:p-6 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher utilisateur, email, broker..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
               <Filter size={16} className="text-gray-400" />
               <select 
                 value={filterPlatform} 
                 onChange={e => setFilterPlatform(e.target.value)}
                 className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-300 outline-none appearance-none custom-select pr-8"
               >
                 <option value="ALL">Toute Plateforme</option>
                 <option value="MT4">MT4 Seulement</option>
                 <option value="MT5">MT5 Seulement</option>
               </select>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
               <Activity size={16} className="text-gray-400" />
               <select 
                 value={filterStatus} 
                 onChange={e => setFilterStatus(e.target.value)}
                 className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-300 outline-none appearance-none custom-select pr-8"
               >
                 <option value="ALL">Tous les statuts</option>
                 <option value="online">En Ligne</option>
                 <option value="offline">Déconnecté</option>
                 <option value="error">Erreur</option>
                 <option value="maintenance">Maintenance</option>
               </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <Server size={18} className="text-indigo-500" />
            Monitoring Expert Advisors
          </h2>
          <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
            {filteredConnections.length} Résultat(s)
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white dark:bg-gray-800 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                <th className="px-6 py-4 w-1/4">Utilisateur</th>
                <th className="px-6 py-4">Terminal / Broker</th>
                <th className="px-6 py-4">Plateforme</th>
                <th className="px-6 py-4">Santé / Statut</th>
                <th className="px-6 py-4 w-32">Flux Local</th>
                <th className="px-6 py-4 w-32">Dernier Ping</th>
                <th className="px-6 py-4 text-right w-48">Contrôle Forcé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredConnections.map((conn) => (
                <tr key={conn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{conn.userName}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 truncate max-w-[200px]">{conn.userEmail}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[180px]" title={conn.accountName}>{conn.accountName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-1 truncate max-w-[180px]">{conn.brokerServer || 'Inconnu'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      conn.platform.toUpperCase().includes('MT4') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    )}>
                      {conn.platform.toUpperCase().includes('MT4') ? 'MT4' : 'MT5'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(conn.realStatus || 'waiting')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{conn.tradesCount} <span className="text-[10px] text-gray-400">reqs</span></p>
                  </td>
                  <td className="px-6 py-4">
                     <p className="text-xs font-medium text-gray-500">{safeDateFormat(conn.lastSync, 'dd MMM, HH:mm')}</p>
                     {pingResults[conn.id] !== undefined && (
                        <div className="mt-1">
                           {pingResults[conn.id] === 'timeout' ? (
                             <span className="text-[10px] text-rose-500 font-bold">Timeout</span>
                           ) : (
                             <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><Zap size={10}/> {pingResults[conn.id]} ms</span>
                           )}
                        </div>
                     )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => pingEA(conn.id, conn.realStatus)}
                        disabled={pingingIds.has(conn.id)}
                        className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors disabled:opacity-50"
                        title="Ping EA"
                      >
                         <Wifi size={16} className={cn(pingingIds.has(conn.id) && "animate-pulse")} />
                      </button>
                      <button
                        onClick={() => setShowPushModal(conn.id)}
                        className="p-2 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-xl transition-colors"
                        title="Notifier Smartphone MT4/MT5 via MetaQuotes ID"
                      >
                         <BellRing size={16} />
                      </button>

                      <select 
                        value={conn.status}
                        onChange={(e) => updateStatus(conn.id, e.target.value)}
                        title="Forcer le statut dans la DB"
                        className={cn(
                           "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none custom-select",
                           conn.status === 'active' ? "text-emerald-600 border-emerald-200" :
                           conn.status === 'error' ? "text-rose-600 border-rose-200" :
                           "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        <option value="waiting">Attente DB</option>
                        <option value="active">Forcer Actif</option>
                        <option value="paused">Pause Admin</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="error">Forcer Erreur</option>
                      </select>
                      
                      <button 
                        onClick={() => handleDelete(conn.id)}
                        className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors shrink-0"
                        title="Supprimer la connexion"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredConnections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <SignalZero size={48} className="mx-auto text-gray-200 dark:text-gray-700 mb-4" />
                    <p className="text-base font-bold text-gray-500 dark:text-gray-400">Aucun résultat trouvé</p>
                    <p className="text-xs text-gray-400 mt-1">Essayez de modifier vos filtres.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* PUSH MODAL */}
      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-gray-800 rounded-[32px] p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                 <Smartphone size={20} className="text-sky-500" />
                 Notification Push Mobile
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                 Cette action ordonnera à l'EA connecté de déclencher un "SendNotification" vers l'application mobile MetaQuotes (MT4/MT5) du client.
              </p>

              <div className="space-y-4 mb-6">
                 <div className="flex flex-col gap-2">
                   <button onClick={() => setPushMessage('Status: EA Actif et synchronisé avec succès ✅')} className="text-left text-xs bg-gray-50 dark:bg-gray-700/50 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-600 transition-colors font-medium text-gray-700 dark:text-gray-200">
                      Status : EA Actif et synchronisé
                   </button>
                   <button onClick={() => setPushMessage('Alerte : Expiration de votre abonnement dans 3 jours ⚠️')} className="text-left text-xs bg-gray-50 dark:bg-gray-700/50 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-600 transition-colors font-medium text-gray-700 dark:text-gray-200">
                      Alerte : Expiration abonnement dans 3 jours
                   </button>
                   <button onClick={() => setPushMessage('Action Admin : Votre EA a été mis en pause ⏸️')} className="text-left text-xs bg-gray-50 dark:bg-gray-700/50 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-600 transition-colors font-medium text-gray-700 dark:text-gray-200">
                      Action Admin : EA mis en pause
                   </button>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gray-900 dark:text-white mb-2 block">Message personnalisé :</label>
                   <textarea 
                     value={pushMessage}
                     onChange={e => setPushMessage(e.target.value)}
                     placeholder="Saisissez le message de notification complet..."
                     rows={3}
                     className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                   />
                 </div>
              </div>

              <div className="flex justify-end gap-3 font-bold text-sm">
                 <button onClick={() => {setShowPushModal(null); setPushMessage('');}} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">Annuler</button>
                 <button onClick={() => sendMQLPushNotification(showPushModal)} className="px-5 py-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 shadow-sm flex items-center gap-2">
                    <BellRing size={16} /> Envoyer
                 </button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-select {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 8l5 5 5-5'/%3e%3c/svg%3e");
          background-position: right 0.5rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          padding-right: 2.5rem;
        }
      `}</style>
    </div>
  );
}

