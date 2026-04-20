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

app.use(cors());

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

  const { syncKey, pair, direction, lotSize, entryPrice, exitPrice, pnl, timestamp, ticket } = parsedBody;
  const signature = req.headers['x-zoyaedge-signature'] as string | undefined;

  if (!syncKey) return res.status(400).json({ error: "Missing syncKey" });

  // Anti-replay : fenêtre de 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (!timestamp || Math.abs(now - timestamp) > 300) {
    return res.status(401).json({ error: "Timestamp invalide ou requête expirée." });
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
      const existing = await tradesRef.where('ticket', '==', ticket).limit(1).get();
      if (!existing.empty) {
        return res.json({ success: true, skipped: true, reason: "ticket already synced" });
      }
    }

    await tradesRef.add({
      userId, pair, direction,
      entryPrice: entryPrice ?? exitPrice,
      exitPrice, lotSize, pnl,
      ticket: ticket || null,
      strategy: "EA Sync",
      emotion: "😐",
      session: "EA",
      date: admin.firestore.Timestamp.fromMillis(timestamp * 1000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await connectionDoc.ref.update({
      status: 'active',
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
    });

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Webhook for MT5 EA
app.post('/api/webhook/mt5', webhookLimiter, async (req, res) => {
  const { syncKey, pair, direction, lotSize, entryPrice, exitPrice, pnl, timestamp, ticket } = req.body;

  if (!syncKey) {
    return res.status(400).json({ error: "Missing syncKey" });
  }

  if (!db) {
    return res.status(503).json({ error: "Database service unavailable" });
  }

  try {
    // Find the connection by syncKey
    const connectionsRef = db.collection('broker_connections');
    const q = await connectionsRef.where('syncKey', '==', syncKey).limit(1).get();

    if (q.empty) {
      return res.status(404).json({ error: "Invalid syncKey" });
    }

    const connectionDoc = q.docs[0];
    const connectionData = connectionDoc.data();
    const userId = connectionData.userId;

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
      // Update connection status to error
      await connectionDoc.ref.update({
        status: 'error',
      });
      return res.status(403).json({ error: "Subscription expired or invalid. Please upgrade to Pro or Premium." });
    }

    // Add the trade to the user's trades collection
    const tradesRef = db.collection('users').doc(userId).collection('trades');
    
    // Si ticket fourni, vérifier qu'il n'existe pas déjà
    if (ticket) {
      const existingQuery = await tradesRef.where('ticket', '==', ticket).limit(1).get();
      if (!existingQuery.empty) {
        return res.json({ success: true, skipped: true, reason: "ticket already synced" });
      }
    }

    await tradesRef.add({
      userId,
      pair,
      direction,
      entryPrice: entryPrice ?? exitPrice,
      exitPrice,
      lotSize,
      pnl,
      ticket,
      strategy: "EA Sync",
      emotion: "😐",
      session: "EA",
      date: admin.firestore.Timestamp.fromMillis(timestamp * 1000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update connection status
    await connectionDoc.ref.update({
      status: 'active',
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manual Sync Endpoint
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

async function checkAndDeductAICredit(userId: string, db: admin.firestore.Firestore): Promise<{ allowed: boolean; reason?: string }> {
  const userRef = db.collection('users').doc(userId);
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return { allowed: false, reason: "User not found" };
    const userData = userDoc.data()!;
    const subscription = userData.subscription || 'free';

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

    const creditCheck = await checkAndDeductAICredit(req.user.uid, db!);
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

    // Save to Firestore from server-side (bypasses rules)
    try {
      await db.collection('users').doc(req.user.uid).collection('ai_reports').add({
        date: admin.firestore.Timestamp.now(),
        mode: input.mode || 'STANDARD',
        metrics: input.metrics,
        response: aiAnalysis
      });
      console.log(`[AI Coach] Report saved successfully for user: ${req.user.uid}`);
    } catch (saveError) {
      console.error("[AI Coach] Failed to save report to Firestore:", saveError);
    }

    res.json(aiAnalysis);
  } catch (error: any) {
    handleGeminiError(error, res);
  }
});

// AI Coach Ask Endpoint
app.post('/api/ai/ask', verifyUser, async (req: any, res: any) => {
  const { trades, language, strategies, instruction, mode = 'STANDARD' } = req.body;

  console.log(`[AI Coach] Checking API Key. Length: ${process.env.GEMINI_API_KEY?.length}, Starts with: ${process.env.GEMINI_API_KEY?.substring(0, 4)}`);
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
  const creditCheck = await checkAndDeductAICredit(req.user.uid, db);
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

  console.log(`[Araka Auth] Tentative stricte de connexion avec l'email: '${email}' sur ${url}`);

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

app.post('/api/payments/mobile-money/pay', verifyUser, async (req: any, res: any) => {
  const { amount, currency, phoneNumber, provider, planId } = req.body;
  if (!amount || !phoneNumber || !provider) return res.status(400).json({ error: "Paramètres manquants" });

  try {
    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    // Fetch multi-currency config from app_settings
    let pageId = process.env.ARAKA_PAYMENT_PAGE_ID;
    
    // Check specific env vars based on currency
    if (currency === 'CDF' && process.env.ARAKA_PAYMENT_PAGE_ID_CDF) {
      pageId = process.env.ARAKA_PAYMENT_PAGE_ID_CDF;
    } else if (currency === 'USD' && process.env.ARAKA_PAYMENT_PAGE_ID_USD) {
      pageId = process.env.ARAKA_PAYMENT_PAGE_ID_USD;
    }

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

    if (!pageId) throw new Error('ARAKA_PAYMENT_PAGE_ID de production non configuré pour cette devise');

    const transactionReference = `ZOYA_${req.user.uid.slice(0, 5)}_${Date.now()}`;
    
    const payload = {
      order: {
        paymentPageId: pageId,
        customerFullName: req.user.name || "Zoya User",
        customerPhoneNumber: phoneNumber,
        customerEmailAddress: req.user.email || "user@zoyaedge.com",
        transactionReference: transactionReference,
        amount: parseFloat(amount),
        currency: currency || "USD",
        redirectURL: `${process.env.APP_URL}/subscription/callback`
      },
      paymentChannel: {
        channel: "MOBILEMONEY",
        provider: provider, // MPESA, ORANGE, AIRTEL
        walletID: phoneNumber
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
      return res.status(response.status).json({ 
        error: "Erreur Araka", 
        details: errorData 
      });
    }

    const result = await response.json();
    
    // Log temp transaction in Firestore
    if (db) {
      await db.collection('payments').add({
        userId: req.user.uid,
        amount,
        currency: currency || "USD",
        status: 'pending',
        plan: planId,
        method: 'mobile_money',
        provider,
        transactionReference,
        transactionId: result.transactionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // System Journaling
      await db.collection('system_logs').add({
        event: 'PAYMENT_INITIATED',
        details: { provider, planId, amount, currency, transactionId: result.transactionId },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('activities').add({
        message: `Client ${req.user.email} a initié un paiement Mobile Money (${provider}).`,
        type: 'payment',
        severity: 'info',
        userId: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Explicitly return transactionId and transactionReference to the frontend
    res.json({ 
      ...result, 
      transactionId: result.transactionId,
      transactionReference 
    });
  } catch (error: any) {
    console.error("Mobile Money Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments/mobile-money/status/:txId', verifyUser, async (req: any, res: any) => {
  const { txId } = req.params;
  try {
    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    // We use transactionstatus/{transactionid} as per Araka standard
    const response = await fetch(`${url}/api/Reporting/transactionstatus/${txId}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ZoyaEdge-Server/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Si on a un 404, on renvoie une attente au lieu d'une erreur fatale car la transaction peut ne pas être encore indexée.
      if (response.status === 404) {
         return res.json({ status: "PENDING", _statusText: "PENDING", details: "Transaction not found yet" });
      }
      return res.status(response.status).json({ error: "Vérification échouée", details: errorText });
    }
    const result = await response.json();
    console.log(`[Araka Polling] Status pour transId ${txId}:`, JSON.stringify(result));
    
    // Result can be "SUCCESSFUL", "FAILED", "PENDING" etc (depends on Araka)
    const rawStatus = result.status || result.statusCode || result.transactionStatus || result.Status || (result.data && result.data.status);
    const rawDesc = result.statusDescription || result.message || "";
    const status = (typeof rawStatus === 'string' ? rawStatus : '').toUpperCase();
    const desc = (typeof rawDesc === 'string' ? rawDesc : '').toUpperCase();
    
    // Extension des clés de succès
    const isSuccess = status === 'SUCCESSFUL' || status === 'COMPLETED' || status === 'SUCCESS' || status === '200' || status === 'APPROVED' || desc === 'APPROVED';
    const isFailed = status === 'FAILED' || status === 'CANCELLED' || status === 'REJECTED' || status === 'ERROR' || status === '400';

    if ((isSuccess || isFailed) && db) {
      const q = await db.collection('payments')
        .where('userId', '==', req.user.uid)
        .where('transactionId', '==', txId)
        .limit(1)
        .get();

      if (!q.empty) {
        const paymentDoc = q.docs[0];
        const paymentData = paymentDoc.data();
        
        if (isSuccess && paymentData.status !== 'completed') {
          await paymentDoc.ref.update({ 
            status: 'completed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // UPGRADE USER
          const userRef = db.collection('users').doc(paymentData.userId);
          const durationDays = paymentData.cycle === 'yearly' ? 365 : 31;
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + durationDays);

          await userRef.update({
            subscription: paymentData.plan,
            subscriptionStatus: 'active',
            subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
            aiCredits: paymentData.plan === 'pro' ? 30 : 9999,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // System Journaling
          await db.collection('system_logs').add({
            event: 'PAYMENT_UPGRADED_ACCOUNT',
            details: { userId: paymentData.userId, transactionId: txId, plan: paymentData.plan },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('activities').add({
            message: `Abonnement ${paymentData.plan} activé avec succès.`,
            type: 'payment',
            severity: 'info',
            userId: paymentData.userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else if (isFailed && paymentData.status === 'pending') {
          await paymentDoc.ref.update({ 
            status: 'failed',
            failureReason: result.message || result.statusDescription || "Transaction échouée",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // System Journaling
          await db.collection('system_logs').add({
            event: 'PAYMENT_FAILED',
            details: { userId: paymentData.userId, transactionId: txId, error: result.message },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('activities').add({
            message: `L'achat de l'abonnement a échoué.`,
            type: 'payment',
            severity: 'error',
            userId: paymentData.userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }

    // Force normalized output to guarantee frontend catch
    const finalStatusText = isSuccess ? 'SUCCESS' : (isFailed ? 'FAILED' : status);
    res.json({ ...result, _statusText: finalStatusText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
