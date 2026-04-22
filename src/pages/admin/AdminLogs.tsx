import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { Terminal, AlertCircle } from 'lucide-react';

interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
  timestamp: any;
  metadata?: any;
}

export default function Logs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SystemLog[];
      setLogs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-8 text-white space-y-6">
      <h1 className="text-3xl font-black">Logs Système Transparents</h1>
      
      {loading ? (
        <p className="text-gray-400">Chargement des logs...</p>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 font-mono text-xs overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left p-2">Timestamp</th>
                <th className="text-left p-2">Niveau</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-2 text-gray-500">{log.timestamp ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : '-'}</td>
                  <td className={cn("p-2 font-bold", 
                    log.level === 'error' ? 'text-red-500' : 
                    log.level === 'warn' ? 'text-amber-500' : 'text-blue-500'
                  )}>{log.level.toUpperCase()}</td>
                  <td className="p-2 text-gray-300">{log.source}</td>
                  <td className="p-2 text-gray-100">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {logs.length === 0 && (
             <div className="text-center py-10 text-gray-500">
                <Terminal size={32} className="mx-auto mb-2 opacity-30" />
                Aucun log trouvé.
             </div>
          )}
        </div>
      )}
    </div>
  );
}
