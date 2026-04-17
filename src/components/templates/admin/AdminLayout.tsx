import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { AdminSidebar } from '../../organisms/admin/AdminSidebar';
import { Menu, X } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsCollapsed(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-300">
      {/* Desktop Sidebar */}
      <AdminSidebar 
        isCollapsed={isCollapsed} 
        onToggle={() => setIsCollapsed(!isCollapsed)} 
        className="hidden md:flex"
      />

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zoya-red rounded-xl flex items-center justify-center text-white font-poppins font-black text-lg">
            Z
          </div>
          <span className="font-poppins font-black text-gray-900 dark:text-white">Admin</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-500 hover:text-zoya-red transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div 
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[288px] bg-white dark:bg-gray-900 z-50 md:hidden shadow-2xl"
            >
              <AdminSidebar isCollapsed={false} onToggle={() => setIsMobileMenuOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.main 
        initial={false}
        animate={{ 
          marginLeft: isMobile ? 0 : (isCollapsed ? 80 : 288),
          paddingTop: isMobile ? 64 : 0
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto"
      >
        <Outlet />
      </motion.main>
    </div>
  );
};
