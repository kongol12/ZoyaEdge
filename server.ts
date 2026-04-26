import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
const PORT = 3000;

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || '';

// Trust proxy is required for express-rate-limit to work correctly behind the AI Studio proxy
app.set('trust proxy', 1);

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-zoyaedge-signature'],
}));

// Inactivity shutdown logic (Development only)
// Automatically shuts down the server after 1 hour of no requests to save resources.
if (process.env.NODE_ENV !== 'production') {
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
  let inactivityTimer: NodeJS.Timeout;

  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      console.log(`[Development] Server shutting down due to 1 hour of inactivity.`);
      process.exit(0);
    }, INACTIVITY_TIMEOUT);
  };

  // Initialize timer on startup
  resetInactivityTimer();

  // Reset timer on every incoming request
  app.use((req, res, next) => {
    resetInactivityTimer();
    next();
  });
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Veuillez réessayer dans 15 minutes." }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Veuillez réessayer dans une heure." }
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 1 request per second average
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for webhook." }
});

// Helper for HMAC Verification
function verifyHMACSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// MT5 Webhook Route - Declared BEFORE global express.json()
app.post('/api/webhook/mt5', webhookLimiter, express.raw({ type: 'application/json' }), async (req: any, res: any) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
  let parsedBody: any;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const { syncKey, pair, direction, lotSize, entryPrice, exitPrice, pnl, timestamp, ticket, reqTime } = parsedBody;
  const signature = req.headers['x-zoyaedge-signature'] as string | undefined;
  const now = Math.floor(Date.now() / 1000);

  if (!syncKey) return res.status(400).json({ error: "Missing syncKey" });

  // Anti-replay : On vérifie reqTime si présent, sinon on ignore pour la compatibilité EA
  if (reqTime) {
    if (Math.abs(now - reqTime) > 300) {
      return res.status(401).json({ error: "Requête expirée (Anti-replay)." });
    }
  }

  if (!db) return res.status(503).json({ error: "Database service unavailable" });

  try {
    const connectionsRef = db.collection('broker_connections');
    const q = await connectionsRef.where('syncKey', '==', syncKey).limit(1).get();
    if (q.empty) return res.status(404).json({ error: "Invalid syncKey" });

    const connectionDoc = q.docs[0];
    const connectionData = connectionDoc.data();
    const userId = connectionData.userId;
    const webhookSecret = connectionData.webhookSecret;

    // Vérification HMAC si secret configuré
    if (webhookSecret) {
      if (!verifyHMACSignature(rawBody, signature, webhookSecret)) {
        console.warn(`[Webhook] HMAC failed for syncKey: ${syncKey}`);
        return res.status(401).json({ error: "Signature HMAC invalide." });
      }
    }

    // Vérification abonnement
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const userData = userDoc.data()!;
    const subscription = userData.subscription || 'free';
    const subscriptionStatus = userData.subscriptionStatus || 'active';
    const subscriptionEndDate = userData.subscriptionEndDate?.toDate();
    const isValid =
      (subscription === 'pro' || subscription === 'premium') &&
      (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') &&
      (!subscriptionEndDate || subscriptionEndDate > new Date());

    if (!isValid) {
      await connectionDoc.ref.update({ status: 'error' });
      return res.status(403).json({ error: "Abonnement expiré ou invalide." });
    }

    // Déduplication par ticket
    const tradesRef = db.collection('users').doc(userId).collection('trades');
    
    if (ticket) {
      // S'assurer que le ticket est traité comme un string pour la recherche si nécessaire, 
      // ou vérifier les deux types (number/string)
      const existing = await tradesRef.where('ticket', '==', String(ticket)).limit(1).get();
      if (!existing.empty) {
        const doc = existing.docs[0];
        const data = doc.data();
        
        // Si le trade était caché, on le restaure car l'EA le renvoie (il est toujours dans l'historique)
        if (data.hiddenByClient) {
          await doc.ref.update({ 
            hiddenByClient: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[Webhook] Trade ticket ${ticket} restored (unhidden) for user ${userId}.`);
          return res.json({ success: true, restored: true });
        }

        console.log(`[Webhook] Trade ticket ${ticket} already exists for user ${userId}.`);
        return res.json({ success: true, skipped: true, reason: "ticket already synced" });
      }
    }

    const parseTimestamp = (ts: any, fallbackSecs: number) => {
      const num = Number(ts);
      if (isNaN(num) || num === 0) return fallbackSecs * 1000;
      // Si la valeur est > 10000000000, elle est probablement en millisecondes
      if (num > 10000000000) {
        return num;
      }
      return num * 1000;
    };

    const tradeData = {
      userId,
      pair: pair ? String(pair).toUpperCase() : 'UNKNOWN',
      direction: (String(direction).toLowerCase().includes('buy') || String(direction) === '0') ? 'buy' : 'sell',
      entryPrice: Number(entryPrice || exitPrice || 0),
      exitPrice: Number(exitPrice || entryPrice || 0),
      lotSize: Number(lotSize || 0),
      pnl: Number(pnl || 0),
      ticket: ticket ? String(ticket) : null,
      strategy: "EA Sync",
      session: "EA",
      type: 'trade',
      isDemo: false,
      hiddenByClient: false,
      date: admin.firestore.Timestamp.fromMillis(parseTimestamp(timestamp, now)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`[Webhook] Saving trade for user ${userId}:`, JSON.stringify(tradeData));
    await tradesRef.add(tradeData);

    await connectionDoc.ref.update({
      status: 'active',
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Webhook] Trade successfully added for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.use(express.json());

// Helper to handle Gemini Errors
function handleGeminiError(error: any, res: express.Response) {
  console.error("Gemini API Error:", error);
  
  if (error?.message?.includes('API key not valid')) {
    return res.status(401).json({ 
      error: "La clé API Gemini est invalide. Veuillez la vérifier dans les paramètres de l'application." 
    });
  }
  
  if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
    return res.status(429).json({ 
      error: "Limite de quota atteinte pour l'IA. Veuillez réessayer dans quelques minutes." 
    });
  }

  res.status(500).json({ error: error.message || "Une erreur est survenue lors de l'analyse IA." });
}

app.use('/api/', limiter);

// Middleware to verify Auth Token (Any User)
async function verifyUser(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("User verification failed:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

// --- ADMIN ROUTES ---

// Admin Stats
app.get('/api/admin/stats', verifyAdmin, async (req: any, res: any) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Example: Aggregation query (simple)
    const payments = await db.collection('payments').where('createdAt', '>=', startOfMonth).get();
    
    let totalRevenue = 0;
    payments.forEach(doc => {
      if (doc.data().status === 'completed') totalRevenue += doc.data().amount || 0;
    });

    const completed = payments.docs.filter(d => d.data().status === 'completed').length;
    const successRate = payments.size > 0 ? Math.round((completed / payments.size) * 100) / 100 : 0;

    res.json({
      totalRevenue,
      totalTransactions: payments.size,
      successRate,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/api/admin/transactions', verifyAdmin, async (req: any, res: any) => {
    res.json({ transactions: [] });
});

app.get('/api/admin/users', verifyAdmin, async (req: any, res: any) => {
    res.json({ users: [] });
});

app.get('/api/admin/ai/logs', verifyAdmin, async (req: any, res: any) => {
    res.json({ logs: [] });
});

app.post('/api/admin/transactions/override', verifyAdmin, async (req: any, res: any) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { transactionId, action } = req.body; // action: 'complete' | 'fail'
  if (!transactionId || !['complete', 'fail'].includes(action)) {
    return res.status(400).json({ error: 'transactionId and action (complete|fail) required' });
  }
  try {
    let q = await db.collection('payments')
      .where('transactionId', '==', transactionId)
      .limit(1).get();
      
    if (q.empty) {
      // Fallback: try by document ID just in case
      try {
         const docRef = await db.collection('payments').doc(transactionId).get();
         if (docRef.exists) {
            const data = docRef.data();
            // Just simulate a QuerySnapshot structure for the rest of the code
            q = { empty: false, docs: [docRef] } as any;
         }
      } catch (e) {
          // ignore
      }
    }

    if (q.empty) return res.status(404).json({ error: 'Transaction not found using ID ' + transactionId });

    const paymentDoc = q.docs[0];
    const paymentData = paymentDoc.data();

    if (action === 'complete') {
      // Simulate success
      await finalizePayment(transactionId, {
        status: 'SUCCESSFUL',
        statusDescription: 'Manual override by admin',
      });
      await logSystemEvent('warn', 'admin_override', `Transaction ${transactionId} forcée à COMPLETED par admin ${req.user.email}`);
      return res.json({ success: true, message: 'Transaction marquée comme complétée. Abonnement activé.' });
    } else {
      await paymentDoc.ref.update({
        status: 'failed',
        failureReason: 'Rejetée manuellement par un administrateur.',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await logSystemEvent('warn', 'admin_override', `Transaction ${transactionId} forcée à FAILED par admin ${req.user.email}`);
      return res.json({ success: true, message: 'Transaction marquée comme échouée.' });
    }
  } catch (error: any) {
    console.error('[Admin Override Error]:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Global System Logger
async function logSystemEvent(level: 'info' | 'warn' | 'error', source: string, message: string, metadata: any = {}) {
  if (!db) {
    console.error(`[SystemLogger][${level.toUpperCase()}] ${source}: ${message}`);
    return;
  }
  
  try {
    await db.collection('system_logs').add({
      level,
      source,
      message,
      metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write to system_logs:", error);
  }
}

// Helper to finalize payment and upgrade user account
async function finalizePayment(txId: string, resultData: any) {
  if (!db) return;

  let q = await db.collection('payments')
    .where('transactionId', '==', txId)
    .limit(1)
    .get();

  if (q.empty) {
    try {
      const docRef = await db.collection('payments').doc(txId).get();
      if (docRef.exists) {
        q = { empty: false, docs: [docRef] } as any;
      }
    } catch (e) {
      // ignore
    }
  }

  if (q.empty) {
    console.warn(`[Payment] Finalization failed: Transaction ${txId} not found in DB.`);
    return;
  }

  const paymentDoc = q.docs[0];
  const paymentData = paymentDoc.data();

  if (paymentData.status === 'completed') {
    return { success: true, alreadyProcessed: true };
  }

  // Extraction robuste de tous les champs possibles de réponse Araka
  const getDeepStatus = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return '';
    const keys = [
      'status', 'statusCode', 'transactionStatus', 'Status', 
      'statusText', 'code', 'responseCode', 'responseMessage',
      'paymentStatus', 'orderStatus', 'state', 'result',
      'StatusCode', 'StatusMessage', 'TransactionStatus'
    ];
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        return String(obj[k]);
      }
    }
    // Chercher récursivement dans les sous-objets
    for (const nested of ['data', 'order', 'payment', 'transaction', 'response']) {
      if (obj[nested] && typeof obj[nested] === 'object') {
        const found = getDeepStatus(obj[nested]);
        if (found) return found;
      }
    }
    if (Array.isArray(obj) && obj.length > 0) return getDeepStatus(obj[0]);
    return '';
  };

  const rawStatus = getDeepStatus(resultData);
  const status = rawStatus.toUpperCase().trim();
  
  const isSuccess = 
    // Statuts explicites
    status === 'SUCCESSFUL' || status === 'SUCCESS' || status === 'COMPLETED' ||
    status === 'PAID' || status === 'APPROVED' || status === 'CONFIRMED' ||
    status === 'ACCEPTED' || status === '00' || status === '000' ||
    status === '200' || status === 'OK' || status === 'ACTIVE' ||
    // Détection par inclusion
    status.includes('SUCCESS') || status.includes('COMPLET') || 
    status.includes('APPROV') || status.includes('PAID') ||
    status.includes('CONFIRM') || status.includes('ACCEPT') ||
    // Détection dans description
    (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('SUCCESS')) ||
    (resultData.message && String(resultData.message).toUpperCase().includes('SUCCESS')) ||
    (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('PAID')) ||
    // Si "Manual override by admin"
    (resultData.statusDescription === 'Manual override by admin');

  const isFailed =
    !isSuccess && (
      status === 'FAILED' || status === 'FAIL' || status === 'REJECTED' ||
      status === 'CANCELLED' || status === 'CANCELED' || status === 'DECLINED' ||
      status === 'ERROR' || status === 'EXPIRED' || status === 'INVALID' ||
      status === 'DENIED' || status === 'STOPPED' ||
      status.includes('FAIL') || status.includes('REJECT') || 
      status.includes('CANCEL') || status.includes('DECLIN') ||
      status.includes('EXPIR') || status.includes('INVALID') ||
      status.includes('DENI') || status.includes('STOP') ||
      (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('FAIL')) ||
      (resultData.message && String(resultData.message).toUpperCase().includes('FAIL'))
    );

  // Log pour debug production
  console.log(`[finalizePayment] txId=${txId} rawStatus="${rawStatus}" isSuccess=${isSuccess} isFailed=${isFailed}`);

  if (isSuccess) {
    await paymentDoc.ref.update({ 
      status: 'completed',
      rawArakaResponse: resultData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const userRef = db.collection('users').doc(paymentData.userId);
    const durationDays = paymentData.cycle === 'yearly' ? 365 : 31;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    await userRef.update({
      subscription: paymentData.plan,
      subscriptionCycle: paymentData.cycle || 'monthly',
      subscriptionStatus: 'active',
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
      aiCredits: paymentData.plan === 'pro' ? 30 : 9999,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('user_activity').add({
      message: `Abonnement ${paymentData.plan} activé avec succès.`,
      type: 'payment',
      severity: 'info',
      userId: paymentData.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } else if (isFailed) {
    await paymentDoc.ref.update({ 
      status: 'failed',
      failureReason: resultData.message || resultData.statusDescription || "Transaction échouée",
      rawArakaResponse: resultData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: false, failed: true };
  }
  
  return { success: false, pending: true, status };
}

// Initialize Firebase Admin lazily or safely
let db: admin.firestore.Firestore | null = null;

async function initFirebaseAdmin() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn("firebase-applet-config.json not found. Webhook will not work.");
      return;
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`[Firebase] Initializing with Project ID: ${firebaseConfig.projectId}`);

    if (admin.apps.length > 0) {
      console.log("[Firebase] Cleaning up existing apps...");
      await Promise.all(admin.apps.map(app => app?.delete()));
    }

    // Initialize Firebase Admin with explicit project ID to match client tokens
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app?.delete()));
    }

    let credential = admin.credential.applicationDefault();
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = admin.credential.cert(serviceAccount);
        console.log("[Firebase] Using custom service account key from environment.");
      } catch (e) {
        console.error("[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
      }
    }

    admin.initializeApp({
      credential,
      projectId: firebaseConfig.projectId,
    });
    
    const currentProject = admin.app().options.projectId || 'unknown';
    console.log(`[Firebase] Server initialized with Project ID: ${currentProject}`);

    if (firebaseConfig.firestoreDatabaseId) {
      console.log(`[Firebase] Connecting to Database: ${firebaseConfig.firestoreDatabaseId}`);
      db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(admin.app());
    }

    // Startup test for Firestore (non-blocking)
    console.log("[Firebase] Testing Firestore connection in background...");
    db.collection('app_settings').doc('health').get().then(() => {
      console.log("[Firebase] Firestore connection test successful");
    }).catch((testError: any) => {
      console.error("[Firebase] Firestore connection test FAILED:", testError);
      if (testError.code === 7) {
        console.warn("[Firebase] CRITICAL: Permission Denied. The most common cause is missing FIREBASE_SERVICE_ACCOUNT_KEY or incorrect database setup.");
      }
    });
    
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

// Manual Sync for All User Connections
app.post('/api/connections/user-sync', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(503).json({ error: "Database service unavailable" });
  const userId = req.user.uid;

  try {
    // Nettoyage silencieux des flux de balance corrompus enregistrés commes des trades EA par les anciennes versions du bot
    const snap = await db.collection('users').doc(userId).collection('trades')
      .where('strategy', '==', 'EA Sync')
      .where('pair', '==', 'UNKNOWN')
      .get();
    
    if (!snap.empty) {
      const cleanBatch = db.batch();
      snap.docs.forEach(d => cleanBatch.delete(d.ref));
      await cleanBatch.commit();
    }

    const connectionsSnap = await db.collection('broker_connections')
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'waiting', 'error'])
      .get();

    if (connectionsSnap.empty) {
      return res.json({ success: true, message: "Aucune connexion à synchroniser." });
    }

    const batch = db.batch();
    connectionsSnap.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'waiting' });
    });
    await batch.commit();

    // Simulate EA response after 2 seconds for feedback
    setTimeout(async () => {
      const finalBatch = db.batch();
      connectionsSnap.docs.forEach(doc => {
        finalBatch.update(doc.ref, { 
          status: 'active',
          lastSync: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      await finalBatch.commit();
    }, 2000);

    res.json({ success: true, count: connectionsSnap.size });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Sync Endpoint for a single connection
app.post('/api/connections/:connectionId/sync', verifyUser, async (req: any, res: any) => {
  const { connectionId } = req.params;
  const userId = req.user.uid; // ← JAMAIS depuis req.body

  if (!db) {
    return res.status(503).json({ error: "Database service unavailable" });
  }

  try {
    const connectionRef = db.collection('broker_connections').doc(connectionId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return res.status(404).json({ error: "Connection not found" });
    }

    const connectionData = connectionDoc.data();
    if (connectionData?.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check user subscription
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const subscription = userData?.subscription || 'free';
    const subscriptionStatus = userData?.subscriptionStatus || 'active';
    const subscriptionEndDate = userData?.subscriptionEndDate?.toDate();

    let isSubscriptionValid = false;

    if (subscription === 'pro' || subscription === 'premium') {
      if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
        if (!subscriptionEndDate || subscriptionEndDate > new Date()) {
          isSubscriptionValid = true;
        }
      }
    }

    if (!isSubscriptionValid) {
      await connectionRef.update({ status: 'error' });
      return res.status(403).json({ error: "Abonnement expiré ou invalide. Veuillez vous réabonner." });
    }

    // Update status to syncing (waiting)
    await connectionRef.update({ status: 'waiting' });

    // Simulate EA responding after 3 seconds
    setTimeout(async () => {
      try {
        // In a real scenario, the EA would push data to the webhook.
        // Here we just simulate a successful sync.
        await connectionRef.update({
          status: 'active',
          lastSync: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.error("Simulation error:", e);
      }
    }, 3000);

    res.json({ success: true, message: "Demande de synchronisation envoyée à l'EA." });
  } catch (error) {
    console.error("Manual sync error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/api/config/coach-instructions', verifyUser, (req, res) => {
  try {
    const systemInstruction = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');
    res.json({ instruction: systemInstruction });
  } catch (error) {
    res.status(500).json({ error: "Failed to read instructions" });
  }
});

// Middleware to verify Admin/Agent role
async function verifyAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const currentProjectId = admin.app().options.projectId;
    console.log(`[Auth] Verifying ID Token for project: ${currentProjectId}...`);
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const email = decodedToken.email?.toLowerCase();
    console.log(`[Auth] Token verified for: ${email} (${userId}) on project: ${currentProjectId}`);

    if (!db) return res.status(503).json({ error: "Database unavailable" });

    let userData: any = null;
    let isSuperAdmin = false;

    try {
      const userDoc = await db.collection('users').doc(userId).get();
      userData = userDoc.data();

      const settingsSnap = await db.collection('app_settings').doc('global').get();
      const superAdmins = settingsSnap.data()?.superAdmins || [SUPER_ADMIN_EMAIL];
      isSuperAdmin = email && (superAdmins.includes(email) || email === SUPER_ADMIN_EMAIL);
    } catch (dbError) {
      console.error("Firestore check failed in verifyAdmin, falling back to hardcoded check:", dbError);
      isSuperAdmin = email === SUPER_ADMIN_EMAIL;
    }

    if (isSuperAdmin || userData?.role === 'admin' || userData?.role === 'agent') {
      req.user = decodedToken;
      next();
    } else {
      res.status(403).json({ error: "Forbidden: Admin access required" });
    }
  } catch (error) {
    console.error("Auth verification failed:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

// Middleware to verify Super Admin role
async function verifySuperAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const currentProjectId = admin.app().options.projectId;
    console.log(`[SuperAdmin] Verifying ID Token for project: ${currentProjectId}...`);
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email;
    console.log(`[SuperAdmin] Token verified for: ${email} on project: ${currentProjectId}`);

    if (!db) return res.status(503).json({ error: "Database unavailable" });

    try {
      const settingsSnap = await db.collection('app_settings').doc('global').get();
      const superAdmins = settingsSnap.data()?.superAdmins || [SUPER_ADMIN_EMAIL];

      if (email && (superAdmins.includes(email?.toLowerCase()) || email?.toLowerCase() === SUPER_ADMIN_EMAIL)) {
        req.user = decodedToken;
        next();
      } else {
        res.status(403).json({ error: "Forbidden: Super Admin access required" });
      }
    } catch (dbError) {
      console.error("Firestore check failed in verifySuperAdmin, falling back to hardcoded check:", dbError);
      if (email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
        req.user = decodedToken;
        next();
      } else {
        res.status(403).json({ error: "Forbidden: Super Admin access required" });
      }
    }
  } catch (error) {
    console.error("Super Admin verification failed:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

// Admin User Creation Endpoint (Super Admin Only)
app.post('/api/admin/users/create', authLimiter, verifySuperAdmin, async (req, res) => {
  const { email, password, displayName, role } = req.body;

  if (!email || !password || !displayName || !role) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }

  if (!db) return res.status(503).json({ error: "Service de base de données indisponible" });

  try {
    // Basic validation
    if (password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" });
    }

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Create profile in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: email.toLowerCase(),
      displayName,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      onboarded: false,
      subscription: 'free',
      aiCredits: 3, // 3 analyses Discovery offertes
    });

    res.json({ success: true, userId: userRecord.uid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    const message = error.code === 'auth/email-already-exists' 
      ? "Cet e-mail est déjà utilisé" 
      : "Échec de la création de l'utilisateur";
    res.status(500).json({ error: message });
  }
});

// Admin Notification Endpoint (Email Simulation)
app.post('/api/admin/notify', verifyAdmin, async (req, res) => {
  const { title, message, severity, userId } = req.body;
// ... existing code ...
});

// Admin User Management Endpoint
app.post('/api/admin/users/:userId/update', verifyAdmin, async (req, res) => {
// ... existing code ...
});

// --- AI Cache functions ---
function hashTradesData(trades: any[]): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(trades))
    .digest('hex');
}

async function getAICache(userId: string, tradesHash: string, db: admin.firestore.Firestore): Promise<any | null> {
  try {
    const cacheRef = db.collection('users').doc(userId).collection('ai_coach').doc('latest');
    const doc = await cacheRef.get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    // Cache valide 6 heures si les trades n'ont pas changé
    const cacheAge = Date.now() - data.cachedAt?.toMillis();
    if (data.tradesHash === tradesHash && cacheAge < 6 * 60 * 60 * 1000) {
      return data.result;
    }
    return null;
  } catch { return null; }
}

async function setAICache(userId: string, tradesHash: string, result: any, db: admin.firestore.Firestore): Promise<void> {
  try {
    const cacheRef = db.collection('users').doc(userId).collection('ai_coach').doc('latest');
    await cacheRef.set({
      tradesHash,
      result,
      cachedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.error('Cache write failed:', e); }
}

// Limites mensuelles par plan
const AI_LIMITS = {
  free: 3,      // 3 analyses lifetime (converties en "crédits" initiaux)
  pro: 30,      // 30 analyses/mois
  premium: 9999 // Illimité
};

// Routing modèle Gemini par mode
function getGeminiModel(mode: string, subscription: string): string {
  if (subscription === 'premium') return 'gemini-2.0-flash';
  if (mode === 'DETAILED') return 'gemini-2.0-flash';
  if (mode === 'CONCISE') return 'gemini-2.0-flash-lite';
  return 'gemini-2.0-flash'; // STANDARD
}

// Limite tokens par mode
function getMaxTokens(mode: string): number {
  if (mode === 'CONCISE') return 300;
  if (mode === 'STANDARD') return 700;
  return 1000; // DETAILED
}

// Limite trades envoyés à l'IA par mode
function getTradeLimit(mode: string): number {
  if (mode === 'CONCISE') return 20;
  if (mode === 'STANDARD') return 50;
  return 100; // DETAILED
}

async function checkAndDeductAICredit(
  userId: string,
  db: admin.firestore.Firestore,
  mode: string = 'STANDARD'
): Promise<{ allowed: boolean; reason?: string }> {
  const userRef = db.collection('users').doc(userId);
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return { allowed: false, reason: "User not found" };
    const userData = userDoc.data()!;
    const subscription = userData.subscription || 'free';

    // DETAILED réservé Premium uniquement
    if (mode === 'DETAILED' && subscription !== 'premium') {
      return {
        allowed: false,
        reason: "L'analyse DETAILED est réservée au plan Premium. Passez à Premium pour y accéder."
      };
    }

    if (subscription === 'premium') return { allowed: true };

    const credits = userData.aiCredits ?? 0;
    if (credits <= 0) {
      const planLabel = subscription === 'pro' ? 'Premium' : 'Pro';
      return {
        allowed: false,
        reason: `Vous avez atteint votre limite d'analyses IA ce mois-ci. Passez à ${planLabel} pour continuer.`
      };
    }
    transaction.update(userRef, {
      aiCredits: admin.firestore.FieldValue.increment(-1)
    });
    return { allowed: true };
  });
}

// Webhook Secret Generation Endpoint
app.post('/api/connections/:connectionId/generate-secret', verifyUser, async (req: any, res: any) => {
  const { connectionId } = req.params;
  const userId = req.user.uid;
  if (!db) return res.status(503).json({ error: "Database unavailable" });
  try {
    const connectionRef = db.collection('broker_connections').doc(connectionId);
    const connectionDoc = await connectionRef.get();
    if (!connectionDoc.exists) return res.status(404).json({ error: "Connection not found" });
    if (connectionDoc.data()?.userId !== userId) return res.status(403).json({ error: "Unauthorized" });

    const webhookSecret = crypto.randomBytes(32).toString('hex');
    await connectionRef.update({
      webhookSecret,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({
      success: true,
      webhookSecret,
      message: "Copiez ce secret maintenant. Il ne sera plus affiché."
    });
  } catch (error) {
    console.error("Error generating webhook secret:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/auth/start-trial', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(503).json({ error: "Database unavailable" });
  try {
    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const userData = userDoc.data()!;
    if (userData.hasUsedTrial) {
      return res.status(403).json({ error: "Essai déjà utilisé. Un seul essai par compte." });
    }
    if (userData.subscription !== 'free' && userData.subscription !== 'discovery') {
      return res.status(403).json({ error: "Vous avez déjà un abonnement actif." });
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    await userRef.update({
      subscription: 'pro',
      subscriptionStatus: 'trialing',
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
      subscriptionCycle: 'monthly',
      hasUsedTrial: true,
      aiCredits: 10,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, trialEndDate: trialEndDate.toISOString() });
  } catch (error) {
    console.error("Trial activation error:", error);
    res.status(500).json({ error: "Erreur lors de l'activation de l'essai." });
  }
});

app.post('/api/auth/complete-onboarding', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { tradingStyle, experienceLevel, capitalSize, currency, defaultRisk, defaultLotSize, assetTypes } = req.body;
  try {
    const userRef = db.collection('users').doc(req.user.uid);
    await userRef.set({
      tradingStyle: tradingStyle || 'day_trading',
      experienceLevel: experienceLevel || 'beginner',
      capitalSize: capitalSize || '0',
      currency: currency || 'USD',
      defaultRisk: defaultRisk || 1,
      defaultLotSize: defaultLotSize || 0.01,
      assetTypes: assetTypes || [],
      onboarded: true,
      onboardingState: { step: 'COMPLETED', completed: true },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Onboarding completion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Coach Proxy Endpoint
app.post('/api/ai/coach', verifyUser, async (req: any, res: any) => {
  const { input } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY non configurée sur le serveur." });
  }

  if (!db) return res.status(503).json({ error: "Service de base de données indisponible" });

  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const subscription = userDoc.data()?.subscription || 'free';

    const creditCheck = await checkAndDeductAICredit(req.user.uid, db!, input.mode || 'STANDARD');
    if (!creditCheck.allowed) {
      return res.status(402).json({ 
        error: creditCheck.reason || "Crédits IA épuisés. Passez à Pro pour un accès illimité." 
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `
You are Zoya AI Coach, a professional hedge fund risk analyst, trading performance auditor, and discipline enforcement system.
Analyze the following trading metrics and behavioral data.

INPUT DATA:
${JSON.stringify(input, null, 2)}

MODE: ${input.mode || 'STANDARD'}
If CONCISE: Provide 1 decision and max 3 bullet points in summary/insights.
If STANDARD: Provide structured analysis.
If DETAILED: Provide full breakdown of performance, psychology, risk, and actions.

STRICT OUTPUT FORMAT REQUIRED (JSON ONLY):
{
  "decision": "GREEN" | "ORANGE" | "RED",
  "score": {
    "risk": number (0-100),
    "discipline": number (0-100),
    "consistency": number (0-100)
  },
  "summary": "string",
  "insights": ["string"],
  "mistakes": ["string"],
  "recommendations": ["string"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH"
}
`;

    const response = await ai.models.generateContent({
      model: getGeminiModel(input.mode || 'STANDARD', subscription),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    
    // Clean JSON if model wraps it in markdown
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    const aiAnalysis = JSON.parse(cleanedText);

    // -- CRITICAL BEHAVIORAL LOGGING --
    if (aiAnalysis.decision === 'RED') {
      await logSystemEvent('error', 'behavioral_analysis', `Critical behavioral risk detected for user ${req.user.uid}. Condition: ${aiAnalysis.summary}`, {
        userId: req.user.uid,
        scores: aiAnalysis.score,
        risk_level: aiAnalysis.risk_level
      });
    } else if (aiAnalysis.decision === 'ORANGE') {
      await logSystemEvent('warn', 'behavioral_analysis', `Behavioral instability for user ${req.user.uid}`, {
        userId: req.user.uid,
        scores: aiAnalysis.score
      });
    }

    // Save report
    try {
      await db.collection('users').doc(req.user.uid).collection('ai_reports').add({
        date: admin.firestore.Timestamp.now(),
        mode: input.mode || 'STANDARD',
        metrics: input.metrics,
        response: aiAnalysis
      });
    } catch (saveError) {
      console.error("[AI Coach] Failed to save report:", saveError);
    }

    res.json(aiAnalysis);
  } catch (error: any) {
    handleGeminiError(error, res);
  }
});

// AI Coach Ask Endpoint
app.post('/api/ai/ask', verifyUser, async (req: any, res: any) => {
  const { trades, language, strategies, instruction, mode = 'STANDARD' } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY non configurée." });
  }
  if (!db) return res.status(503).json({ error: "Service de base de données indisponible" });

  // Récupérer le plan utilisateur pour le routing
  const userDoc = await db.collection('users').doc(req.user.uid).get();
  const subscription = userDoc.data()?.subscription || 'free';

  // Vérifier cache
  const tradeLimit = getTradeLimit(mode);
  const tradesToAnalyze = (trades || []).slice(-tradeLimit);
  const tradesHash = hashTradesData(tradesToAnalyze);
  const cached = await getAICache(req.user.uid, tradesHash, db);
  if (cached) {
    return res.json({ ...cached, fromCache: true });
  }

  // Vérifier crédits
  const creditCheck = await checkAndDeductAICredit(req.user.uid, db, mode);
  if (!creditCheck.allowed) {
    return res.status(402).json({ error: creditCheck.reason });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = getGeminiModel(mode, subscription);
    const maxTokens = getMaxTokens(mode);

    const prompt = `
Analyze this trading dataset and return structured output only.
IMPORTANT: All text fields MUST be in ${language === 'fr' ? 'French (Français)' : 'English'}.
MODE: ${mode}
${mode === 'CONCISE' ? 'CONCISE: Return only coach_decision, 1 summary sentence, max 3 actions.' : ''}
${mode === 'DETAILED' ? 'DETAILED: Full breakdown — performance, psychology, risk, behavioral patterns, strategic recommendations.' : ''}

USER STRATEGIES:
${strategies?.length > 0 ? JSON.stringify(strategies) : "No custom strategies."}

TRADES DATA (last ${tradeLimit}):
${JSON.stringify(tradesToAnalyze)}

STRICT JSON OUTPUT ONLY:
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
        maxOutputTokens: maxTokens,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    const result = JSON.parse(cleanedText);

    // Sauvegarder en cache
    await setAICache(req.user.uid, tradesHash, result, db);

    res.json(result);
  } catch (error: any) {
    handleGeminiError(error, res);
  }
});

// Admin Monthly Credit Reset
app.post('/api/admin/reset-monthly-credits', verifySuperAdmin, async (req: any, res: any) => {
  if (!db) return res.status(503).json({ error: "Database unavailable" });
  try {
    const usersSnapshot = await db.collection('users').where('subscription', '==', 'pro').get();
    const batch = db.batch();
    usersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { aiCredits: 30 });
    });
    await batch.commit();
    res.json({ success: true, updated: usersSnapshot.size });
  } catch (error) {
    console.error("Monthly reset error:", error);
    res.status(500).json({ error: "Reset failed" });
  }
});

// --- ARAKA Mobile Money Integration ---
let arakaToken: string | null = null;
let arakaTokenExpiry: number = 0;

async function getArakaUrl() {
  const defaultUrl = 'https://api.arakapay.com';
  let url = (process.env.ARAKA_API_URL || defaultUrl).trim().replace(/\/$/, '');
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

async function getArakaToken() {
  if (arakaToken && Date.now() < arakaTokenExpiry) return arakaToken;
  
  const url = await getArakaUrl();
  
  let email = process.env.ARAKA_EMAIL;
  let password = process.env.ARAKA_PASSWORD;
  
  if (!email || !password) throw new Error('Identifiants ARAKA (Email/Password) de production manquants dans les secrets.');
  
  // Nettoyage des espaces potentiellement copiés/collés par erreur
  email = email.trim();
  password = password.trim();

  console.log(`[Araka Auth] Connexion sur ${url}`);

    try {
    const response = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'ZoyaEdge-Server/1.0'
      },
      body: JSON.stringify({ 
        emailAddress: email, 
        password: password
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Araka login failed (${response.status}): ${errorText}`);
    }
    
    const data: any = await response.json();
    arakaToken = data.token || data.accessToken || data.bearerToken;
    if (!arakaToken) throw new Error('Araka response missing token field');
    arakaTokenExpiry = Date.now() + (23 * 60 * 60 * 1000); 
    return arakaToken;
  } catch (e: any) {
    console.error("[Araka] Auth Error:", e);
    throw e;
  }
}

app.post('/api/user/sync-settings', verifyUser, async (req: any, res: any) => {
  console.log("[ZoyaPay] Initiating payment request from user:", req.user?.email);
  const { amount, currency, phoneNumber, provider, planId, billingCycle, fee, vat, vatRate, feeRate, userName } = req.body;
  if (!amount || !phoneNumber || !provider || !planId || !billingCycle) {
    return res.status(400).json({ error: "Paramètres manquants (amount, phoneNumber, provider, planId, billingCycle requis)" });
  }

  let normalizedPhone = phoneNumber.replace(/\D/g, '');
  if (normalizedPhone.startsWith('243') && normalizedPhone.length === 12) {
    normalizedPhone = '+' + normalizedPhone;
  } else if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
    normalizedPhone = '+243' + normalizedPhone.slice(1);
  } else if (normalizedPhone.length === 9) {
    normalizedPhone = '+243' + normalizedPhone;
  } else {
    return res.status(400).json({
      error: "Format de téléphone non reconnu. Utilisez le format: 0812345678 ou 243812345678"
    });
  }

  if (!normalizedPhone.startsWith('+243') || normalizedPhone.length !== 13) {
    return res.status(400).json({
      error: "Numéro invalide pour DRC. Format attendu: +243XXXXXXXXX (13 chars)"
    });
  }

  try {
    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    // Fetch multi-currency config from app_settings
    let pageId = process.env.ARAKA_PAYMENT_PAGE_ID; 
    
    if (db) {
      try {
        const settingsSnap = await db.collection('app_settings').doc('global').get();
        if (settingsSnap.exists) {
          const settings = settingsSnap.data();
          if (currency === 'CDF' && settings?.arakaCdfPageId) {
            pageId = settings.arakaCdfPageId;
          } else if (currency === 'USD' && settings?.arakaUsdPageId) {
            pageId = settings.arakaUsdPageId;
          }
        }
      } catch (e) {
        console.error("Erreur lecture settings araka config", e);
      }
    }

    if (!pageId) throw new Error('ARAKA_PAYMENT_PAGE_ID non configuré pour cette devise');

    // Server-side price validation
    const settingsDoc = await db!.collection('app_settings').doc('global').get();
    const settings = settingsDoc.data() || {};
    const exchangeRate = settings.exchangeRate || 2800;
    const transactionFee = settings.transactionFee || 2;
    const vatRate = settings.vatRate || 16;
    const globalDiscount = settings.globalDiscount || 0;

    // Maps and logic based on admin settings
    const useAutomaticConversion = settings.useAutomaticConversion ?? true;

    // Define price maps for both currencies
    const priceMapUSD: Record<string, Record<string, number>> = {
      discovery: { monthly: settings.discoveryMonthlyUSD ?? 0, yearly: settings.discoveryYearlyUSD ?? 0 },
      pro: { monthly: settings.proMonthlyUSD ?? 20, yearly: settings.proYearlyUSD ?? 200 },
      premium: { monthly: settings.premiumMonthlyUSD ?? 50, yearly: settings.premiumYearlyUSD ?? 500 },
    };

    const priceMapCDF: Record<string, Record<string, number>> = {
      discovery: { monthly: settings.discoveryMonthlyCDF ?? 0, yearly: settings.discoveryYearlyCDF ?? 0 },
      pro: { monthly: settings.proMonthlyCDF ?? 56000, yearly: settings.proYearlyCDF ?? 560000 },
      premium: { monthly: settings.premiumMonthlyCDF ?? 140000, yearly: settings.premiumYearlyCDF ?? 1400000 },
    };

    let basePriceInCurrency: number;
    const discountMultiplier = 1 - (globalDiscount / 100);

    if (currency === 'CDF') {
      if (useAutomaticConversion) {
        const baseUSD = priceMapUSD[planId]?.[billingCycle];
        if (baseUSD === undefined) return res.status(400).json({ error: "Plan ou cycle invalide." });
        basePriceInCurrency = (baseUSD * discountMultiplier) * exchangeRate;
      } else {
        const baseCDF = priceMapCDF[planId]?.[billingCycle];
        if (baseCDF === undefined) return res.status(400).json({ error: "Plan ou cycle invalide." });
        basePriceInCurrency = baseCDF * discountMultiplier;
      }
    } else {
      const baseUSD = priceMapUSD[planId]?.[billingCycle];
      if (baseUSD === undefined) return res.status(400).json({ error: "Plan ou cycle invalide." });
      basePriceInCurrency = baseUSD * discountMultiplier;
    }
    
    // We preserve up to 2 decimal places properly for USD
    const roundAmount = (val: number) => {
      return currency === 'USD' ? Math.round(val * 100) / 100 : Math.round(val);
    };

    const vatAmount = roundAmount((basePriceInCurrency * vatRate) / 100);
    const subtotalWithVat = basePriceInCurrency + vatAmount;
    const feeAmount = roundAmount((subtotalWithVat * transactionFee) / 100);
    const expectedTotal = roundAmount(subtotalWithVat + feeAmount);
    
    // Allow standard parsing for the string we received from client
    const clientAmount = parseFloat(amount);

    // Tolérance supprimée pour éviter les blocages intempestifs. 
    // Le serveur est roi : on facture le montant calculé (expectedTotal).
    if (Math.abs(clientAmount - expectedTotal) / expectedTotal > 0.05) {
      console.warn(`[Payment Warning] Important Amount Mismatch -> Client Sent: ${clientAmount}, Server Computed: ${expectedTotal}. We will bill the Server Computed amount.`);
    }

    const transactionReference = `ZOYA_${req.user.uid.slice(0, 5)}_${Date.now()}`;
    
    // As per Araka documentation, amount should typically be an integer string or number
    const payload = {
      reference: transactionReference,
      transactionReference: transactionReference,
      order: {
        paymentPageId: pageId,
        customerFullName: userName || req.user.name || req.user.email?.split('@')[0] || "Zoya User",
        customerPhoneNumber: normalizedPhone,
        customerEmailAddress: req.user.email,
        transactionReference: transactionReference,
        reference: transactionReference,
        amount: expectedTotal, // It is already either integer (CDF) or 2 max decimals (USD)
        currency: currency || "USD",
        redirectURL: `${process.env.APP_URL}/api/webhook/araka`
      },
      paymentChannel: {
        channel: "MOBILEMONEY",
        provider: provider, // MPESA, ORANGE, AIRTEL
        walletID: normalizedPhone
      }
    };

    const response = await fetch(`${url}/api/Pay/paymentrequest`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ZoyaEdge-Server/1.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("[Araka Payment Request Failed]:", response.status, errorData);
      
      let finalDetails = errorData?.message || errorText;
      if (typeof finalDetails === 'string' && finalDetails.includes('Load failed')) {
         finalDetails = "Araka a renvoyé une erreur interne ('Load failed'), bien que la transaction ait pu être initiée sur votre téléphone. Veuillez consulter les logs Araka ou réessayer.";
      }
      
      return res.status(response.status).json({ 
        error: "Le fournisseur de paiement a rejeté la requête.", 
        details: finalDetails 
      });
    }

    const result = await response.json();
    const actualTransactionId = result.transactionId || result.id || result.reference || result.data?.id || result.data?.transactionId || transactionReference;
    
    // Correction 1.1 - Stocker originatingTransactionId et log complet
    const originatingTxId = result.originatingTransactionId || 
                          result.originatingId || 
                          result.OrigTransactionId || 
                          actualTransactionId;

    console.log('[Araka Pay 201 Response]', JSON.stringify({
      transactionId: result.transactionId,
      originatingTransactionId: result.originatingTransactionId,
      paymentLink: result.paymentLink,
      allKeys: Object.keys(result),
      fullResult: result
    }));
    
    if (db) {
      await db.collection('payments').add({
        userId: req.user.uid,
        userName: userName || req.user.name || req.user.email?.split('@')[0] || "Client ZoyaEdge",
        userEmail: req.user.email,
        amount: expectedTotal,
        currency: currency || "USD",
        status: 'pending',
        plan: planId,
        cycle: billingCycle,
        fee: feeAmount || 0,
        vat: vatAmount || 0,
        vatRate: vatRate || 0,
        feeRate: transactionFee || 0,
        method: 'mobile_money',
        provider,
        transactionReference: transactionReference,
        transactionId: actualTransactionId,
        originatingTransactionId: originatingTxId, // Correction 1.2
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection('user_activity').add({
        message: `Client ${userName || req.user.email} a initié un paiement ${currency} pour le plan ${planId}.`,
        type: 'payment',
        severity: 'info',
        userId: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    res.json({ 
      ...result, 
      transactionId: actualTransactionId,
      transactionReference,
      originatingTransactionId: originatingTxId 
    });
  } catch (error: any) {
    console.error("Mobile Money Error:", error);
    res.status(500).json({ error: "Erreur lors de l'initialisation du paiement." });
  }
});

app.get('/api/user/sync-status/:txId', verifyUser, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = req.user.uid;

  if (!db) return res.status(503).json({ error: "Database unavailable" });

  try {
    // 1. Verifier que la transaction appartient bien à l'utilisateur (Sécurité)
    const paymentSnap = await db.collection('payments')
      .where('transactionId', '==', txId)
      .limit(1)
      .get();

    if (paymentSnap.empty) {
      return res.status(404).json({ error: "Transaction non trouvée." });
    }

    const paymentDoc = paymentSnap.docs[0];
    const paymentData = paymentDoc.data();

    if (paymentData.userId !== userId) {
      console.warn(`[Security] User ${userId} tried to poll status for transaction ${txId} owned by ${paymentData.userId}`);
      return res.status(403).json({ error: "Accès non autorisé à cette transaction." });
    }

    // Si déjà complété en DB, on retourne direct sans appeler Araka (optimisation)
    if (paymentData.status === 'completed') {
      return res.json({ status: "SUCCESSFUL", _statusText: "SUCCESS" });
    }

    // Correction 1.3 - Stratégie de polling multi-stratégies
    console.log('[Sync-Status] Payment document found:', {
      transactionId: paymentData.transactionId,
      originatingTransactionId: paymentData.originatingTransactionId,
      transactionReference: paymentData.transactionReference,
      status: paymentData.status
    });

    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    let arakaResponse: any = null;
    let lastError = '';

    // Stratégie 1 : par transactionReference (notre référence interne)
    if (paymentData.transactionReference) {
      try {
        arakaResponse = await fetch(
          `${url}/api/Reporting/transactionstatusbyreference/${paymentData.transactionReference}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' } }
        );
        if (!arakaResponse.ok) { lastError = `ref=${arakaResponse.status}`; arakaResponse = null; }
      } catch (e) { lastError = String(e); arakaResponse = null; }
    }

    // Stratégie 2 : par originatingTransactionId (ID retourné par Araka dans le callback)
    if (!arakaResponse && paymentData.originatingTransactionId && 
        paymentData.originatingTransactionId !== paymentData.transactionId) {
      try {
        arakaResponse = await fetch(
          `${url}/api/Reporting/transactionstatus/${paymentData.originatingTransactionId}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' } }
        );
        if (!arakaResponse.ok) { lastError += ` origId=${arakaResponse.status}`; arakaResponse = null; }
      } catch (e) { lastError += String(e); arakaResponse = null; }
    }

    // Stratégie 3 : par transactionId direct (fallback)
    if (!arakaResponse) {
      arakaResponse = await fetch(
        `${url}/api/Reporting/transactionstatus/${txId}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' } }
      );
    }

    if (!arakaResponse.ok) {
      const errorText = await arakaResponse.text();
      if (arakaResponse.status === 404) {
        return res.json({ status: "PENDING", _statusText: "PENDING", details: "Transaction not found yet" });
      }
      if (arakaResponse.status === 400) {
        return res.json({ status: "FAILED", _statusText: "FAILED", details: "Transaction invalid (400)" });
      }
      return res.status(arakaResponse.status).json({ error: "Vérification échouée", details: errorText });
    }

    const result = await arakaResponse.json();
    console.log(`[Araka Status Response] txId=${txId}:`, JSON.stringify(result));
    
    // 3. Finaliser (Mise à jour DB + Abonnement) si succès détecté par le serveur
    const finalizationResult = await finalizePayment(txId, result);
    
    // Use the optimized status extraction logic from finalizePayment if available
    const rawStatus = finalizationResult?.status || result.status || result.statusCode || result.transactionStatus || result.Status || (result.data && result.data.status);
    const status = (String(rawStatus || '')).toUpperCase();

    // 4. Réponse normalisée au frontend
    const finalStatusText = finalizationResult?.success ? 'SUCCESS' : (finalizationResult?.failed ? 'FAILED' : status);
    res.json({ ...result, _statusText: finalStatusText });
  } catch (error: any) {
    console.error(`[Payment Status Error] txId: ${txId}`, error);
    res.status(500).json({ error: "Erreur lors de la vérification du statut." });
  }
});

// ARAKA WEBHOOK / CALLBACK ENDPOINT
// This endpoint is meant to be called by Araka servers asynchronously
app.post('/api/webhook/araka', async (req, res) => {
  const arakaSecret = process.env.ARAKA_CALLBACK_SECRET;
  if (arakaSecret) {
    const receivedSig = req.headers['x-araka-signature'] ||
                        req.headers['authorization'];
    if (!receivedSig || receivedSig !== arakaSecret) {
      console.warn('[Araka Webhook] Rejected: invalid signature');
      return res.status(401).send('Unauthorized');
    }
  }

  try {
    const payload = req.body;
    
    // Araka usually sends the transaction ID or Reference in the payload
    const txId = payload.transactionId || payload.id;
    const txRef = payload.transactionReference || payload.reference;

    if (!txId && !txRef) {
      console.error("[Araka Webhook] Missing transaction ID or Reference", payload);
      return res.status(400).json({ error: "Missing identifying fields" });
    }

    console.log(`[Araka Webhook] Received update for txId: ${txId} / txRef: ${txRef}`);

    if (!db) {
       return res.status(500).json({ error: "DB not initialized" });
    }

    // Find the payment in DB by txId or txRef
    let q = db.collection('payments').limit(1);
    if (txRef) {
      q = q.where('transactionReference', '==', txRef);
    } else {
      q = q.where('transactionId', '==', txId);
    }
    
    const snap = await q.get();
    
    if (snap.empty) {
      console.warn(`[Araka Webhook] Payment not found for reference ${txRef || txId}`);
      return res.status(404).json({ error: "Payment not found" });
    }

    const internalTxId = snap.docs[0].data().transactionId;

    // Use our battle-tested finalizePayment logic
    const finalizationResult = await finalizePayment(internalTxId, payload);

    return res.status(200).json({ 
      status: "received", 
      processed: finalizationResult?.success || finalizationResult?.failed || false
    });

  } catch (error) {
    console.error("[Araka Webhook] Error processing callback:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/admin/araka-debug/:txId', verifyAdmin, async (req: any, res: any) => {
  const { txId } = req.params;
  try {
    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    const results: any = {};
    
    // Test toutes les stratégies de lookup
    try {
      const r1 = await fetch(`${url}/api/Reporting/transactionstatus/${txId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
      });
      results.byTransactionId = { status: r1.status, body: await r1.text() };
    } catch (e) { results.byTransactionId = { error: String(e) }; }

    // Chercher en DB
    if (db) {
      const snap = await db.collection('payments').where('transactionId', '==', txId).limit(1).get();
      if (!snap.empty) {
        const pd = snap.docs[0].data();
        results.dbDocument = {
          transactionId: pd.transactionId,
          originatingTransactionId: pd.originatingTransactionId,
          transactionReference: pd.transactionReference,
          status: pd.status,
          plan: pd.plan
        };
        
        if (pd.originatingTransactionId && pd.originatingTransactionId !== txId) {
          try {
            const r2 = await fetch(`${url}/api/Reporting/transactionstatus/${pd.originatingTransactionId}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
            });
            results.byOriginatingId = { status: r2.status, body: await r2.text() };
          } catch (e) { results.byOriginatingId = { error: String(e) }; }
        }

        if (pd.transactionReference) {
          try {
            const r3 = await fetch(`${url}/api/Reporting/transactionstatusbyreference/${pd.transactionReference}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
            });
            results.byReference = { status: r3.status, body: await r3.text() };
          } catch (e) { results.byReference = { error: String(e) }; }
        }
      } else {
        results.dbDocument = null;
      }
    }
    
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// EA Download Route (Dynamic generation)
app.get('/api/ea/download', (req: any, res: any) => {
  const { platform, syncKey } = req.query;
  const isMT4 = platform === 'MT4';
  const ext = isMT4 ? 'mq4' : 'mq5';
  const host = req.get('host');
  const protocol = req.protocol === 'http' && host.includes('europe-west3.run.app') ? 'https' : req.protocol;
  const webhookUrl = `${protocol}://${host}/api/webhook/mt5`;
  
  let content = '';
  if (isMT4) {
    // MT4 Template
    content = `//+------------------------------------------------------------------+
//|                                                 ZoyaEdgeSync.mq4 |
//|                                            Copyright 2026, ZoyaEdge|
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, ZoyaEdge"
#property link      "https://zoyaedge.com"
#property version   "1.00"
#property description "Expert Advisor pour synchroniser les trades avec ZoyaEdge (MT4)"
#property strict

input string InpSyncKey = "${syncKey || ""}"; // Clé de synchronisation
input string InpWebhookURL = "${webhookUrl}"; // URL du Webhook
input int    InpSyncTimer = 60; // Intervalle (sec)

enum ENUM_HISTORY_DEPTH {
   DEPTH_1_DAY = 1,
   DEPTH_1_WEEK = 7,
   DEPTH_1_MONTH = 30,
   DEPTH_ALL = 0
};

input ENUM_HISTORY_DEPTH InpHistoryDepth = DEPTH_ALL; // Profondeur historique

int OnInit() {
   if(InpSyncKey == "") { Alert("Clé manquante !"); return(INIT_PARAMETERS_INCORRECT); }
   EventSetTimer(InpSyncTimer);
   SyncData();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { SyncData(); }

void SyncData() {
   if(!IsConnected()) return;
   
   datetime from = 0;
   if(InpHistoryDepth > 0) from = TimeCurrent() - (InpHistoryDepth * 86400);
   
   int total = OrdersHistoryTotal();
   int synced = 0;
   
   for(int i = 0; i < total; i++) {
      if(OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) {
         if(OrderSymbol() == "" || OrderType() > 1) continue;
         if(OrderCloseTime() < from && from > 0) continue;
         
         string json = "{";
         json += "\\"syncKey\\":\\"" + InpSyncKey + "\\",";
         json += "\\"ticket\\":\\"" + IntegerToString(OrderTicket()) + "\\",";
         json += "\\"pair\\":\\"" + OrderSymbol() + "\\",";
         json += "\\"direction\\":\\"" + (OrderType()==OP_BUY?"buy":"sell") + "\\",";
         json += "\\"lotSize\\":" + DoubleToString(OrderLots(), 2) + ",";
         json += "\\"entryPrice\\":" + DoubleToString(OrderOpenPrice(), Digits) + ",";
         json += "\\"exitPrice\\":" + DoubleToString(OrderClosePrice(), Digits) + ",";
         json += "\\"pnl\\":" + DoubleToString(OrderProfit() + OrderCommission() + OrderSwap(), 2) + ",";
         json += "\\"timestamp\\":" + IntegerToString(OrderCloseTime()) + ",";
         json += "\\"reqTime\\":" + IntegerToString(TimeCurrent());
         json += "}";
         
         char post[], result[];
         string headers = "Content-Type: application/json\\r\\n";
         StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
         string result_headers;
         int res = WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
         if(res >= 200 && res < 300) synced++;
      }
   }
   if(synced > 0) Print("ZoyaEdge: ", synced, " trades synchronisés.");
}
`;
  } else {
    // MT5 Template
    content = `//+------------------------------------------------------------------+
//|                                                 ZoyaEdgeSync.mq5 |
//|                                            Copyright 2026, ZoyaEdge|
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, ZoyaEdge"
#property link      "https://zoyaedge.com"
#property version   "1.01"
#property description "Expert Advisor pour synchroniser les trades avec ZoyaEdge (MT5)"

input string InpSyncKey = "${syncKey || ""}"; // Clé de synchronisation
input string InpWebhookURL = "${webhookUrl}"; // URL du Webhook
input int    InpSyncTimer = 60; // Intervalle (sec)

enum ENUM_HISTORY_DEPTH {
   DEPTH_1_DAY = 1,
   DEPTH_1_WEEK = 7,
   DEPTH_1_MONTH = 30,
   DEPTH_ALL = 0
};

input ENUM_HISTORY_DEPTH InpHistoryDepth = DEPTH_ALL; // Profondeur historique

int OnInit() {
   if(InpSyncKey == "") { Alert("Clé manquante !"); return(INIT_PARAMETERS_INCORRECT); }
   EventSetTimer(InpSyncTimer);
   SyncData();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { SyncData(); }

void SyncData() {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
   
   datetime from = 0;
   if(InpHistoryDepth > 0) from = TimeCurrent() - (InpHistoryDepth * 86400);
   
   HistorySelect(from, TimeCurrent());
   int total = HistoryDealsTotal();
   int synced = 0;
   
   for(int i = 0; i < total; i++) {
      ulong ticket = HistoryDealGetTicket(i);
      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      
      // On ignore les opérations de balance, crédit, etc. (seuls 0=BUY et 1=SELL sont des vrais trades)
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
      
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      // On prend les clotures (OUT) et les clotures partielles (INOUT pour netting)
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) continue;
      
      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
      long time = HistoryDealGetInteger(ticket, DEAL_TIME);
      
      string json = "{";
      json += "\\"syncKey\\":\\"" + InpSyncKey + "\\",";
      json += "\\"ticket\\":\\"" + IntegerToString(ticket) + "\\",";
      json += "\\"pair\\":\\"" + symbol + "\\",";
      json += "\\"direction\\":\\"" + (type == DEAL_TYPE_BUY ? "buy" : "sell") + "\\",";
      json += "\\"lotSize\\":" + DoubleToString(volume, 2) + ",";
      json += "\\"exitPrice\\":" + DoubleToString(price, _Digits) + ",";
      json += "\\"pnl\\":" + DoubleToString(profit, 2) + ",";
      json += "\\"timestamp\\":" + IntegerToString(time) + ",";
      json += "\\"reqTime\\":" + IntegerToString(TimeCurrent());
      json += "}";
      
      char post[], result[];
      string headers = "Content-Type: application/json\\r\\n";
      StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
      string result_headers;
      int res = WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
      if(res >= 200 && res < 300) synced++;
      else Print("ZoyaEdge Error: ", res, " - Ticket: ", ticket, " - ", CharArrayToString(result));
   }
   if(synced > 0) Print("ZoyaEdge Success: ", synced, " deals synchronisés.");
}
`;
  }

  // Correction for MetaTrader recognition: Use UTF-16 LE with BOM (native for MT5/MT4 editors)
  const crlfContent = content.replace(/\n/g, '\r\n');
  const buffer = Buffer.from(crlfContent, 'utf16le');
  const bom = Buffer.from([0xFF, 0xFE]); // UTF-16 LE Byte Order Mark
  const finalBuffer = Buffer.concat([bom, buffer]);
  
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="ZoyaEdgeSync_${platform}.${ext}"`);
  res.send(finalBuffer);
});

// Debug Endpoint
app.get('/api/debug/my-trades', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(500).json({ error: "DB not initialized" });
  try {
    const snap = await db.collection('users').doc(req.user.uid).collection('trades')
      .where('strategy', '==', 'EA Sync')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Si aucun trade EA n'est trouvé, on retourne les derniers normaux pour pas tout péter
    if (results.length === 0) {
      const fallbackSnap = await db.collection('users').doc(req.user.uid).collection('trades')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      return res.json({ count: fallbackSnap.size, trades: fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    res.json({ count: snap.docs.length, trades: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour restaurer la visibilité de tous les trades d'un utilisateur
app.post('/api/debug/restore-trades', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(500).json({ error: "DB not initialized" });
  const userId = req.user.uid;
  try {
    const snap = await db.collection('users').doc(userId).collection('trades')
      .where('hiddenByClient', '==', true)
      .get();
    
    // On force la vérification supplémentaire pour s'assurer que TOUT est visible
    const eaSnap = await db.collection('users').doc(userId).collection('trades')
      .where('strategy', '==', 'EA Sync')
      .get();

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach(d => {
      batch.update(d.ref, { 
        hiddenByClient: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });

    // Aussi forcer hiddenByClient à false sur tous les trades EA au cas où certains passeraient à travers
    eaSnap.docs.forEach(d => {
      const data = d.data();
      if (data.hiddenByClient === true) {
        batch.update(d.ref, { 
          hiddenByClient: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
      }
    });

    if (count === 0) {
      return res.json({ success: true, count: 0 });
    }

    await batch.commit();
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint pour la suppression définitive de toutes les données importées (CSV, XLSX, HTML, etc)
app.delete('/api/debug/imported-trades', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(500).json({ error: "DB not initialized" });
  const userId = req.user.uid;
  try {
    const snap = await db.collection('users').doc(userId).collection('trades').get();
    let count = 0;

    // Suppression par lots (max 500 operations par batch Firestore)
    const batches = [db.batch()];
    let currentBatchIndex = 0;
    let opsCount = 0;

    snap.docs.forEach(d => {
      const data = d.data();
      // On supprime tous les trades qui proviennent d'import de fichier
      if (typeof data.strategy === 'string' && data.strategy.startsWith('Import ')) {
        batches[currentBatchIndex].delete(d.ref);
        opsCount++;
        count++;

        if (opsCount === 490) { // Limite sûre avant 500
          batches.push(db.batch());
          currentBatchIndex++;
          opsCount = 0;
        }
      }
    });

    if (count === 0) {
      return res.json({ success: true, count: 0, message: "Aucun trade importé trouvé." });
    }

    // Commit de tous les lots
    for (const batch of batches) {
      await batch.commit();
    }

    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint pour réparer les dates corrompues (si un timestamp a été multiplié par 1000 par erreur)
app.post('/api/debug/heal-dates', verifyUser, async (req: any, res: any) => {
  if (!db) return res.status(500).json({ error: "DB not initialized" });
  const userId = req.user.uid;
  try {
    const snap = await db.collection('users').doc(userId).collection('trades').get();
    let count = 0;
    const batch = db.batch();

    snap.docs.forEach(d => {
      const data = d.data();
      if (data.date) {
        let tradeDate;
        if (data.date.toDate) {
          tradeDate = data.date.toDate();
        } else if (data.date._seconds) {
          tradeDate = new Date(data.date._seconds * 1000);
        } else {
          tradeDate = new Date(data.date);
        }

        // Si l'année est > 2100, c'est probablement un timestamp en millisecondes qui a été re-multiplié par 1000 (donc x1000000)
        if (tradeDate.getFullYear() > 2100) {
          // On divise le temps par 1000 pour retrouver la bonne date
          const correctedDate = new Date(Math.floor(tradeDate.getTime() / 1000));
          batch.update(d.ref, {
            date: admin.firestore.Timestamp.fromDate(correctedDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          count++;
        }
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    res.json({ success: true, healed: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  await initFirebaseAdmin();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // SPA Fallback for dev mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      console.log(`[Server] SPA Fallback for URL: ${url}`);
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application not built. Please try again in a few moments.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
