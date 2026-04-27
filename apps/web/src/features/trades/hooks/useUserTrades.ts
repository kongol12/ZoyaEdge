import { useState, useEffect } from 'react';
import { db } from '@shared/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Trade } from '@shared/lib/db';

export function useUserTrades(userId: string | undefined) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setTrades([]);
      setLoading(false);
      return;
    }

    const tradesRef = collection(db, 'users', userId, 'trades');
    const q = query(tradesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const tradeData = doc.data();
          return {
            id: doc.id,
            ...tradeData,
            date: tradeData.date instanceof Timestamp ? tradeData.date.toDate() : new Date(tradeData.date),
            createdAt: tradeData.createdAt instanceof Timestamp ? tradeData.createdAt.toDate() : tradeData.createdAt,
          } as Trade;
        });
        setTrades(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching trades:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { trades, tradesCount: trades.length, loading, error };
}
