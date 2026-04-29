import React, { useState, useMemo } from 'react';
import { Trade, NotebookEntry } from '@shared/lib/db';
import { formatCurrency, compactCurrency, cn, formatRR } from '@shared/lib/utils';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  List, 
  Table as TableIcon, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@shared/lib/i18n';
import { useAuth } from '@shared/lib/auth';

type ViewMode = 'table' | 'calendar';

interface TradeExplorerProps {
  trades: Trade[];
  notebookEntries?: NotebookEntry[];
  defaultView?: ViewMode;
  onTradeClick?: (trade: Trade) => void;
  onNotebookClick?: (date: Date) => void;
}

export default function TradeExplorer({ trades, notebookEntries = [], defaultView = 'calendar', onTradeClick, onNotebookClick }: TradeExplorerProps) {
  const { t, language } = useTranslation();
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const filteredData = useMemo(() => {
    return trades.filter(trade => {
      const matchesSearch = trade.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            trade.strategy.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = selectedDate ? isSameDay(trade.date, selectedDate) : true;
      return matchesSearch && matchesDate;
    });
  }, [trades, searchQuery, selectedDate]);

  // Calendar Logic
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const tradesByDay = useMemo(() => {
    const map: Record<string, Trade[]> = {};
    trades.forEach(trade => {
      const dayKey = format(trade.date, 'yyyy-MM-dd');
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(trade);
    });
    return map;
  }, [trades]);

  const notebookByDay = useMemo(() => {
    const map: Record<string, boolean> = {};
    notebookEntries.forEach(entry => {
      const dayKey = format(entry.date, 'yyyy-MM-dd');
      map[dayKey] = true;
    });
    return map;
  }, [notebookEntries]);

  const renderCalendar = () => {
    // Generate weekly stats
    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-2 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-8 px-4 sm:px-0">
          <h3 className="font-poppins font-black text-lg sm:text-lxl text-gray-900 dark:text-white capitalize">
            {format(calendarDate, 'MMMM yyyy', { locale: undefined })}
          </h3>
          <div className="flex gap-1 sm:gap-2">
            <button 
              onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() - 1)))}
              className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setCalendarDate(new Date())}
              className="px-2 sm:px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zoya-red hover:bg-zoya-red/5 rounded-xl transition-colors"
            >
              {language === 'fr' ? 'Aujourd\'hui' : 'Today'}
            </button>
            <button 
              onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() + 1)))}
              className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden shadow-sm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map(day => (
            <div key={day} className="bg-gray-50 dark:bg-gray-900/50 py-3 text-center text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {day === 'Week' ? (language === 'fr' ? 'Sem.' : 'Week') : day}
            </div>
          ))}
          
          {weeks.map((week, weekIdx) => {
            const weekTrades = week.flatMap(date => tradesByDay[format(date, 'yyyy-MM-dd')] || []);
            const weekPnL = weekTrades.reduce((sum, t) => sum + t.pnl, 0);

            return (
              <React.Fragment key={weekIdx}>
                {week.map((date, i) => {
                  const dayKey = format(date, 'yyyy-MM-dd');
                  const dayTrades = tradesByDay[dayKey] || [];
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isCurrentMonth = format(date, 'MM') === format(calendarDate, 'MM');
                  const dailyPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0);

                  return (
                    <div 
                      key={dayKey}
                      onClick={() => setSelectedDate(isSelected ? null : date)}
                      className={cn(
                        "aspect-square sm:aspect-auto sm:min-h-[110px] p-1 sm:p-2 border border-gray-200 dark:border-gray-600 cursor-pointer transition-all hover:brightness-95 dark:hover:brightness-110 relative group",
                        dayTrades.length > 0
                          ? (dailyPnL > 0.01 ? "bg-forest-green text-white" : (dailyPnL < -0.01 ? "bg-trading-red text-white" : "bg-zinc-500 text-white"))
                          : (!isCurrentMonth ? "bg-gray-50/50 dark:bg-gray-900/10 opacity-30 text-gray-400" : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"),
                        isSelected && "ring-2 ring-inset ring-zoya-red/50 z-10"
                      )}
                    >
                      <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex justify-between items-start">
                          <span className={cn(
                            "text-[8px] sm:text-xs font-bold font-poppins",
                            isSameDay(date, new Date()) ? (dayTrades.length > 0 ? "text-white underline decoration-2 underline-offset-4" : "text-zoya-red") : (dayTrades.length > 0 ? "text-white/90" : "text-gray-400")
                          )}>
                            {format(date, 'd')}
                          </span>
                          {notebookByDay[dayKey] && (
                            <div 
                              onClick={(e) => {
                                if (onNotebookClick) {
                                  e.stopPropagation();
                                  onNotebookClick(date);
                                }
                              }}
                              className={cn(
                              "text-zoya-red dark:text-zoya-red-light bg-white dark:bg-gray-800 rounded-md p-0.5 shadow-sm hover:scale-110 transition-transform cursor-pointer",
                              dayTrades.length > 0 && "text-white bg-transparent shadow-none"
                            )}>
                              <BookOpen size={13} />
                            </div>
                          )}
                        </div>
                        
                        {dayTrades.length > 0 && profile?.calendarShowPnL !== false && (
                          <div className={cn(
                            "mt-0.5 text-[8px] sm:text-xs font-black w-fit whitespace-nowrap text-white"
                          )}>
                             {compactCurrency(dailyPnL)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Weekly Summary Column */}
                <div className={cn(
                  "aspect-square sm:aspect-auto sm:min-h-[110px] p-1 sm:p-2 border border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center text-center transition-all",
                  weekTrades.length > 0 
                    ? (weekPnL > 0.01 ? "bg-forest-green text-white" : (weekPnL < -0.01 ? "bg-trading-red text-white" : "bg-zinc-500 text-white"))
                    : "bg-gray-50/30 dark:bg-gray-900/5 opacity-50"
                )}>
                  <span className={cn(
                    "text-[7px] sm:text-[8px] font-black uppercase tracking-tighter mb-1.5",
                    weekTrades.length > 0 ? "text-white/80" : "text-gray-400 dark:text-gray-500"
                  )}>
                    {language === 'fr' ? 'BILAN' : 'WEEKLY'}
                  </span>
                  <div className={cn(
                    "text-[10px] sm:text-[14px] font-black font-poppins text-white"
                  )}>
                    {compactCurrency(weekPnL)}
                  </div>
                  {weekTrades.length > 0 && (
                    <span className="text-[7.5px] font-bold text-white/80 mt-1">
                      {weekTrades.length} trades
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const emotionLabels: Record<string, string> = {
    '😐': 'Neutre',
    '🔥': 'Confiance',
    '😰': 'Peur',
    '🧠': 'Concentration',
    '🤩': 'Excitation',
    '🤑': 'Avidité',
    '😤': 'Frustration'
  };

  const renderTable = () => (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Asset</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Emotion</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Lots</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">R:R</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pips</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">P&L</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Session</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filteredData.map((trade) => (
              <tr 
                key={trade.id} 
                onClick={() => onTradeClick?.(trade)}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors cursor-pointer"
              >
                <td className="px-6 py-4 font-poppins font-black text-gray-900 dark:text-white">{trade.pair}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                    trade.type === 'deposit' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" :
                    trade.type === 'withdrawal' ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20" :
                    trade.type === 'adjustment' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" :
                    (trade.direction === 'buy' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20")
                  )}>
                    {trade.type === 'deposit' ? 'DEPOSIT' : 
                     trade.type === 'withdrawal' ? 'WITHDRAWAL' : 
                     trade.type === 'adjustment' ? 'ADJUST' : 
                     trade.direction}
                  </span>
                </td>
                <td className="px-6 py-4 text-lg" title={trade.emotion ? emotionLabels[trade.emotion] : undefined}>
                  {trade.emotion || '-'}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400">
                  {(!trade.type || trade.type === 'trade') ? trade.lotSize : '-'}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-gray-500">
                  {(!trade.type || trade.type === 'trade') ? formatRR(trade.rr) : '-'}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-gray-500">
                  {(!trade.type || trade.type === 'trade') ? (trade.pips || 0) : '-'}
                </td>
                <td className={cn(
                  "px-6 py-4 font-poppins font-black",
                  trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {formatCurrency(trade.pnl)}
                </td>
                <td className="px-6 py-4 text-xs font-medium text-gray-500">{trade.session}</td>
                <td className="px-6 py-4 text-xs font-bold text-gray-500">
                  {format(trade.date, 'dd/MM/yyyy')}
                  {notebookByDay[format(trade.date, 'yyyy-MM-dd')] && (
                    <div 
                      onClick={(e) => {
                        if (onNotebookClick) {
                          e.stopPropagation();
                          onNotebookClick(trade.date);
                        }
                      }}
                      className="inline-block"
                    >
                      <BookOpen size={14} className="inline ml-2 text-zoya-red cursor-pointer hover:scale-110 transition-transform" title="Journée journalisée (Cliquez pour voir)" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search & Layout Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder={language === 'fr' ? 'Rechercher pair ou stratégie...' : 'Search pair or strategy...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-zoya-red/5 transition-all text-sm font-medium shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-fit">
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn(
              "p-2 rounded-xl transition-all duration-300",
              viewMode === 'calendar' ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            )}
            title="Calendar View"
          >
            <CalendarIcon size={20} />
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={cn(
              "p-2 rounded-xl transition-all duration-300",
              viewMode === 'table' ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            )}
            title="Table View"
          >
            <TableIcon size={20} />
          </button>
        </div>
      </div>

      {selectedDate && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between p-3 bg-zoya-red/5 border border-zoya-red/10 rounded-2xl"
        >
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Filtre par date: <span className="text-zoya-red">{format(selectedDate, 'PPP')}</span>
          </span>
          <button 
            onClick={() => setSelectedDate(null)}
            className="text-[10px] font-black uppercase text-zoya-red hover:underline"
          >
            Effacer
          </button>
        </motion.div>
      )}

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {viewMode === 'calendar' && renderCalendar()}
          {viewMode === 'table' && renderTable()}
        </motion.div>
      </AnimatePresence>

      {filteredData.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-400 font-medium">Aucun trade trouvé pour vos critères.</p>
        </div>
      )}
    </div>
  );
}
