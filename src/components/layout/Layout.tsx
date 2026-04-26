import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  BrainCircuit, 
  LogOut, 
  Settings, 
  ListChecks, 
  BookOpen, 
  Sun, 
  Moon,
  Book,
  GraduationCap,
  BarChart2,
  Calendar,
  Newspaper,
  Bell,
  User,
  CreditCard,
  HelpCircle,
  LifeBuoy,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Layout() {
  const { user, profile, logout } = useAuth();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const menuGroups = [
    {
      title: t.common.categories.principal,
      items: [
        { name: t.common.dashboard, path: '/', icon: LayoutDashboard },
        { name: t.common.addTrade, path: '/add', icon: PlusCircle },
        { name: t.common.journal, path: '/journal', icon: Book },
        { name: t.common.academy, path: '/academy', icon: GraduationCap },
      ]
    },
    {
      title: t.common.categories.analyse,
      items: [
        { name: t.common.statistics, path: '/statistics', icon: BarChart2 },
        { name: t.dashboard.coachTitle, path: '/ai-coach', icon: BrainCircuit },
        { name: t.notebook.title, path: '/notebook', icon: BookOpen },
        { name: t.strategies.title, path: '/strategies', icon: ListChecks },
      ]
    },
    {
      title: t.common.categories.marketData,
      items: [
        { name: t.common.calendar, path: '/calendar', icon: Calendar },
        { name: t.common.news, path: '/news', icon: Newspaper },
        { name: t.common.alerts, path: '/alerts', icon: Bell, badge: t.common.soon },
      ]
    },
    {
      title: t.common.categories.settings,
      items: [
        { name: t.common.profile, path: '/settings/profile', icon: User },
        { name: t.common.security, path: '/settings/security', icon: ShieldCheck },
        { name: t.common.preferences, path: '/settings/preferences', icon: Settings },
        { name: t.common.subscription, path: '/subscription', icon: CreditCard },
        { name: t.common.faq, path: '/faq', icon: HelpCircle },
        { name: t.common.support, path: '/support', icon: LifeBuoy },
      ]
    },
    ...(profile?.role === 'admin' || profile?.role === 'agent' || profile?.email?.toLowerCase() === import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase() ? [{
      title: "Administration",
      items: [
        { name: "Console Admin", path: '/admin', icon: ShieldCheck },
      ]
    }] : [])
  ];

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white md:flex transition-colors duration-300">
      {/* Sidebar (Desktop) */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 80 : 288 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 fixed h-full transition-colors duration-300 z-40"
      >
        <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-poppins font-black tracking-tight text-zoya-red"
            >
              ZoyaEdge
            </motion.h1>
          )}
          <button 
            onClick={toggleSidebar} 
            className="p-2 text-gray-500 hover:text-zoya-red dark:text-gray-400 dark:hover:text-zoya-red transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-6 overflow-y-auto pb-8 scrollbar-hide">
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              {!isCollapsed && (
                <motion.h3 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 text-[10px] font-poppins font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest"
                >
                  {group.title}
                </motion.h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.name : ""}
                      className={cn(
                        "flex items-center px-4 py-2.5 rounded-2xl font-medium transition-all duration-300 text-sm group",
                        isCollapsed ? "justify-center" : "justify-between",
                        isActive 
                          ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-zoya-red dark:hover:text-zoya-red"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={cn("transition-colors", isActive ? "text-white" : "group-hover:text-zoya-red")} />
                        {!isCollapsed && <span>{item.name}</span>}
                      </div>
                      {!isCollapsed && item.badge && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-full font-bold uppercase tracking-tighter">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Theme Toggle & User Profile Section */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 space-y-2">
          {!isCollapsed && (
            <button 
              onClick={toggleTheme} 
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-zoya-red dark:hover:text-zoya-red transition-all rounded-2xl"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          )}
          
          <div className={cn("flex items-center gap-3 px-3 py-2", isCollapsed ? "justify-center" : "")}>
            <div className="w-10 h-10 rounded-2xl bg-zoya-red-accent flex items-center justify-center text-zoya-red font-poppins font-black shadow-sm flex-shrink-0">
              {profile?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-poppins font-bold text-gray-900 dark:text-white truncate">
                  {profile?.displayName || 'User'}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    profile?.subscription === 'premium' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                    profile?.subscription === 'pro' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                    "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  )}>
                    {profile?.subscription || 'Free'}
                  </span>
                </div>
              </motion.div>
            )}
            {!isCollapsed && (
              <button 
                onClick={() => logout()}
                className="p-2 text-gray-400 hover:text-zoya-red transition-colors"
                title={t.common.logout}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
          {isCollapsed && (
            <button 
              onClick={() => logout()}
              className="w-full flex justify-center p-2 text-gray-400 hover:text-zoya-red transition-colors"
              title={t.common.logout}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <motion.main 
        initial={false}
        animate={{ 
          paddingLeft: isMobile ? 0 : (isCollapsed ? 80 : 288) 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 w-full min-w-0"
      >
        <div className="p-4 md:p-8 lg:p-10 min-h-screen">
          <div className="w-full space-y-8">
            {/* Mobile Header */}
            <div className="md:hidden flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMobileMenuOpen(true)} 
                  className="p-2.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Menu size={20} />
                </button>
                <div className="flex flex-col">
                  <h1 className="text-lg font-poppins font-black leading-none tracking-tight text-gray-900 dark:text-white">ZoyaEdge</h1>
                  <span className="text-[10px] font-medium text-zoya-red uppercase tracking-widest mt-0.5">Trader Space</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleTheme} 
                  className="p-2.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>
            </div>
            <Outlet />
          </div>
        </div>
      </motion.main>

      {/* Mobile Sidebar (Left-aligned Drawer) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 md:hidden flex flex-col"
            >
              <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                <span className="font-poppins font-black text-lg text-zoya-red">ZoyaEdge</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-500 hover:text-zoya-red">
                  <X size={20} />
                </button>
              </div>
              
              <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                {menuGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <h3 className="px-4 text-[10px] font-poppins font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      {group.title}
                    </h3>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                              "flex items-center justify-between px-4 py-2.5 rounded-2xl font-medium transition-all duration-300 text-sm group",
                              isActive 
                                ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                                : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-zoya-red dark:hover:text-zoya-red"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Icon size={18} className={cn("transition-colors", isActive ? "text-white" : "group-hover:text-zoya-red")} />
                              <span>{item.name}</span>
                            </div>
                            {item.badge && (
                              <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-full font-bold uppercase tracking-tighter">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-10 h-10 rounded-2xl bg-zoya-red-accent flex items-center justify-center text-zoya-red font-poppins font-black shadow-sm flex-shrink-0">
                    {profile?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-poppins font-bold text-gray-900 dark:text-white truncate">
                      {profile?.displayName || 'User'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                        profile?.subscription === 'premium' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                        profile?.subscription === 'pro' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {profile?.subscription || 'Free'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => logout()}
                    className="p-2 text-gray-400 hover:text-zoya-red transition-colors"
                    title={t.common.logout}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
