import React, { useState, useEffect } from 'react';
import { useAuth } from '@shared/lib/auth';
import { useTranslation } from '@shared/lib/i18n';
import { addNotebookEntry, subscribeToNotebook, deleteNotebookEntry, NotebookEntry, uploadImage } from '@shared/lib/db';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Save, Loader2, Calendar, Image as ImageIcon, BookOpen, X, Upload, Download } from 'lucide-react';
import { cn, exportToCSV } from '@shared/lib/utils';

export default function Notebook() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    content: '',
    date: new Date().toISOString().slice(0, 10),
    emotion: '' as NotebookEntry['emotion'],
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToNotebook(user.uid, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.emotion) {
      alert("Veuillez choisir un état émotionnel avant d'enregistrer.");
      return;
    }
    setSaving(true);
    
    let imageUrl = '';
    if (selectedFile) {
      setUploading(true);
      try {
        imageUrl = await uploadImage(user.uid, selectedFile);
      } catch (error) {
        console.error("Error uploading image", error);
      } finally {
        setUploading(false);
      }
    }

    try {
      await addNotebookEntry(user.uid, {
        content: formData.content,
        imageUrl: imageUrl || undefined,
        emotion: formData.emotion,
        date: new Date(formData.date),
      });
      setShowForm(false);
      setSelectedFile(null);
      setFormData({
        content: '',
        date: new Date().toISOString().slice(0, 10),
        emotion: '' as NotebookEntry['emotion'],
      });
      toast.success(t.common?.success || 'Enregistré avec succès');
    } catch (error) {
      console.error("Error saving notebook entry", error);
      toast.error(t.common?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !window.confirm(t.notebook.deleteConfirm)) return;
    try {
      await deleteNotebookEntry(user.uid, id);
    } catch (error) {
      console.error("Error deleting entry", error);
    }
  };

  const handleExport = () => {
    const exportData = entries.map(e => ({
      Date: e.date.toISOString(),
      Content: e.content,
      ImageURL: e.imageUrl || ''
    }));
    exportToCSV(`zoya_notebook_${new Date().toISOString().split('T')[0]}.csv`, exportData);
  };

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.notebook.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t.notebook.subtitle}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-2xl font-poppins font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-lg disabled:opacity-50 active:scale-[0.98]"
          >
            <Download size={20} />
            Export
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zoya-red text-white px-6 py-3 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 active:scale-[0.98]"
          >
            {showForm ? <X size={20} /> : <Plus size={20} />}
            {showForm ? t.common.cancel : t.notebook.add}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 space-y-6"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.notebook.date}</label>
                <input
                  required
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.notebook.image}</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 border-dashed cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-gray-500 dark:text-gray-400 text-sm"
                  >
                    <Upload size={18} />
                    {selectedFile ? selectedFile.name : t.notebook.image}
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.notebook.content}</label>
              <textarea
                required
                rows={6}
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none resize-none transition-all"
                placeholder="How was your trading day? Emotions, mistakes, wins..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">État Émotionnel</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { emoji: '🤩', label: 'Excitation' },
                  { emoji: '😕', label: 'Incertitude' },
                  { emoji: '🧠', label: 'Concentration' },
                  { emoji: '😰', label: 'Peur' },
                  { emoji: '🤑', label: 'Avidité (Sur-exposition)' },
                  { emoji: '😤', label: 'Frustration' },
                  { emoji: '😊', label: 'Satisfaction' }
                ].map((emo) => (
                  <button
                    key={emo.emoji}
                    type="button"
                    title={emo.label}
                    onClick={() => setFormData({ ...formData, emotion: emo.emoji as NotebookEntry['emotion'] })}
                    className={cn(
                      "text-2xl p-3 rounded-2xl border transition-all hover:scale-110",
                      formData.emotion === emo.emoji
                        ? "border-zoya-red bg-zoya-red/10 animate-pulse-soft"
                        : "border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    {emo.emoji}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full bg-zoya-red text-white py-4 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-zoya-red/20 active:scale-[0.98]"
            >
              {saving || uploading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {uploading ? t.notebook.uploading : t.notebook.save}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {entries.length === 0 && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-dashed border-gray-100 dark:border-gray-700 shadow-lg">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t.notebook.noEntries}</p>
          </div>
        )}

        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700 group hover:border-zoya-red/20 transition-all"
          >
            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-zoya-red font-poppins font-bold">
                    <Calendar size={18} />
                    {entry.date.toLocaleDateString()}
                    {entry.emotion && (
                      <span className="text-xl ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">{entry.emotion}</span>
                    )}
                  </div>
                  <button
                    onClick={() => entry.id && handleDelete(entry.id)}
                    className="p-2 text-gray-300 dark:text-gray-600 hover:text-zoya-red transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {entry.content}
                </p>
              </div>

              {entry.imageUrl && (
                <div className="md:w-72 shrink-0">
                  <img
                    src={entry.imageUrl}
                    alt="Trading Screenshot"
                    referrerPolicy="no-referrer"
                    className="w-full h-48 md:h-64 object-cover rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg hover:scale-[1.02] transition-transform cursor-pointer"
                    onClick={() => setSelectedImage(entry.imageUrl || null)}
                  />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
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
    </div>
  );
}
