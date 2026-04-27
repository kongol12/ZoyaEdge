import React, { useEffect, useState } from 'react';
import { db } from '@shared/lib/firebase';
import { collectionGroup, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '@shared/lib/db';
import { 
  BarChart2, 
  TrendingUp, 
  PieChart, 
  Activity,
  ArrowUpRight,
  Target,
  Zap,
  ZapOff,
  Brain,
  Search,
  Filter,
  Download,
  Database,
  RefreshCw,
  Trash2,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { seedMockTrades, clearDemoTrades } from '@shared/lib/seed';
import { computeDecisionEngine, DecisionEngineResult } from '@features/signals/services/decisionEngine';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '@shared/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface GlobalTrade {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  pair: string;
  direction: 'buy' | 'sell';
  pnl: number;
  strategy: string;
  emotion: string;
  date: any;
  createdAt: any;
  isDemo?: boolean;
}

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ClientTradeReports() {
  const [trades, setTrades] = useState<GlobalTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [stats, setStats] = useState({
    totalTrades: 0,
    globalWinrate: 0,
    totalVolume: 0,
    bestPair: 'N/A',
    topStrategy: 'N/A'
  });
  const [search, setSearch] = useState('');
  const [engineResult, setEngineResult] = useState<DecisionEngineResult | null>(null);

  useEffect(() => {
    // collectionGroup allows querying across all 'trades' subcollections
    const q = query(collectionGroup(db, 'trades'), orderBy('date', 'desc'), limit(200));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GlobalTrade);
      
      try {
        // Fetch users to map information
        const { getDocs, collection } = await import('firebase/firestore');
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap: Record<string, any> = {};
        usersSnap.docs.forEach(d => {
          userMap[d.id] = d.data();
        });

        const enrichedData = rawData.map(trade => {
          const userProfile = userMap[trade.userId];
          return {
            ...trade,
            userName: trade.userName || userProfile?.displayName || userProfile?.name || userProfile?.email?.split('@')[0] || "Client Sans Nom",
            userEmail: trade.userEmail || userProfile?.email || "N/A"
          };
        });

        // Filter demo
        const data = enrichedData.filter(t => showDemo || !t.isDemo);
        setTrades(data);

        if (data.length > 0) {
          const wins = data.filter(t => t.pnl > 0).length;
          const pairs: { [key: string]: number } = {};
          const strats: { [key: string]: number } = {};
          
          data.forEach(t => {
            pairs[t.pair] = (pairs[t.pair] || 0) + 1;
            strats[t.strategy] = (strats[t.strategy] || 0) + (t.pnl || 0);
          });

          const bestPair = Object.keys(pairs).reduce((a, b) => pairs[a] > pairs[b] ? a : b, 'N/A');
          const topStrat = Object.keys(strats).reduce((a, b) => strats[a] > strats[b] ? a : b, 'N/A');

          setStats({
            totalTrades: data.length,
            globalWinrate: (wins / data.length) * 100,
            totalVolume: data.length * 1.5, // Mock volume multiplier
            bestPair,
            topStrategy: topStrat
          });
        }
      } catch (err) {
        console.error("Erreur d'enrichissement:", err);
        setTrades(rawData.filter(t => showDemo || !t.isDemo));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trades (collectionGroup)');
    });

    return () => unsubscribe();
  }, [showDemo]);

  // Recalculate engine result when trades or search changes
  useEffect(() => {
    const searchLow = (search || '').toLowerCase();
    const filteredForEngine = search.trim() !== '' 
      ? trades.filter(t => 
          (t.userId || '').toLowerCase().includes(searchLow) || 
          (t.userName || '').toLowerCase().includes(searchLow) ||
          (t.userEmail || '').toLowerCase().includes(searchLow)
        )
      : trades;
    
    if (filteredForEngine.length > 0) {
      setEngineResult(computeDecisionEngine(filteredForEngine));
    } else {
      setEngineResult(null);
    }
  }, [trades, search]);

  const filteredTrades = trades.filter(t => 
    (t.userId || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (t.userName || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (t.userEmail || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const pairData = Object.entries(
    filteredTrades.reduce((acc, t) => ({ ...acc, [t.pair]: (acc[t.pair] || 0) + 1 }), {} as any)
  ).map(([name, value]) => ({ name, value })).slice(0, 6);

  const emotionData = [
    { name: 'Excitation', value: filteredTrades.filter(t => t.emotion === '🤩' || t.emotion === '🔥').length },
    { name: 'Incertitude', value: filteredTrades.filter(t => t.emotion === '😕').length },
    { name: 'Concentration', value: filteredTrades.filter(t => t.emotion === '🧠').length },
    { name: 'Peur/Anxiété', value: filteredTrades.filter(t => t.emotion === '😰' || t.emotion === 'fear').length },
    { name: 'Avidité', value: filteredTrades.filter(t => t.emotion === '🤑').length },
    { name: 'Frustration', value: filteredTrades.filter(t => t.emotion === '😤').length },
    { name: 'Satisfaction', value: filteredTrades.filter(t => t.emotion === '😊').length },
    { name: 'Neutre', value: filteredTrades.filter(t => t.emotion === '😐').length },
  ].filter(d => d.value > 0);

  const handleSeed = async () => {
    if (!confirm("Générer 50 trades fictifs pour la démonstration ?")) return;
    setIsSeeding(true);
    try {
      await seedMockTrades(50);
      toast.success("Trades générés avec succès !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du seeding.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    if (!confirm("Supprimer tous les trades de démonstration ?")) return;
    setIsSeeding(true);
    try {
      await clearDemoTrades();
      toast.success("Trades démo supprimés !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredStats = {
    totalTrades: filteredTrades.length,
    globalWinrate: filteredTrades.length > 0 ? (filteredTrades.filter(t => t.pnl > 0).length / filteredTrades.length) * 100 : 0,
    bestPair: 'N/A',
    topStrategy: 'N/A'
  };

  if (filteredTrades.length > 0) {
    const pairs: { [key: string]: number } = {};
    const strats: { [key: string]: number } = {};
    filteredTrades.forEach(t => {
      pairs[t.pair] = (pairs[t.pair] || 0) + 1;
      strats[t.strategy] = (strats[t.strategy] || 0) + (t.pnl || 0);
    });
    filteredStats.bestPair = Object.keys(pairs).reduce((a, b) => pairs[a] > pairs[b] ? a : b, 'N/A');
    filteredStats.topStrategy = Object.keys(strats).reduce((a, b) => strats[a] > strats[b] ? a : b, 'N/A');
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="w-full md:w-auto">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-poppins font-black text-gray-900 dark:text-white flex items-center gap-3">
            <BarChart2 className="text-zoya-red shrink-0" size={32} />
            Reporting Trades
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-bold mt-2">Analyse consolidée des performances.</p>
        </div>
        <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
          <button 
            onClick={() => setShowDemo(!showDemo)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border dark:border-gray-700",
              showDemo ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 border-amber-200" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
            )}
          >
            {showDemo ? <Zap size={14} /> : <ZapOff size={14} />}
            {showDemo ? 'Hide Demo' : 'Show Demo'}
          </button>
          <button 
            onClick={handleClearDemo}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all font-bold whitespace-nowrap border dark:border-gray-700"
          >
            <Trash2 size={14} />
            Clear
          </button>
          <button 
            onClick={handleSeed}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold whitespace-nowrap"
          >
            <Database size={14} />
            Seed
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all font-bold whitespace-nowrap">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Total Trades', value: filteredStats.totalTrades, icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Winrate', value: `${filteredStats.globalWinrate.toFixed(1)}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Meilleure Paire', value: filteredStats.bestPair, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Top Stratégie', value: filteredStats.topStrategy, icon: Brain, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className={cn("inline-flex p-2.5 md:p-3 rounded-xl md:rounded-2xl mb-3 md:mb-4", stat.bg)}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <p className="text-[9px] md:text-xs text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white mt-1 break-words">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Deep Dive Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Top Performers */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Performances Clients</h3>
            <span className="text-[8px] md:text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">TOP 5 PNL</span>
          </div>
          <div className="space-y-3">
            {Object.entries(
              filteredTrades.reduce((acc, t) => {
                const label = t.userName || t.userEmail || t.userId;
                return { ...acc, [label]: (acc[label] || 0) + (t.pnl || 0) };
              }, {} as any)
            )
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 5)
            .map(([displayName, pnl]: any, idx) => (
              <div key={displayName} className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0">
                    #{idx + 1}
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 truncate">{displayName}</p>
                </div>
                <p className={cn(
                  "text-xs font-black shrink-0 ml-2",
                  pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}$
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Most Active */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Engagement Clients</h3>
            <span className="text-[8px] md:text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">CONFIANCE</span>
          </div>
          <div className="space-y-3">
            {Object.entries(
              filteredTrades.reduce((acc, t) => {
                const label = t.userName || t.userEmail || t.userId;
                return { ...acc, [label]: (acc[label] || 0) + 1 };
              }, {} as any)
            )
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 5)
            .map(([displayName, count]: any, idx) => (
              <div key={displayName} className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-[10px] font-black shrink-0">
                    {count}
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 truncate">{displayName}</p>
                </div>
                <div className="flex-1 max-w-[40px] md:max-w-[60px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ml-2">
                  <div 
                    className="h-full bg-indigo-500" 
                    style={{ width: `${Math.min(100, (count / (filteredTrades.length || 1)) * 500)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Economics */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
          <div className="text-center mb-8">
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">PnL Net Plateforme</p>
            <p className={cn(
              "text-3xl md:text-5xl font-poppins font-black break-words",
              filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) >= 0 ? "text-emerald-500" : "text-rose-500"
            )}>
              {filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}$
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Gains</p>
              <p className="text-sm md:text-xl font-black text-emerald-500">
                {filteredTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}$
              </p>
            </div>
            <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Pertes</p>
              <p className="text-sm md:text-xl font-black text-rose-500">
                {filteredTrades.filter(t => t.pnl <= 0).reduce((s, t) => s + Math.abs(t.pnl), 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}$
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pair Volume Chart */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-8">Activité par Paire</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pairData}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#6B7280' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#6B7280' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }}
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '16px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="value" fill="#6366F1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Emotion Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-8">Psychologie Globale</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={emotionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {emotionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Global Trade Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-base md:text-lg font-poppins font-black text-gray-900 dark:text-white">Flux Temps Réel</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Client..." 
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-zoya-red outline-none"
              />
            </div>
            <button className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-500 hover:text-zoya-red transition-colors shrink-0">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
          {filteredTrades.length > 0 ? filteredTrades.map((trade) => (
            <div key={trade.id} className="p-5 space-y-4 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                    {trade.userName || trade.userEmail || trade.userId}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 truncate">UID: {trade.userId.slice(0, 10)}...</p>
                </div>
                <p className={cn(
                  "text-sm font-black shrink-0",
                  trade.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}$
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase">
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 dark:text-white">{trade.pair}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-lg",
                    trade.direction === 'buy' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {trade.direction}
                  </span>
                </div>
                <span className="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg">
                  {trade.strategy || 'N/A'}
                </span>
              </div>

              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {trade.date?.toDate ? format(trade.date.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr }) : 'N/A'}
              </p>
            </div>
          )) : (
            <div className="p-12 text-center text-gray-400 italic font-bold">
              Aucun trade à afficher.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-4">Client</th>
                <th className="px-8 py-4">Paire</th>
                <th className="px-8 py-4">Direction</th>
                <th className="px-8 py-4">PnL</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4 text-right">Stratégie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filteredTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-8 py-4">
                    <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[150px]">{trade.userName || trade.userEmail || trade.userId}</p>
                    <p className="text-[9px] font-bold text-gray-400 truncate max-w-[150px]">{trade.userId}</p>
                  </td>
                  <td className="px-8 py-4">
                    <p className="font-black text-gray-900 dark:text-white uppercase">{trade.pair}</p>
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      trade.direction === 'buy' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <p className={cn(
                      "font-black",
                      trade.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}$
                    </p>
                  </td>
                  <td className="px-8 py-4">
                    <p className="text-xs font-bold text-gray-500">
                      {trade.date?.toDate ? format(trade.date.toDate(), 'dd/MM/yy HH:mm') : 'N/A'}
                    </p>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                      {trade.strategy || 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
