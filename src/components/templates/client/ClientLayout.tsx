import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { Sidebar } from '../../organisms/client/Sidebar';
import { useTheme } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';

export const ClientLayout: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white md:flex transition-colors duration-300">
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
          {/* Mobile Header */}
          <div className="md:hidden mb-6 flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Menu size={20} />
              </button>
              <h1 className="text-xl font-poppins font-black tracking-tight text-zoya-red">ZoyaEdge</h1>
            </div>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <Outlet />
        </div>
      </motion.main>

      {/* Mobile Menu Overlay */}
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
              className="fixed inset-y-0 left-0 w-[288px] bg-white dark:bg-gray-800 shadow-2xl z-50 md:hidden flex flex-col"
            >
              <Sidebar 
                isCollapsed={false} 
                onToggle={() => setIsMobileMenuOpen(false)} 
                className="flex md:hidden"
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
