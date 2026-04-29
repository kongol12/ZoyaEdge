import React, { useState } from 'react';
import { NotebookEntry } from '@shared/lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Image as ImageIcon, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@shared/lib/i18n';
import { cn } from '@shared/lib/utils';

interface NotebookHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: NotebookEntry[];
  date?: Date | null;
}

export default function NotebookHistoryModal({ isOpen, onClose, entries, date }: NotebookHistoryModalProps) {
  const { t, language } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredEntries = date 
    ? entries.filter(e => format(e.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
    : entries;

  const emotionLabels: Record<string, string> = {
    '😐': 'Neutre',
    '🔥': 'Confiance',
    '😰': 'Peur',
    '🧠': 'Concentration',
    '🤩': 'Excitation',
    '🤑': 'Avidité',
    '😤': 'Frustration'
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
          onClick={onClose} 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <BookOpen size={20} />
              </div>
              <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">
                {date ? `Journal du ${format(date, 'dd/MM/yyyy')}` : (language === 'fr' ? 'Historique du Journal' : 'Journal History')}
              </h2>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <BookOpen size={48} className="mb-4 opacity-20" />
                <p className="font-medium text-sm">
                  {language === 'fr' ? "Aucune note pour cette sélection." : "No entries for this selection."}
                </p>
              </div>
            ) : (
              filteredEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((entry) => (
                <div key={entry.id} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                       <Calendar size={14} className="text-gray-400" />
                       <span className="text-xs font-bold text-gray-500">{format(entry.date, 'dd MMM yyyy')}</span>
                    </div>
                    {entry.emotion && (
                       <span className="text-lg bg-white dark:bg-gray-800 rounded-full px-2 py-1 shadow-sm border border-gray-100 dark:border-gray-700" title={emotionLabels[entry.emotion]}>
                           {entry.emotion}
                       </span>
                    )}
                  </div>
                  
                  <div className={cn("grid gap-4", entry.imageUrl ? "md:grid-cols-[1fr_250px]" : "grid-cols-1")}>
                     <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                       {entry.content}
                     </p>
                     
                     {entry.imageUrl && (
                       <div 
                         className="relative h-40 rounded-xl overflow-hidden cursor-pointer group border border-gray-200 dark:border-gray-700"
                         onClick={() => setSelectedImage(entry.imageUrl || null)}
                       >
                         <img 
                           src={entry.imageUrl} 
                           alt="Journal Image" 
                           className="w-full h-full object-cover transition-transform group-hover:scale-105"
                         />
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                           <ImageIcon size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                         </div>
                       </div>
                     )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Lightbox for images */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
            <motion.img 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={selectedImage} 
              alt="Enlarged Journal Image"
              className="max-w-full max-h-[95vh] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X size={24} />
            </button>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
