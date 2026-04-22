import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Sun, Moon, Home, PlusCircle, BarChart2, BrainCircuit, User } from 'lucide-react';
import { Sidebar } from '../../organisms/client/Sidebar';
import { useTheme } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';

export const ClientLayout: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
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
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const bottomNavItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Trades', path: '/trade-view', icon: BarChart2 },
    { name: 'Add', path: '/add', icon: PlusCircle, isPrimary: true },
    { name: 'AI Coach', path: '/ai-coach', icon: BrainCircuit },
    { name: 'Menu', action: () => setIsMobileMenuOpen(true), icon: Menu },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white md:flex transition-colors duration-300 pb-[80px] md:pb-0">
      {/* Desktop Sidebar */}
      <Sidebar 
        isCollapsed={isCollapsed} 
        onToggle={() => setIsCollapsed(!isCollapsed)} 
        className="hidden md:flex"
      />

      <motion.main 
        initial={false}
        animate={{ 
          marginLeft: isMobile ? 0 : (isCollapsed ? 80 : 288) 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 p-4 md:p-6 lg:p-10 w-full min-w-0"
      >
        <div className="w-full">
          {/* Mobile App Header */}
          <div className="md:hidden mb-6 flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm sticky top-4 z-30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zoya-red rounded-xl flex items-center justify-center">
                 <span className="text-white font-black text-sm">Z</span>
              </div>
              <h1 className="text-lg font-poppins font-black tracking-tight dark:text-white">ZoyaEdge</h1>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                className="p-2.5 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>

          <Outlet />
        </div>
      </motion.main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 z-40 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            if (item.isPrimary) {
              return (
                <div key="primary" className="relative -top-6">
                   <Link to={item.path}>
                    <div className="w-14 h-14 bg-zoya-red text-white rounded-full flex items-center justify-center shadow-lg shadow-zoya-red/40 border-4 border-white dark:border-gray-950 active:scale-95 transition-transform">
                      <Icon size={24} />
                    </div>
                  </Link>
                </div>
              );
            }

            return (
              <button
                key={idx}
                onClick={() => item.action ? item.action() : navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-12 gap-1 transition-colors",
                  isActive ? "text-zoya-red" : "text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                )}
              >
                <Icon size={isActive ? 22 : 20} className={cn("transition-all", isActive && "fill-zoya-red/20")} />
                <span className={cn(
                  "text-[9px] font-bold tracking-wide",
                  isActive ? "text-zoya-red font-black" : ""
                )}>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Full Screen Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 h-[85vh] bg-white dark:bg-gray-950 rounded-t-[2.5rem] shadow-2xl z-[70] md:hidden flex flex-col overflow-hidden"
            >
              <div className="flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full" />
              </div>
              <div className="w-full flex justify-end px-6">
                 <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-gray-50 dark:bg-gray-900 rounded-full text-gray-500">
                    <X size={20} />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto pb-safe">
                 <Sidebar 
                  isCollapsed={false} 
                  onToggle={() => setIsMobileMenuOpen(false)} 
                  className="flex md:hidden border-none w-full shadow-none relative pb-10"
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

