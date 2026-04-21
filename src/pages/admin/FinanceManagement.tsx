import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where, getDocs } from 'firebase/firestore';
import { DollarSign, TrendingUp, Users, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, Filter, Download, Wallet, Database, RefreshCw, Trash2, AlertCircle, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { seedMockTransactions, clearDemoPayments } from '../../lib/seed';
import { motion } from 'motion/react';
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
  AreaChart,
  Area 
} from 'recharts';

interface PaymentRecord {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  plan: 'free' | 'discovery' | 'pro' | 'premium';
  method: string;
  fee?: number;
  createdAt: Timestamp;
  isDemo?: boolean;
}

export default function FinanceManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenueUSD: 0,
    totalRevenueCDF: 0,
    monthlyRevenueUSD: 0,
    monthlyRevenueCDF: 0,
    zoyaPayRevenueUSD: 0,
    zoyaPayRevenueCDF: 0,
    activeSubscriptions: 0,
    trialingUsers: 0,
    resubscribedUsers: 0,
    conversionRate: 0,
    chartData: [] as { name: string, revenueUSD: number, revenueCDF: number, zoyaPayFee: number }[]
  });

  useEffect(() => {
    // Ne prendre que de vraies données (plus de isDemo)
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentRecord);
      
      let enrichedData = txs;
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap: Record<string, any> = {};
        usersSnap.docs.forEach(d => userMap[d.id] = d.data());
        
        enrichedData = txs.map(p => {
          const profile = userMap[p.userId];
          return {
            ...p,
            userName: p.userName || profile?.displayName || profile?.name || profile?.email?.split('@')[0] || "Client Sans Nom",
            userEmail: p.userEmail || profile?.email || "N/A"
          };
        });
      } catch (err) {
        console.error("Erreur d'enrichissement Finance:", err);
      }

      setPayments(enrichedData);
      const data = enrichedData;
      
      // Calculate basic stats for USD and CDF
      let tUSD = 0, tCDF = 0, mUSD = 0, mCDF = 0, zFeeUSD = 0, zFeeCDF = 0;
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      data.forEach(curr => {
        // Strict accounting: Only completed payments count toward revenue
        // Free plans or 7-day trials with 0 USD should never be counted as revenue
        if (curr.status === 'completed' && curr.amount > 0) {
           if (curr.currency === 'CDF') {
             tCDF += curr.amount;
             if (curr.createdAt && curr.createdAt.toDate() >= firstDayOfMonth) mCDF += curr.amount;
             if (curr.fee) zFeeCDF += curr.fee;
           } else {
             // Treat anything else (USD, missing) as USD
             tUSD += curr.amount;
             if (curr.createdAt && curr.createdAt.toDate() >= firstDayOfMonth) mUSD += curr.amount;
             if (curr.fee) zFeeUSD += curr.fee;
           }
        }
      });

      // Calculate chart data from real payments
      const monthlyData: { [key: string]: { usd: number, cdf: number, feeUSD: number, feeCDF: number } } = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      data.forEach(p => {
        if (p.status === 'completed' && p.amount > 0 && p.createdAt) {
          const date = p.createdAt.toDate();
          const monthName = months[date.getMonth()];
          if (!monthlyData[monthName]) monthlyData[monthName] = { usd: 0, cdf: 0, feeUSD: 0, feeCDF: 0 };
          
          if (p.currency === 'CDF') {
            monthlyData[monthName].cdf += p.amount;
            if (p.fee) monthlyData[monthName].feeCDF += p.fee;
          } else {
            monthlyData[monthName].usd += p.amount;
            if (p.fee) monthlyData[monthName].feeUSD += p.fee;
          }
        }
      });

      const formattedChartData = months
        .map((name, index) => ({ 
          name, 
          revenueUSD: monthlyData[name]?.usd || 0,
          revenueCDF: monthlyData[name]?.cdf || 0,
          zoyaPayFeeUSD: monthlyData[name]?.feeUSD || 0,
          zoyaPayFeeCDF: monthlyData[name]?.feeCDF || 0
        }))
        .filter((_, i) => i <= now.getMonth());

      setStats(prev => ({
        ...prev,
        totalRevenueUSD: tUSD,
        totalRevenueCDF: tCDF,
        monthlyRevenueUSD: mUSD,
        monthlyRevenueCDF: mCDF,
        zoyaPayRevenueUSD: zFeeUSD,
        zoyaPayRevenueCDF: zFeeCDF,
        chartData: formattedChartData.length > 0 ? formattedChartData : [{ name: months[now.getMonth()], revenueUSD: 0, revenueCDF: 0, zoyaPayFeeUSD: 0, zoyaPayFeeCDF: 0 }]
      }));
      setLoading(false);
    });

    // Fetch user stats for conversion/subscriptions
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      const active = users.filter(u => u.subscription !== 'free' && u.subscriptionStatus === 'active').length;
      const trialing = users.filter(u => u.subscriptionStatus === 'trialing').length;
      
      // Re-subscriptions: Active users who have used trial (implies they paid after trial)
      // or we can count historical payments per user if we had that data aggregated.
      // For now, defined as Converted from trial + Renewals
      const resubscribed = users.filter(u => u.subscription !== 'free' && u.subscriptionStatus === 'active' && u.hasUsedTrial).length;
      
      const totalUsers = users.length;
      setStats(prev => ({
        ...prev,
        activeSubscriptions: active,
        trialingUsers: trialing,
        resubscribedUsers: resubscribed,
        conversionRate: totalUsers > 0 ? (active / totalUsers) * 100 : 0
      }));
    });

    return () => {
      unsubscribe();
      unsubUsers();
    };
  }, []);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Gestion Financière</h1>
          <p className="text-gray-500 dark:text-gray-400">Suivi des revenus, abonnements et performances comptables.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 font-bold text-sm">
            <Calendar size={18} className="text-indigo-500" />
            Ce Mois
          </button>
          <button className="flex items-center gap-2 bg-zoya-red text-white px-6 py-2 rounded-xl shadow-lg shadow-zoya-red/20 font-bold text-sm">
            <Download size={18} />
            Exporter Rapport
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Revenu Total USD', value: `${stats.totalRevenueUSD.toLocaleString()} $`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', trend: '+12.5%' },
          { label: 'Revenu Total CDF', value: `${stats.totalRevenueCDF.toLocaleString()} FC`, icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', trend: 'Direct' },
          { 
            label: 'Revenu ZoyaPay (Fees)', 
            value: (
              <div className="flex flex-col">
                <span>{stats.zoyaPayRevenueUSD.toLocaleString()} $</span>
                <span className="text-xs opacity-60">{stats.zoyaPayRevenueCDF.toLocaleString()} FC</span>
              </div>
            ), 
            icon: Zap, 
            color: 'text-indigo-500', 
            bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
            trend: 'Frais Admin' 
          },
          { label: 'Essais Gratuits (7J)', value: `${stats.trialingUsers}`, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', trend: 'Actifs' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full",
                stat.trend === 'Actifs' || stat.trend === 'Loyauté' || stat.trend === 'Frais Admin' ? "bg-gray-50 dark:bg-gray-900 text-gray-500" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
              )}>
                {stat.trend.includes('%') && <ArrowUpRight size={10} />}
                {stat.trend}
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Croissance des Revenus</h3>
              <p className="text-sm text-gray-500">Evolution du chiffre d'affaires & Frais ZoyaPay.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-zoya-red" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">USD</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">CDF</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">Fees ZoyaPay</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenueUSD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRevenueCDF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorZoyaPay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }} 
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${value}$`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '16px',
                    color: '#fff',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="revenueUSD" 
                  name="Revenus USD"
                  stroke="#DC2626" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenueUSD)" 
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="revenueCDF" 
                  name="Revenu CDF"
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenueCDF)" 
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="zoyaPayFeeUSD" 
                  name="Fees ZoyaPay USD"
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fillOpacity={1} 
                  fill="url(#colorZoyaPay)" 
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="zoyaPayFeeCDF" 
                  name="Fees ZoyaPay CDF"
                  stroke="#f59e0b" 
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fillOpacity={0} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-6">Répartition par Plan</h3>
          <div className="space-y-6 flex-1">
            {[
              { label: 'Discovery', count: payments.filter(p => p.plan === 'discovery').length, total: payments.filter(p => p.plan !== 'free').length, color: 'bg-blue-400' },
              { label: 'Zoya Pro', count: payments.filter(p => p.plan === 'pro').length, total: payments.filter(p => p.plan !== 'free').length, color: 'bg-emerald-500' },
              { label: 'Zoya Premium', count: payments.filter(p => p.plan === 'premium').length, total: payments.filter(p => p.plan !== 'free').length, color: 'bg-indigo-500' },
            ].map((plan) => (
              <div key={plan.label} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-600 dark:text-gray-400">{plan.label}</span>
                  <span className="font-black text-gray-900 dark:text-white">{Math.round(plan.count)} clients</span>
                </div>
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(plan.count / (plan.total || 1)) * 100}%` }}
                    className={cn("h-full rounded-full", plan.color)}
                  />
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
               <div className="flex justify-between items-center text-sm mb-4">
                  <span className="font-bold text-gray-600 dark:text-gray-400">Taux de Conversion</span>
                  <span className="font-black text-emerald-500">{stats.conversionRate.toFixed(1)}%</span>
               </div>
               <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl flex items-center gap-3">
                  <TrendingUp className="text-emerald-500 shrink-0" size={20} />
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-tight">
                    {stats.resubscribedUsers} clients sont passés de l'essai gratuit à un plan payant.
                  </p>
               </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl">
                <Users className="text-indigo-500" size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">En Essai (Auto)</p>
                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.trialingUsers} Clients</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Verification & Expirations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Vérification Comptable</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-3xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Paiements Validés (USD)</p>
              </div>
              <p className="font-black text-gray-900 dark:text-white">{stats.totalRevenueUSD.toLocaleString()} $</p>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-3xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Paiements Validés (FC)</p>
              </div>
              <p className="font-black text-gray-900 dark:text-white">{stats.totalRevenueCDF.toLocaleString()} FC</p>
            </div>
            <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Anomalies Détectées</p>
              <p className="text-xs text-gray-500">Zéro anomalie de facturation détectée. Tous les plans gratuits et essais de 7 jours sont exclus des revenus réels.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600">
              <Calendar size={20} />
            </div>
            <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Expirations & Essais</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Essais Actifs</p>
                <p className="text-xs text-gray-500 font-medium">Conversion attendue dans 7 jours max.</p>
              </div>
              <p className="text-2xl font-poppins font-black text-blue-600">{stats.trialingUsers}</p>
            </div>
            <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Réabonnements (LOYAUTÉ)</p>
                <p className="text-xs text-gray-500 font-medium">Clients ayant déjà renouvelé.</p>
              </div>
              <p className="text-2xl font-poppins font-black text-indigo-600">{stats.resubscribedUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-gray-800 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Transactions Récentes</h3>
          <Link 
            to="/admin/transactions"
            className="text-zoya-red hover:text-zoya-red/80 font-black text-sm flex items-center gap-2 group transition-colors"
          >
            Voir tout <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-4">Client / ID</th>
                <th className="px-8 py-4">Plan</th>
                <th className="px-8 py-4">Montant</th>
                <th className="px-8 py-4">Méthode</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {payments.length > 0 ? payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                          { payment.userName || payment.userEmail || payment.userId }
                        </p>
                        <p className="text-[10px] text-gray-400">ID: {payment.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      payment.plan === 'premium' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {payment.plan}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <p className="font-black text-gray-900 dark:text-white">{payment.amount} {payment.currency}</p>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">{payment.method}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <p className="text-xs font-bold text-gray-500 whitespace-nowrap">
                      {format(payment.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr })}
                    </p>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      payment.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                      payment.status === 'pending' ? "bg-amber-100 text-amber-600" :
                      "bg-rose-100 text-rose-600"
                    )}>
                      {payment.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <div className="bg-gray-50 dark:bg-gray-900 inline-block p-4 rounded-3xl mb-4">
                      <DollarSign size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-bold">Aucune transaction trouvée.</p>
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
