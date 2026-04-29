import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Image as ImageIcon, Sparkles, Save, Download } from 'lucide-react';
import { useTranslation } from '@shared/lib/i18n';
import { addNotebookEntry, uploadImage } from '@shared/lib/db';
import { useAuth } from '@shared/lib/auth';
import { Button } from '../../atoms/Button';
import { format } from 'date-fns';
import { cn } from '@shared/lib/utils';
import toast from 'react-hot-toast';

interface NotebookEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOTIONS = [
  { emoji: '😐', label: 'Neutre' },
  { emoji: '🔥', label: 'Confiance' },
  { emoji: '😰', label: 'Peur' },
  { emoji: '🧠', label: 'Concentration' },
  { emoji: '🤩', label: 'Excitation' },
  { emoji: '🤑', label: 'Avidité' },
  { emoji: '😤', label: 'Frustration' },
];

export default function NotebookEntryModal({ isOpen, onClose }: NotebookEntryModalProps) {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState('');
  const [emotion, setEmotion] = useState<string>('😐');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;

    setIsSubmitting(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadImage(user.uid, imageFile);
      }

      await addNotebookEntry(user.uid, {
        date: new Date(date),
        content,
        emotion: emotion as any,
        imageUrl,
      });

      // Reset form
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setEmotion('😐');
      onClose();
      toast.success(language === 'fr' ? 'Entrée journal ajoutée avec succès !' : 'Journal entry added successfully!');
    } catch (error) {
      console.error('Error adding notebook entry:', error);
      toast.error(language === 'fr' ? 'Erreur lors de l\'enregistrement.' : 'Error saving entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-zoya-red/10 rounded-2xl text-zoya-red">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {language === 'fr' ? 'Journal de Bord' : 'Trading Journal'}
                  </h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                    {language === 'fr' ? 'Documentez votre psychologie' : 'Document your psychology'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-400">
                    <Download size={20} />
                 </button>
                 <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                   <X size={24} className="text-gray-400" />
                 </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block px-1">
                    {language === 'fr' ? 'Date' : 'Date'}
                  </label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-zoya-red transition-colors" size={18} />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-2xl outline-none focus:ring-4 focus:ring-zoya-red/5 focus:border-zoya-red/20 transition-all text-sm font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block px-1">
                    {language === 'fr' ? 'Capture d\'écran (JPEG/PNG)' : 'Screenshot (JPEG/PNG)'}
                  </label>
                  <label className="relative flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group overflow-hidden">
                    <ImageIcon className="text-gray-400 group-hover:text-zoya-red transition-colors" size={18} />
                    <span className="text-xs font-bold text-gray-500 truncate">
                      {imageFile ? imageFile.name : (language === 'fr' ? 'Choisir un fichier...' : 'Choose a file...')}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block px-1">
                   {language === 'fr' ? 'Contenu du journal' : 'Journal Content'}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={language === 'fr' ? 'Comment s\'est passée votre journée de trading ? Émotions, erreurs, victoires...' : 'How was your trading day? Emotions, mistakes, wins...'}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-2xl outline-none focus:ring-4 focus:ring-zoya-red/5 focus:border-zoya-red/20 transition-all text-sm font-medium resize-none min-h-[150px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block px-1">
                   {language === 'fr' ? 'État Émotionnel' : 'Emotional State'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((emo) => (
                    <button
                      key={emo.emoji}
                      type="button"
                      onClick={() => setEmotion(emo.emoji)}
                      className={cn(
                        "w-12 h-12 flex items-center justify-center text-2xl rounded-2xl border-2 transition-all group relative",
                        emotion === emo.emoji 
                          ? "bg-zoya-red border-zoya-red shadow-lg shadow-zoya-red/20 scale-110" 
                          : "bg-gray-50 dark:bg-gray-900 border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                      )}
                      title={emo.label}
                    >
                      {emo.emoji}
                      {/* Tooltip on hover */}
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {emo.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {imagePreview && (
                <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 aspect-video group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </form>

            <div className="p-6 sm:p-8 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row items-center gap-3">
               <Button
                 onClick={onClose}
                 variant="outline"
                 className="w-full sm:w-auto px-10 rounded-2xl border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800"
                 disabled={isSubmitting}
               >
                 {language === 'fr' ? 'Annuler' : 'Cancel'}
               </Button>
               <Button
                 onClick={handleSubmit}
                 className="w-full sm:flex-1 py-4 px-10 rounded-2xl shadow-xl shadow-zoya-red/20 text-base flex items-center justify-center gap-3"
                 disabled={isSubmitting || !content.trim()}
                 isLoading={isSubmitting}
               >
                 <Save size={20} />
                 {language === 'fr' ? 'Enregistrer l\'entrée' : 'Save Entry'}
               </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
