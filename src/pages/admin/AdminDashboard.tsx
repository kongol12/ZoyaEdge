import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, limit, orderBy, getDocs, collectionGroup, where } from 'firebase/firestore';
import { useTranslation } from '../../lib/i18n';
import { Users, Activity, CreditCard, Shield, TrendingUp, Clock, User, Globe, DollarSign, Target, BarChart3, Database, Trash2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../../lib/utils';
import { format, subDays, isAfter, startOfMonth, formatRelative } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../lib/auth';
import { OperationType, handleFirestoreError } from '../../lib/db';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { seedMockTransactions, clearDemoPayments } from '../../lib/seed';
import toast from 'react-hot-toast';

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsers30d: 0,
    activeUsers: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalTrades: 0,
    globalPnL: 0,
    globalWinRate: 0,
  });

  const [chartsConfig, setChartsConfig] = useState({
    usersGrowth: [] as any[],
    countryDistribution: [] as any[],
    revenueTrend: [] as any[],
  });

  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  const safeDateFormat = (dateVal: any, formatStr: string) => {
    try {
      if (!dateVal) return '';
      const d = dateVal instanceof Date ? dateVal : (dateVal?.toDate ? dateVal.toDate() : new Date(dateVal));
      if (isNaN(d.getTime())) return '';
      return format(d, formatStr, { locale: fr });
    } catch(e) {
      return '';
    }
  };

  // Tools
  const handleSeed = async () => {
    if (!confirm("Générer des données de démonstration (trades & transactions) ?")) return;
    setIsSeeding(true);
    try {
      await seedMockTransactions(20);
      toast.success("Données générées !");
    } catch (error) {
      toast.error("Erreur lors du seeding.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Supprimer TOUTES les données marquées comme 'Démo' ?")) return;
    setIsSeeding(true);
    try {
      await clearDemoPayments();
      toast.success("Nettoyage terminé !");
    } catch (error) {
      toast.error("Erreur lors du nettoyage.");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'agent' && profile.email?.toLowerCase() !== PRIMARY_EMAIL)) {
      return;
    }

    const thirtyDaysAgo = subDays(new Date(), 30);
    const thisMonthStart = startOfMonth(new Date());

    // 1. Fetch Users Data (Clients)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      let total = 0;
      let newUsers = 0;
      let active = 0;
      const countries: Record<string, number> = {};
      const datesCount: Record<string, number> = {};

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === 'user' || !data.role) {
          total++;
          
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          if (isAfter(createdAt, thirtyDaysAgo)) newUsers++;
          
          // Activity basic estimation (assuming users with non-empty portfolio or recent login are active)
          // Since we might not track last login properly yet, we'll use a rough estimate if they have completed onboarding or are pro
          if (data.subscription === 'pro' || data.subscription === 'premium' || data.onboarded) active++;

          // Country distribution
          const country = data.country || 'Inconnu';
          countries[country] = (countries[country] || 0) + 1;

          // Growth trend
          try {
            const dateStr = format(createdAt, 'dd MMM', { locale: fr });
            datesCount[dateStr] = (datesCount[dateStr] || 0) + 1;
          } catch (e) {}
        }
      });

      // Format country data for PieChart
      const countryValues = Object.entries(countries)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // top 5

      // Format dates for AreaChart (last 30 days pseudo-cumulative or daily)
      const growthTrend = Object.entries(datesCount)
        .map(([date, users]) => ({ date, Nouveaux: users }))
        .slice(-10); // Last 10 days of activity

      setStats(prev => ({ ...prev, totalUsers: total, newUsers30d: newUsers, activeUsers: active }));
      setChartsConfig(prev => ({ ...prev, countryDistribution: countryValues, usersGrowth: growthTrend }));
      
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // 2. Fetch Financial Data (Payments)
    const unsubscribePayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      let totalRev = 0;
      let monthlyRev = 0;
      const datesRev: Record<string, number> = {};

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed') {
          let amnt = data.amount || 0;
          if (data.currency === 'CDF') amnt = amnt / 2800; // rough convert fallback

          totalRev += amnt;
          
          const paidAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          if (isAfter(paidAt, thisMonthStart)) monthlyRev += amnt;

          try {
            const mthStr = format(paidAt, 'MMM yyyy', { locale: fr });
            datesRev[mthStr] = (datesRev[mthStr] || 0) + amnt;
          } catch(e) {}
        }
      });

      const revenueTrend = Object.entries(datesRev)
        .map(([date, amount]) => ({ date, Revenue: Math.round(amount) }))
        .slice(-6); // last 6 months

      setStats(prev => ({ ...prev, totalRevenue: totalRev, monthlyRevenue: monthlyRev }));
      setChartsConfig(prev => ({ ...prev, revenueTrend }));
      
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    // 3. Fetch Global Trades Data
    let unsubscribeTradesDetails = () => {};
    // Only super/admin can read all trades via collectionGroup usually
    try {
      const qAllTrades = query(collectionGroup(db, 'trades'));
      unsubscribeTradesDetails = onSnapshot(qAllTrades, (snapshot) => {
        let ttlTrades = 0;
        let ttlPnl = 0;
        let winners = 0;

        snapshot.docs.forEach(doc => {
          const t = doc.data();
          ttlTrades++;
          if (t.pnl) ttlPnl += t.pnl;
          if (t.pnl > 0) winners++;
        });

        const winRate = ttlTrades > 0 ? Math.round((winners / ttlTrades) * 100) : 0;
        setStats(prev => ({ ...prev, totalTrades: ttlTrades, globalPnL: ttlPnl, globalWinRate: winRate }));
      }, (error) => console.log('Trade stats skipped (permissions)')); // Silently fail if DB rules block massive collectionGroup reads for standard admins
    } catch (e) {}

    // 4. Fetch Recent Logs (Combined feed of users, payments, trades)
    // For human readable logs, we fetch the latest of each and merge
    const qRecentTrades = query(collectionGroup(db, 'trades'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeTrades = onSnapshot(qRecentTrades, async (snapshot) => {
      const tradesData = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          date: d.date?.toDate ? d.date.toDate() : new Date(),
          _source: 'trade',
          _time: d.createdAt?.toDate ? d.createdAt.toDate() : (d.date?.toDate ? d.date.toDate() : new Date())
        };
      });

      // Enrich trades
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap: Record<string, any> = {};
      usersSnap.docs.forEach(d => userMap[d.id] = d.data());

      let enrichedTrades = tradesData.map((t: any) => ({
        ...t,
        userName: userMap[t.userId]?.displayName || userMap[t.userId]?.email || 'Client'
      }));
      setRecentTrades(enrichedTrades.slice(0, 5));

      // Append to logs
      setSystemLogs(prev => {
        const other = prev.filter(l => l._source !== 'trade');
        const these = enrichedTrades.map(t => ({
          id: `t_${t.id}`,
          _source: 'trade',
          time: t._time,
          text: `Le client ${t.userName} a clôturé un trade sur ${t.pair} avec un ${t.pnl >= 0 ? 'gain de ' + formatCurrency(t.pnl) : 'perte de ' + formatCurrency(t.pnl)}.`
        }));
        return [...other, ...these].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 15);
      });
      setLoading(false);
    });

    const qRecentUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeRecentUsers = onSnapshot(qRecentUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: `u_${doc.id}`,
        _source: 'user',
        time: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(),
        text: `Nouveau client inscrit : ${doc.data().displayName || doc.data().email || 'Sans nom'} depuis ${doc.data().country || 'pays inconnu'}.`
      }));
      setSystemLogs(prev => {
        const other = prev.filter(l => l._source !== 'user');
        return [...other, ...usersData].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 15);
      });
    });

    const qRecentPayments = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeRecentPayments = onSnapshot(qRecentPayments, async (snapshot) => {
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap: Record<string, any> = {};
      usersSnap.docs.forEach(d => userMap[d.id] = d.data());

      const paymentsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const userName = userMap[data.userId]?.displayName || userMap[data.userId]?.email || 'Client';
        return {
          id: `p_${doc.id}`,
          _source: 'payment',
          time: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          text: `Paiement ${data.status === 'completed' ? 'réussi' : 'échoué'} de ${formatCurrency(data.amount || 0)} par ${userName} pour l'abonnement ${data.planId || 'Inconnu'}.`
        };
      });
      setSystemLogs(prev => {
        const other = prev.filter(l => l._source !== 'payment');
        return [...other, ...paymentsData].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 15);
      });
    });

    return () => {
      unsubscribeUsers();
      unsubscribePayments();
      unsubscribeTradesDetails();
      unsubscribeTrades();
      unsubscribeRecentUsers();
      unsubscribeRecentPayments();
    };
  }, [profile]);

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-2xl md:text-4xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">Console Décisionnelle</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">
            Vue architecturale de l'écosystème. Analysez les métriques clés, les transactions financières et le flux des clients.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button 
            onClick={handleClear}
            disabled={isSeeding}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-2xl font-bold text-xs md:text-sm hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            Purger Démo
          </button>
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zoya-red text-white px-5 py-2.5 rounded-2xl shadow-lg shadow-zoya-red/20 font-bold text-xs md:text-sm hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isSeeding ? <RefreshCw className="animate-spin" size={16} /> : <Database size={16} />}
            Simuler Données
          </button>
        </div>
      </div>

      {/* KPI Row 1: Users & Finance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KPIBox 
          title="Clients Inscrits" 
          value={stats.totalUsers} 
          subtitle={`+${stats.newUsers30d} les 30 derniers jours`}
          icon={Users}
          colorClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
        />
        <KPIBox 
          title="Clients Actifs" 
          value={stats.activeUsers} 
          subtitle="Abonnés pro ou intégrés"
          icon={Activity}
          colorClass="text-emerald-600 dark:text-emerald-400"
          bgClass="bg-emerald-50 dark:bg-emerald-900/20"
        />
        <KPIBox 
          title="Revenu Total" 
          value={formatCurrency(stats.totalRevenue)} 
          subtitle="Historique complet"
          icon={DollarSign}
          colorClass="text-purple-600 dark:text-purple-400"
          bgClass="bg-purple-50 dark:bg-purple-900/20"
        />
        <KPIBox 
          title="Revenu Mensuel" 
          value={formatCurrency(stats.monthlyRevenue)} 
          subtitle="Ce mois-ci"
          icon={CreditCard}
          colorClass="text-amber-600 dark:text-amber-400"
          bgClass="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* KPI Row 2: Trading Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <div className="md:col-span-1 bg-gradient-to-br from-gray-900 to-gray-800 p-6 md:p-8 rounded-[32px] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <BarChart3 size={120} className="text-white" />
          </div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Volume de Trades</p>
          <p className="text-3xl md:text-5xl font-poppins font-black text-white">{stats.totalTrades}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-gray-400">
            <Target size={14} className="text-zoya-red" />
            Win Rate Global: <span className="text-white">{stats.globalWinRate}%</span>
          </div>
        </div>

        <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] shadow-lg border border-gray-100 dark:border-gray-700">
           <div className="flex justify-between items-start mb-6">
             <div>
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">PnL Global Clients</p>
               <h3 className={cn(
                 "text-3xl md:text-5xl font-poppins font-black",
                 stats.globalPnL >= 0 ? "text-emerald-500" : "text-rose-500"
               )}>
                 {formatCurrency(stats.globalPnL)}
               </h3>
             </div>
             <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl">
               <TrendingUp size={24} className={stats.globalPnL >= 0 ? "text-emerald-500" : "text-rose-500"} />
             </div>
           </div>
           <p className="text-sm text-gray-500 dark:text-gray-400">
             Ceci représente la somme totale des profits et pertes de l'ensemble des clients sur la plateforme.
           </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            Acquisition Clients
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsConfig.usersGrowth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.2} />
                <XAxis dataKey="date" 
                  axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} 
                />
                <YAxis 
                  axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: '#1f2937', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Nouveaux" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <DollarSign size={16} className="text-zoya-red" />
            Historique des Revenus
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsConfig.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.2} />
                <XAxis dataKey="date" 
                  axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} 
                />
                <YAxis 
                  tickFormatter={(val) => `$${val}`}
                  axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} width={40}
                />
                <Tooltip 
                  formatter={(val) => [`$${val}`, 'Revenu']}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="Revenue" fill="#cf102d" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Country Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 md:col-span-2">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe size={16} className="text-indigo-500" />
                Démographie
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Répartition géographique des clients par pays d'origine lors de l'inscription.
              </p>
              <div className="space-y-3">
                {chartsConfig.countryDistribution.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{entry.name}</span>
                    </div>
                    <span className="text-xs font-black text-gray-900 dark:text-white">{entry.value} clients</span>
                  </div>
                ))}
                {chartsConfig.countryDistribution.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Pas de données locales</p>
                )}
              </div>
            </div>
            <div className="w-full md:w-2/3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsConfig.countryDistribution}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartsConfig.countryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Tables & Logs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Trades Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 flex justify-between items-center border-b border-gray-50 dark:border-gray-700">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-zoya-red" />
              Pulse Trading
            </h3>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Live
            </span>
          </div>
          <div className="p-4 md:p-6 space-y-3 flex-1">
            {recentTrades.map((trade) => (
               <div key={`tr_${trade.id}`} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl flex justify-between items-center group hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
                 <div className="flex items-center gap-3">
                   <div className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                     trade.direction === 'buy' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                   )}>
                     {trade.direction === 'buy' ? 'B' : 'S'}
                   </div>
                   <div>
                     <p className="text-xs font-black text-gray-900 dark:text-white uppercase">{trade.pair}</p>
                     <p className="text-[10px] text-gray-500">{trade.userName} • {safeDateFormat(trade.date || new Date(), 'HH:mm:ss')}</p>
                   </div>
                 </div>
                 <div className={cn(
                   "text-sm font-black",
                   trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                 )}>
                   {formatCurrency(trade.pnl)}
                 </div>
               </div>
            ))}
            {recentTrades.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-xs italic font-medium">
                En attente des premiers trades du réseau...
              </div>
            )}
          </div>
        </div>

        {/* System Logs */}
        <div className="bg-gray-900 rounded-[32px] shadow-sm overflow-hidden flex flex-col relative text-gray-300">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Database size={200} />
          </div>
          <div className="p-6 md:p-8 flex justify-between items-center border-b border-gray-800 z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-indigo-400" />
              Interprèteur Système
            </h3>
          </div>
          <div className="p-6 space-y-5 flex-1 z-10 max-h-[600px] overflow-y-auto">
             {systemLogs.map((log) => (
                <div key={log.id} className="relative pl-6 before:content-[''] before:absolute before:left-[11px] before:top-6 before:bottom-[-20px] before:w-[2px] before:bg-gray-800 last:before:hidden">
                  <div className={cn(
                    "absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-4 border-gray-900",
                    log._source === 'user' ? "bg-blue-500" : 
                    log._source === 'payment' ? "bg-amber-500" : "bg-emerald-500"
                  )}>
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-gray-500">
                       {safeDateFormat(log.time, 'dd MMM à HH:mm')}
                    </span>
                    <p className="text-sm font-medium mt-1 leading-relaxed text-gray-200">
                      {log.text}
                    </p>
                  </div>
                </div>
             ))}
             {systemLogs.length === 0 && (
               <div className="py-10 text-center text-gray-600 text-xs italic font-medium font-mono">
                 [ SYSLOG VIDE. EN ATTENTE D'ÉVÉNEMENTS ]
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Sub-components
function KPIBox({ title, value, subtitle, icon: Icon, colorClass, bgClass }: { title: string, value: string | number, subtitle: string, icon: any, colorClass: string, bgClass: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-5 md:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", bgClass)}>
          <Icon size={20} className={colorClass} />
        </div>
      </div>
      <div>
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</h4>
        <div className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white truncate">{value}</div>
        <p className="text-[10px] text-gray-500 font-medium mt-2">{subtitle}</p>
      </div>
    </div>
  );
}
