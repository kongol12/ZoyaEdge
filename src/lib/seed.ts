import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  Timestamp, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  limit, 
  where 
} from 'firebase/firestore';

const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD'];
const STRATEGIES = ['Breakout', 'Trend Follow', 'Scalping', 'SMC', 'ICT', 'Momentum'];
const EMOTIONS = ['😐', '😰', '🔥'];
const SESSIONS = ['London', 'NY', 'Asia'];

export async function seedMockTransactions(count: number = 20) {
  const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(5)));
  const users = usersSnapshot.docs.map(doc => doc.id);
  
  if (users.length === 0) throw new Error("Aucun utilisateur trouvé pour le seeding.");

  const now = new Date();
  const paymentsRef = collection(db, 'payments');

  for (let i = 0; i < count; i++) {
    const userId = users[Math.floor(Math.random() * users.length)];
    const date = new Date();
    date.setDate(now.getDate() - Math.floor(Math.random() * 90)); // Last 90 days

    await addDoc(paymentsRef, {
      userId,
      amount: Math.random() > 0.5 ? 49 : 99,
      currency: 'USD',
      status: Math.random() > 0.1 ? 'completed' : 'failed',
      plan: Math.random() > 0.5 ? 'pro' : 'premium',
      method: ['stripe', 'paypal', 'crypto'][Math.floor(Math.random() * 3)],
      createdAt: Timestamp.fromDate(date)
    });
  }
}

export async function seedMockTrades(count: number = 50) {
  const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(5)));
  const users = usersSnapshot.docs.map(doc => doc.id);
  
  if (users.length === 0) throw new Error("Aucun utilisateur trouvé pour le seeding.");

  const now = new Date();

  for (let i = 0; i < count; i++) {
    const userId = users[Math.floor(Math.random() * users.length)];
    const tradesRef = collection(db, 'users', userId, 'trades');
    
    const date = new Date();
    date.setDate(now.getDate() - Math.floor(Math.random() * 30));

    const pnl = (Math.random() - 0.4) * 200; // Mostly profit to look good

    await addDoc(tradesRef, {
      userId,
      pair: PAIRS[Math.floor(Math.random() * PAIRS.length)],
      direction: Math.random() > 0.5 ? 'buy' : 'sell',
      entryPrice: 1.1234 + Math.random() * 0.1,
      exitPrice: 1.1234 + Math.random() * 0.1,
      lotSize: 0.1 + Math.random() * 2,
      pnl: parseFloat(pnl.toFixed(2)),
      strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
      emotion: EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)],
      session: SESSIONS[Math.floor(Math.random() * SESSIONS.length)],
      date: Timestamp.fromDate(date),
      createdAt: Timestamp.now()
    });
  }
}
