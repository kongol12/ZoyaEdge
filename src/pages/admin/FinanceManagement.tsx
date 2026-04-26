import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where, getDocs, doc } from 'firebase/firestore';
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
  Area,
  Line 
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
  operator?: string; // New field for payment channel (M-Pesa, etc)
  fee?: number;
  createdAt: Timestamp;
  isDemo?: boolean;
}

export default function FinanceManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [displayCount, setDisplayCount] = useState(15);
  const [dynamicPricing, setDynamicPricing] = useState({ exchangeRate: 2800 });
  
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
    planDistribution: {
      discovery: 0,
      pro: 0,
      premium: 0,
      totalPaid: 0
    },
    chartData: [] as { 
      name: string, 
      revenueUSD: number, 
      revenueCDF: number, 
      zoyaPayFeeUSD: number, 
      zoyaPayFeeCDF: number,
      revenueCDFProjection?: number 
    }[]
  });

  useEffect(() => {
    // Fetch Settings for Exchange Rate
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'global'), (doc) => {
      if (doc.exists()) {
        setDynamicPricing(prev => ({ ...prev, exchangeRate: doc.data().exchangeRate || 2800 }));
      }
    });

    // Ne prendre que de vraies données
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentRecord);
      
      let enrichedData = txs;
      const userMap: Record<string, any> = {};
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
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
      
      // Calculate basic stats
      let tUSD = 0, tCDF = 0, mUSD = 0, mCDF = 0, zFeeUSD = 0, zFeeCDF = 0;
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Loyalty calculation: Count unique users with more than 1 completed payment
      const userPaymentCounts: Record<string, number> = {};
      
      data.forEach(curr => {
        if (curr.status === 'completed' && curr.amount > 0) {
           userPaymentCounts[curr.userId] = (userPaymentCounts[curr.userId] || 0) + 1;

           if (curr.currency === 'CDF') {
             tCDF += curr.amount;
             if (curr.createdAt && curr.createdAt.toDate() >= firstDayOfMonth) mCDF += curr.amount;
             if (curr.fee) zFeeCDF += curr.fee;
           } else {
             tUSD += curr.amount;
             if (curr.createdAt && curr.createdAt.toDate() >= firstDayOfMonth) mUSD += curr.amount;
             if (curr.fee) zFeeUSD += curr.fee;
           }
        }
      });

      const loyaltyCount = Object.values(userPaymentCounts).filter(count => count >= 2).length;

      // Chart data...
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

      const currentMonthIndex = now.getMonth();
      const historicalData = months
        .map((name, index) => ({ 
          name, 
          revenueUSD: monthlyData[name]?.usd || 0,
          revenueCDF: monthlyData[name]?.cdf || 0,
          zoyaPayFeeUSD: monthlyData[name]?.feeUSD || 0,
          zoyaPayFeeCDF: monthlyData[name]?.feeCDF || 0,
          revenueCDFProjection: undefined as number | undefined
        }))
        .filter((_, i) => i <= currentMonthIndex);

      // Aligné sur le taux de change dynamique
      const EXCHANGE_RATE = dynamicPricing.exchangeRate || 2800;
      const normalizedHistorical = historicalData.map(d => ({
        ...d,
        revenueUSD: d.revenueUSD || (d.revenueCDF / EXCHANGE_RATE)
      }));

      // Simple Linear Regression for CDF Projection
      const cdfValues = historicalData.map((d, i) => ({ x: i, y: d.revenueCDF }));
      let projectionData = historicalData.map(d => ({ ...d, revenueUSD: d.revenueUSD as number | null }));
      
      if (historicalData.length >= 2) {
        const n = historicalData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
          sumX += i;
          sumY += cdfValues[i].y;
          sumXY += i * cdfValues[i].y;
          sumX2 += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        projectionData[currentMonthIndex] = {
          ...projectionData[currentMonthIndex],
          revenueCDFProjection: historicalData[currentMonthIndex].revenueCDF
        };

        for (let i = 1; i <= 3; i++) {
          const nextMonthIndex = (currentMonthIndex + i) % 12;
          const x = n + i - 1;
          const predictedValue = Math.max(0, slope * x + intercept);
          
          projectionData.push({
            name: months[nextMonthIndex],
            revenueUSD: null as any,
            revenueCDF: null as any,
            zoyaPayFeeUSD: null as any,
            zoyaPayFeeCDF: null as any,
            revenueCDFProjection: predictedValue
          });
        }
      }

      // Sync user stats
      const users = Object.values(userMap);
      
      // Active paid users (excluding free and those strictly in trial)
      const active = users.filter((u: any) => 
        u.subscription !== 'free' && 
        u.subscriptionStatus === 'active'
      ).length;

      // Active trials specifically for Zoya Pro
      const trialing = users.filter((u: any) => u.subscription === 'pro' && u.subscriptionStatus === 'trialing').length;
      
      const planDist = {
        discovery: users.filter((u: any) => u.subscription === 'discovery').length,
        pro: users.filter((u: any) => u.subscription === 'pro' && u.subscriptionStatus === 'active').length,
        premium: users.filter((u: any) => u.subscription === 'premium').length,
        totalPaid: users.filter((u: any) => u.subscription !== 'free' && u.subscriptionStatus === 'active').length
      };

      // Real conversion: unique users who were trialing and now have a paid plan
      // We check hasUsedTrial and current status is active paid
      const convertedCount = users.filter((u: any) => u.hasUsedTrial && u.subscription !== 'free' && u.subscriptionStatus === 'active').length;

      setStats(prev => ({
        ...prev,
        totalRevenueUSD: tUSD,
        totalRevenueCDF: tCDF,
        monthlyRevenueUSD: mUSD,
        monthlyRevenueCDF: mCDF,
        zoyaPayRevenueUSD: zFeeUSD,
        zoyaPayRevenueCDF: zFeeCDF,
        activeSubscriptions: active,
        trialingUsers: trialing,
        resubscribedUsers: loyaltyCount, // Now using multi-payment logic
        conversionRate: users.length > 0 ? (convertedCount / users.length) * 100 : 0,
        planDistribution: planDist,
        chartData: projectionData.length > 0 ? projectionData : [{ name: months[now.getMonth()], revenueUSD: 0, revenueCDF: 0, zoyaPayFeeUSD: 0, zoyaPayFeeCDF: 0, revenueCDFProjection: undefined }] as any
      }));
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const EXCHANGE_RATE = dynamicPricing.exchangeRate || 2800; // Aligné sur le taux de change dynamique
  // Calculer le Max pour aligner les axes
  const maxUSDVal = Math.max(
    ...stats.chartData.map(d => Number(d.revenueUSD) || 0),
    ...stats.chartData.map(d => (Number(d.revenueCDF) || 0) / EXCHANGE_RATE),
    ...stats.chartData.map(d => (Number(d.revenueCDFProjection) || 0) / EXCHANGE_RATE)
  ) || 100;
  
  const yAxisDomainUSD = [0, Math.ceil(maxUSDVal * 1.15 / 10) * 10];
  const yAxisDomainCDF = [0, (yAxisDomainUSD[1] * EXCHANGE_RATE)];

  const filteredPayments = payments
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .slice(0, displayCount);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">Chargement des données financières...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white">Gestion Financière</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Suivi des revenus, abonnements et performances comptables.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-gray-800 px-4 py-2.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 font-bold text-xs md:text-sm">
            <Calendar size={18} className="text-indigo-500" />
            Ce Mois
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zoya-red text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl shadow-lg shadow-zoya-red/20 font-bold text-xs md:text-sm">
            <Download size={18} />
            Exporter
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Revenu Total USD', value: `${stats.totalRevenueUSD.toLocaleString()} $`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', trend: '+12.5%' },
          { label: 'Revenu Total CDF', value: `${stats.totalRevenueCDF.toLocaleString()} FC`, icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', trend: 'Direct' },
          { 
            label: 'Revenu ZoyaPay (Fees)', 
            value: (
              <div className="flex flex-col">
                <span className="text-lg md:text-xl">{stats.zoyaPayRevenueUSD.toLocaleString()} $</span>
                <span className="text-[10px] md:text-xs opacity-60 leading-tight">{stats.zoyaPayRevenueCDF.toLocaleString()} FC</span>
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
            className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-2.5 md:p-3 rounded-2xl", stat.bg)}>
                <stat.icon size={22} className={stat.color} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[9px] md:text-[10px] font-black px-2 py-1 rounded-full",
                stat.trend === 'Actifs' || stat.trend === 'Loyauté' || stat.trend === 'Frais Admin' ? "bg-gray-50 dark:bg-gray-900 text-gray-500" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
              )}>
                {stat.trend.includes('%') && <ArrowUpRight size={10} />}
                {stat.trend}
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
            {typeof stat.value === 'string' ? (
              <p className="text-lg md:text-xl lg:text-2xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
            ) : (
              <div className="font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Croissance des Revenus</h3>
              <p className="text-xs md:text-sm text-gray-500">Evolution du chiffre d'affaires & Frais ZoyaPay.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-zoya-red" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">USD</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">CDF</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 border border-blue-500 border-dashed rounded-full" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">Projection</span>
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
                  domain={yAxisDomainUSD}
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${value}$`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  domain={yAxisDomainCDF}
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
                  connectNulls
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="revenueCDFProjection" 
                  name="Projection CDF"
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fillOpacity={0.05} 
                  fill="#3B82F6"
                  connectNulls
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Répartition par Plan</h3>
              <p className="text-xs text-gray-400 font-bold">Clients payants actifs</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-poppins font-black text-zoya-red">
                {stats.planDistribution.totalPaid}
              </p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Payants</p>
            </div>
          </div>
          <div className="space-y-6 flex-1">
            {[
              { label: 'Discovery', count: stats.planDistribution.discovery, total: stats.planDistribution.totalPaid, color: 'bg-emerald-500' },
              { label: 'Zoya Pro', count: stats.planDistribution.pro, total: stats.planDistribution.totalPaid, color: 'bg-zoya-red' },
              { label: 'Zoya Premium', count: stats.planDistribution.premium, total: stats.planDistribution.totalPaid, color: 'bg-orange-500' },
            ].map((plan) => (
              <div key={plan.label} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-600 dark:text-gray-400">{plan.label}</span>
                  <span className="font-black text-gray-900 dark:text-white">{plan.count} clients</span>
                </div>
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(plan.count / (plan.total || 1)) * 100}%` }}
                    className={cn("h-full rounded-full shadow-sm", plan.color)}
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
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Résumé des Essais</p>
              <p className="text-xs text-gray-500">Les nouveaux utilisateurs bénéficient de l'essai gratuit Zoya Pro de 7 jours, non comptabilisé financièrement.</p>
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
          <div className="space-y-6">
            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[32px] border border-blue-100 dark:border-blue-900/20">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Zoya Pro (Essais Actifs 7j)</p>
                  <p className="text-xs text-gray-500 font-medium">Flux d'acquisition constant</p>
                </div>
                <Users className="text-blue-500" size={20} />
              </div>
              <p className="text-4xl font-poppins font-black text-blue-600">{stats.trialingUsers}</p>
            </div>
            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-[32px] border border-emerald-100 dark:border-emerald-900/20">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Réabonnements (LOYAUTÉ)</p>
                  <p className="text-xs text-gray-500 font-medium">Clients ayant déjà renouvelé</p>
                </div>
                <TrendingUp className="text-emerald-500" size={20} />
              </div>
              <p className="text-4xl font-poppins font-black text-emerald-600">{stats.resubscribedUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-gray-800 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Transactions Récentes</h3>
              <Link to="/admin/transactions" className="text-[10px] font-black text-zoya-red uppercase tracking-widest hover:underline flex items-center gap-1">
                Voir tout <ArrowUpRight size={10} />
              </Link>
            </div>
            <p className="text-xs text-gray-400 font-bold">Filtrez et suivez les derniers paiements encaissés.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-xs font-black text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-zoya-red/20 outline-none cursor-pointer"
            >
              <option value="all">Tous les Statuts</option>
              <option value="completed">Succès</option>
              <option value="pending">En attente</option>
              <option value="failed">Échec</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-4">Client / ID</th>
                <th className="px-8 py-4">Plan</th>
                <th className="px-8 py-4">Montant</th>
                <th className="px-8 py-4">Canal / Opérateur</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filteredPayments.length > 0 ? filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400 font-black text-xs">
                        {payment.userName?.charAt(0).toUpperCase() || "U"}
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
                      payment.plan === 'premium' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30" : 
                      payment.plan === 'pro' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" :
                      "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                    )}>
                      {payment.plan === 'pro' ? 'Zoya Pro' : 
                       payment.plan === 'premium' ? 'Zoya Premium' : 
                       payment.plan === 'discovery' ? 'Discovery' : payment.plan}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <p className="font-black text-gray-900 dark:text-white uppercase">
                      {payment.amount.toLocaleString()} <span className="text-[10px] opacity-60 ml-0.5">{payment.currency}</span>
                    </p>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                       <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">
                          <span className="text-[10px] font-black text-gray-500 uppercase">
                            {(() => {
                              const op = (payment.operator || payment.method || '').toUpperCase();
                              if (op === 'MPESA') return 'M-Pesa';
                              if (op === 'ORANGE') return 'Orange Money';
                              if (op === 'AIRTEL') return 'Airtel Money';
                              if (op === 'MOBILE_MONEY' || op === 'MOBILE MONEY') return 'Mobile Money';
                              return op || 'N/A';
                            })()}
                          </span>
                       </div>
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
                      payment.status === 'completed' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" :
                      payment.status === 'pending' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" :
                      "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                    )}>
                      {payment.status === 'completed' ? 'Succès' : payment.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-400 font-bold italic">
                    Aucune transaction trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/Tablet Card View */}
        <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
          {filteredPayments.length > 0 ? filteredPayments.map((payment) => (
            <div key={payment.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 font-black text-xs">
                    {payment.userName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[120px]">
                      { payment.userName || payment.userEmail || payment.userId }
                    </p>
                    <p className="text-[10px] text-gray-400">ID: {payment.id.slice(0, 8)}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                  payment.status === 'completed' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" :
                  payment.status === 'pending' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" :
                  "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                )}>
                  {payment.status === 'completed' ? 'Succès' : payment.status}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <div className="space-y-1">
                   <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg block w-fit",
                    payment.plan === 'premium' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30" : 
                    payment.plan === 'pro' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" :
                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                  )}>
                    {payment.plan}
                  </span>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {format(payment.createdAt.toDate(), 'dd MMM, HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-poppins font-black text-gray-900 dark:text-white">
                    {payment.amount.toLocaleString()} <span className="text-[10px] opacity-60 ml-0.5 font-bold">{payment.currency}</span>
                  </p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {payment.operator || payment.method || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-gray-400 font-bold italic">
              Aucune transaction trouvée.
            </div>
          )}
        </div>
        {payments.length > displayCount && filterStatus === 'all' && (
          <div className="p-6 text-center border-t border-gray-100 dark:border-gray-700">
             <button 
               onClick={() => setDisplayCount(prev => prev + 15)}
               className="text-xs font-black text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
             >
               Charger plus de transactions
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
