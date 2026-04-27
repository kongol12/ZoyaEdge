import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { globalLimiter } from './middleware/rate-limit.middleware';
import { logger } from './logger';
import { webhooksRoutes } from '../modules/webhooks';
import { authRoutes } from '../modules/auth';
import { tradesRoutes } from '../modules/trades';
import { adminRoutes } from '../modules/admin';
import { aiRoutes } from '../modules/ai';
import { usersRoutes } from '../modules/users';
import { paymentsRoutes } from '../modules/payments';
import { signalsRoutes } from '../modules/signals';

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-zoyaedge-signature', 'x-araka-signature'],
}));

// Inactivity shutdown logic (Development and Production)
const isProd = process.env.NODE_ENV === 'production';
const INACTIVITY_TIMEOUT = isProd ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
let inactivityTimer: NodeJS.Timeout;

const resetInactivityTimer = () => {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    console.log(`[${isProd ? 'Production' : 'Development'}] Server shutting down due to inactivity.`);
    process.exit(0);
  }, INACTIVITY_TIMEOUT);
};

resetInactivityTimer();
app.use((req, res, next) => {
  resetInactivityTimer();
  next();
});

const isProduction = process.env.NODE_ENV === 'production';

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      // Extract user ID if available in request (e.g., from auth middleware)
      userId: (req as any).user?.uid || 'anonymous'
    };

    if (res.statusCode >= 500) {
      logger.error(`[Request] ${req.method} ${req.path} failed`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`[Request] ${req.method} ${req.path} warning`, logData);
    } else {
      logger.info(`[Request] ${req.method} ${req.path} success`, logData);
    }
  });
  next();
});

// Health Checks
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '5.0.0-monorepo'
  });
});

// APIs that need raw body
app.use('/api/webhook', webhooksRoutes);

// General JSON parser for all other routes
app.use(express.json({ limit: '1mb' }));
app.use('/api/', globalLimiter);

// Mount all modules
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', usersRoutes);     // contains /connections/..., /ea/...
app.use('/api', paymentsRoutes);  // contains /user/sync-status, /user/sync-settings
app.use('/api/signals', signalsRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err.status || err.code || 500;
  // Generic message in production for internal server errors
  const message = (process.env.NODE_ENV === 'production' && status === 500)
    ? 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
    : (err.message || 'Une erreur est survenue.');

  logger.error(`[Error] ${status} - ${message}`, { 
    stack: err.stack, 
    path: req.path,
    method: req.method 
  });

  res.status(status).json({
    error: true,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack, details: err.details })
  });
});

export default app;

