import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = 3000;

// Trust proxy is required for express-rate-limit to work correctly behind the AI Studio proxy
app.set('trust proxy', 1);

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
      if (testError.code === 7) {
        console.warn("[Firebase] WARNING: Permission Denied. If you are using a custom Firebase project, you need to provide a FIREBASE_SERVICE_ACCOUNT_KEY environment variable for the server to access Firestore.");
      } else {
        console.error("[Firebase] Firestore connection test FAILED:", testError);
      }
    });
    
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

// Webhook for MT5 EA
app.post('/api/webhook/mt5', webhookLimiter, async (req, res) => {
  const { syncKey, pair, direction, lotSize, exitPrice, pnl, timestamp } = req.body;

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
    await tradesRef.add({
      userId,
      pair,
      direction,
      entryPrice: exitPrice, // Simplified: we use exitPrice as entry for now
      exitPrice,
      lotSize,
      pnl,
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
app.post('/api/connections/:connectionId/sync', async (req, res) => {
  const { connectionId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

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

app.get('/api/config/coach-instructions', (req, res) => {
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
      const superAdmins = settingsSnap.data()?.superAdmins || ['kongolmandf@gmail.com'];
      isSuperAdmin = superAdmins.includes(email);
    } catch (dbError) {
      console.error("Firestore check failed in verifyAdmin, falling back to hardcoded check:", dbError);
      isSuperAdmin = email === 'kongolmandf@gmail.com';
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
      const superAdmins = settingsSnap.data()?.superAdmins || ['kongolmandf@gmail.com'];

      if (superAdmins.includes(email?.toLowerCase())) {
        req.user = decodedToken;
        next();
      } else {
        res.status(403).json({ error: "Forbidden: Super Admin access required" });
      }
    } catch (dbError) {
      console.error("Firestore check failed in verifySuperAdmin, falling back to hardcoded check:", dbError);
      if (email?.toLowerCase() === 'kongolmandf@gmail.com') {
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
      aiCredits: 10,
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

// AI Coach Proxy Endpoint
app.post('/api/ai/coach', verifyUser, async (req, res) => {
  const { input } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY non configurée sur le serveur." });
  }

  try {
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
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    
    // Clean JSON if model wraps it in markdown
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    res.json(JSON.parse(cleanedText));
  } catch (error: any) {
    handleGeminiError(error, res);
  }
});

// AI Coach Ask Endpoint
app.post('/api/ai/ask', verifyUser, async (req, res) => {
  const { trades, language, strategies, instruction } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY non configurée sur le serveur." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `
Analyze this trading dataset and return structured output only.
IMPORTANT: All text fields (message, action, reason, next_focus) MUST be in ${language === 'fr' ? 'French (Français)' : 'English'}.

USER STRATEGY DEFINITIONS:
${strategies?.length > 0 ? JSON.stringify(strategies) : "No custom strategies defined. Use default trading knowledge."}

DATA:
${JSON.stringify(trades || [])}

MODE:
HYBRID

STRICT OUTPUT FORMAT REQUIRED:
JSON ONLY
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    res.json(JSON.parse(cleanedText));
  } catch (error: any) {
    handleGeminiError(error, res);
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
