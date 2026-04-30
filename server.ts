import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import express from 'express';
import { initFirebaseAdmin } from './apps/server/src/infrastructure/firebase/firebase.client';
import app from './apps/server/src/core/app';

const PORT = 3000;

async function startServer() {
  // --- 1. [HAUTE] Validation des secrets au démarrage ---
  const criticalEnvVars = ['ARAKA_EMAIL', 'ARAKA_PASSWORD'];
  const missingVars = criticalEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error(`[SECURITY] Variables d'environnement critiques manquantes: ${missingVars.join(', ')}. Les paiements ne fonctionneront pas.`);
    // On ne fait plus process.exit(1) pour permettre le déploiement initial
  }

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasDeepseek = !!process.env.DEEPSEEK_API_KEY;

  if (!hasGemini && !hasDeepseek) {
    console.error(`[SECURITY] Au moins une clé d'IA (GEMINI_API_KEY ou DEEPSEEK_API_KEY) doit être configurée pour utiliser les fonctions IA.`);
    // On ne fait plus process.exit(1) pour permettre le déploiement initial
  }

  await initFirebaseAdmin();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), 'apps/web/vite.config.ts'),
      root: path.resolve(process.cwd(), 'apps/web'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // SPA Fallback for dev mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'apps/web/index.html'), 'utf-8');
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
    
    // Validation des clés IA confirmée
    if (hasGemini) console.log(`[AI] GEMINI_API_KEY is configured.`);
    if (hasDeepseek) console.log(`[AI] DEEPSEEK_API_KEY is configured.`);
  });
}

startServer();
