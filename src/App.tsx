import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth, auth } from './lib/auth';
import { LanguageProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import { ClientLayout } from './components/templates/client/ClientLayout';
import { AdminLayout } from './components/templates/admin/AdminLayout';
import { db } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AlertTriangle } from 'lucide-react';

// Client Pages
import Auth from './pages/Auth';
import ActivityAdmin from './pages/admin/ActivityAdmin';

// Existing imports remain as they are below
import Dashboard from './pages/client/Dashboard';
import AddTrade from './pages/client/AddTrade';
import ImportTrades from './pages/client/ImportTrades';
import Settings from './pages/client/Settings';
import ProfileSettings from './pages/settings/ProfileSettings';
import SecuritySettings from './pages/settings/SecuritySettings';
import TradingSettings from './pages/settings/TradingSettings';
import BrokerConnections from './pages/settings/BrokerConnections';
import Onboarding from './pages/client/Onboarding';
import StrategyBuilder from './pages/client/StrategyBuilder';
import Notebook from './pages/client/Notebook';
import AICoach from './pages/client/AICoach';
import Journal from './pages/client/Journal';
import Academy from './pages/client/Academy';
import TradeView from './pages/client/TradeView';
import Statistics from './pages/client/Statistics';
import Calendar from './pages/client/Calendar';
import News from './pages/client/News';
import Alerts from './pages/client/Alerts';
import Subscription from './pages/client/Subscription';
import FAQ from './pages/client/FAQ';
import Support from './pages/client/Support';
import SecretAdminPortal from './pages/SecretAdminPortal';
import LandingPage from './pages/LandingPage';

// Admin Pages
import BillingSettings from './pages/settings/BillingSettings';
import AdminRoute from './components/auth/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ClientManagement from './pages/admin/ClientManagement';
import SystemReports from './pages/admin/SystemReports';
import AdminLogs from './pages/admin/AdminLogs';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminSettings from './pages/admin/AdminSettings';
import PricingManagement from './pages/admin/PricingManagement';
import FinanceManagement from './pages/admin/FinanceManagement';
import Transactions from './pages/admin/Transactions';
import TradeReporting from './pages/admin/TradeReporting';
import SubscriptionReports from './pages/admin/SubscriptionReports';

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950">
    <div className="relative flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 rounded-full"></div>
      <div className="w-16 h-16 border-4 border-rose-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
      <div className="absolute w-6 h-6 bg-rose-500 rounded-full animate-pulse"></div>
    </div>
    <h2 className="mt-8 text-xl font-bold text-gray-900 dark:text-white font-poppins tracking-tight">ZoyaEdge</h2>
    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Chargement de votre espace...</p>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    if (window.location.pathname === '/' || window.location.pathname === '/home') {
      return null;
    }
    return <LoadingScreen />;
  }
  if (!user) return <Navigate to="/home" replace />;
  
  // Redirect to onboarding if not completed
  if (profile && !profile.onboarded && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const [isSuper, setIsSuper] = React.useState(false);
  const { user, profile, loading, isSuperAdmin } = useAuth();
  const [maintenance, setMaintenance] = React.useState(false);

  React.useEffect(() => {
    const checkSuper = async () => {
      if (user?.email) {
        const res = await isSuperAdmin(user.email);
        setIsSuper(res);
      } else {
        setIsSuper(false);
      }
    };
    checkSuper();
  }, [user, isSuperAdmin]);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'app_settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setMaintenance(snapshot.data().maintenanceMode);
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("Global Settings Error:", error);
      }
    });
    return () => unsubscribe();
  }, []);

  // Keep-alive mechanism: Pings server every 5 minutes for 4 hours to prevent sleep during testing
  React.useEffect(() => {
    const startTime = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    
    const interval = setInterval(() => {
      if (Date.now() - startTime > FOUR_HOURS) {
        clearInterval(interval);
        return; // Stops pinging after 4 hours, letting the container sleep
      }
      // Simple health ping
      fetch('/api/health').catch((err) => console.log('Keep-alive ping failed', err));
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isBypassedAgent = profile?.role === 'agent' && profile?.bypassMaintenance;
  const canBypassMaintenance = isSuper || isAdmin || isBypassedAgent;

  const isLandingPage = window.location.pathname === '/home';

  if (maintenance && !canBypassMaintenance && !isLandingPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-8 text-center">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center text-amber-600 mb-6">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white mb-2">Mode Maintenance</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          ZoyaEdge est actuellement en maintenance pour améliorer nos services. Nous serons de retour très bientôt.
        </p>
        {user && (
          <button 
            onClick={() => auth.signOut()}
            className="mt-8 px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-2xl font-bold text-gray-700 dark:text-gray-300"
          >
            Se déconnecter
          </button>
        )}
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/home" element={<LandingPage />} />
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/zoya-admin-access" element={<SecretAdminPortal />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          {profile?.onboarded ? <Navigate to="/" /> : <Onboarding />}
        </ProtectedRoute>
      } />
      <Route path="/" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="add" element={<AddTrade />} />
        <Route path="import" element={<ImportTrades />} />
        <Route path="ai-coach" element={<AICoach />} />
        <Route path="strategies" element={<StrategyBuilder />} />
        <Route path="notebook" element={<Notebook />} />
        <Route path="journal" element={<Journal />} />
        <Route path="academy" element={<Academy />} />
        <Route path="trade-view" element={<TradeView />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="news" element={<News />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="support" element={<Support />} />
        <Route path="settings" element={<Settings />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="billing" element={<BillingSettings />} />
          <Route path="connections" element={<BrokerConnections />} />
          <Route path="preferences" element={<TradingSettings />} />
        </Route>
      </Route>

      {/* Admin Routes */}
      <Route element={<AdminRoute requiredRole="agent" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/finance" element={<FinanceManagement />} />
          <Route path="/admin/pricing" element={<PricingManagement />} />
          <Route path="/admin/transactions" element={<Transactions />} />
          <Route path="/admin/activities" element={<ActivityAdmin />} />
          <Route path="/admin/trade-reports" element={<TradeReporting />} />
          <Route path="/admin/subscription-reports" element={<SubscriptionReports />} />
          <Route path="/admin/clients" element={<ClientManagement />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/connections" element={<div className="p-8">Gestion des Connexions EA (Global)</div>} />
          <Route path="/admin/reports" element={<SystemReports />} />
          <Route path="/admin/notifications" element={<AdminNotifications />} />
          <Route path="/admin/ai" element={<div className="p-8 text-white">Monitoring IA (Connection en cours...)</div>} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="zoya-theme">
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" />
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
