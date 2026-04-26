import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collectionGroup, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { 
  BarChart2, 
  TrendingUp, 
  PieChart, 
  Activity,
  ArrowUpRight,
  Target,
  Zap,
  Brain,
  Search,
  Filter,
  Download,
  Database,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { seedMockTrades, clearDemoTrades } from '../../lib/seed';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
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

  useEffect(() => {
    // collectionGroup allows querying across all 'trades' subcollections
    const q = query(collectionGroup(db, 'trades'), orderBy('date', 'desc'), limit(200));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GlobalTrade);
      
      // Filter demo
      const data = allData.filter(t => showDemo || !t.isDemo);

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
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const pairData = Object.entries(
    trades.reduce((acc, t) => ({ ...acc, [t.pair]: (acc[t.pair] || 0) + 1 }), {} as any)
  ).map(([name, value]) => ({ name, value })).slice(0, 6);

  const emotionData = [
    { name: 'Excitation', value: trades.filter(t => t.emotion === '🤩' || t.emotion === '🔥').length },
    { name: 'Incertitude', value: trades.filter(t => t.emotion === '😕').length },
    { name: 'Concentration', value: trades.filter(t => t.emotion === '🧠').length },
    { name: 'Peur/Anxiété', value: trades.filter(t => t.emotion === '😰' || t.emotion === 'fear').length },
    { name: 'Avidité', value: trades.filter(t => t.emotion === '🤑').length },
    { name: 'Frustration', value: trades.filter(t => t.emotion === '😤').length },
    { name: 'Satisfaction', value: trades.filter(t => t.emotion === '😊').length },
    { name: 'Neutre', value: trades.filter(t => t.emotion === '😐').length },
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

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Reporting des Trades Clients</h1>
          <p className="text-gray-500 dark:text-gray-400">Analyse consolidée des performances de trading sur toute la plateforme.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowDemo(!showDemo)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all",
              showDemo 
                ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800" 
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            )}
          >
            {showDemo ? "Cacher Démo" : "Voir Démo"}
          </button>
          <button 
            onClick={handleClearDemo}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-rose-500/20 font-bold text-sm hover:bg-rose-600 transition-colors disabled:opacity-50"
          >
            <Trash2 size={18} />
            Nettoyer Démo
          </button>
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 font-bold text-sm hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isSeeding ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
            Seed Trades Demo
          </button>
          <button className="flex items-center gap-2 bg-white dark:bg-gray-800 px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg font-bold text-sm">
            <Download size={18} className="text-zoya-red" />
            Exporter l'Audit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Trades Totaux', value: stats.totalTrades, icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Winrate Global', value: `${stats.globalWinrate.toFixed(1)}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Meilleure Paire', value: stats.bestPair, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Top Stratégie', value: stats.topStrategy, icon: Brain, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className={cn("inline-flex p-3 rounded-2xl mb-4", stat.bg)}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
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
      <div className="bg-white dark:bg-gray-800 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Flux de Trades en Temps Réel</h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Filtrer un client..." 
                className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:ring-2 focus:ring-zoya-red outline-none"
              />
            </div>
            <button className="p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-500 hover:text-zoya-red transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-4">Client ID</th>
                <th className="px-8 py-4">Paire</th>
                <th className="px-8 py-4">Direction</th>
                <th className="px-8 py-4">PnL</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4 text-right">Stratégie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {trades.length > 0 ? trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-8 py-4">
                    <p className="text-xs font-bold text-gray-500 truncate max-w-[100px]">{trade.userId}</p>
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
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic font-bold">
                    Aucun trade à afficher.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
