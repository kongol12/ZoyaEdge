import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from '@shared/lib/i18n';

export default function Academy() {
  const { t } = useTranslation();
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      <div className="p-6 bg-zoya-red-accent text-zoya-red rounded-3xl mb-6">
        <GraduationCap size={48} />
      </div>
      <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white mb-2">{t.common.academy}</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md">{t.common.soon}...</p>
    </motion.div>
  );
}
