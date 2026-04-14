import React from 'react';
import { Link, useLocation } from 'react-router';
import { motion } from 'motion/react';
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
  Menu
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { cn } from '../../../lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, className }) => {
  const { user, profile, logout } = useAuth();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

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
    ...(profile?.role === 'admin' || profile?.role === 'agent' || profile?.email === 'kongolmandf@gmail.com' ? [{
      title: "Administration",
      items: [
        { name: "Console Admin", path: '/admin', icon: ShieldCheck },
      ]
    }] : [])
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        "flex flex-col bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 fixed h-full transition-colors duration-300 z-40",
        className
      )}
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
          onClick={onToggle} 
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

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 space-y-2">
        {!isCollapsed && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-zoya-red dark:hover:text-zoya-red transition-all rounded-2xl"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        )}
        
        <div className={cn("flex items-center gap-3 px-3 py-2", isCollapsed ? "justify-center" : "")}>
          <div className="w-10 h-10 rounded-2xl bg-zoya-red-accent flex items-center justify-center text-zoya-red font-poppins font-black shadow-sm flex-shrink-0">
            {profile?.displayName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'}
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
  );
};
