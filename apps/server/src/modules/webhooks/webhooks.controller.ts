import { Request, Response } from 'express';
import { mt5WebhookService } from './webhooks.service';
import { verifyHMACSignature } from '@shared-utils/security';

export const handleMt5Webhook = async (req: Request, res: Response) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
  let parsedBody: any;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const signature = req.headers['x-zoyaedge-signature'] as string | undefined;
  
  try {
    const result = await mt5WebhookService(parsedBody, signature, rawBody);
    return res.json(result);
  } catch (error: any) {
    console.error("Webhook error:", error);
    const code = error.code || 500;
    return res.status(code).json({ error: process.env.NODE_ENV === 'production' ? "Internal Server Error" : error.message });
  }
};

export const handleArakaWebhook = async (req: Request, res: Response) => {
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
    const { getDb } = await import('../../infrastructure/firebase/firebase.client');
    const { finalizePayment } = await import('../payments/payments.service');
    
    const db = getDb();
    if (!db) {
       return res.status(500).json({ error: "DB not initialized" });
    }

    const payload = req.body;
    // ... parse based on json body (araka sends JSON but express.json is applied at /api layer, but wait, the webhook is under /api... ah express.raw might be applied for /api/webhook/araka? No, only mt5. See app.ts) 
    
    let parsedPayload;
    if (Buffer.isBuffer(payload)) {
      parsedPayload = JSON.parse(payload.toString('utf8'));
    } else if (typeof payload === 'string') {
      parsedPayload = JSON.parse(payload);
    } else {
      parsedPayload = payload;
    }

    const txId = parsedPayload.transactionId || parsedPayload.id;
    const txRef = parsedPayload.transactionReference || parsedPayload.reference;

    if (!txId && !txRef) {
      console.error("[Araka Webhook] Missing transaction ID or Reference", parsedPayload);
      return res.status(400).json({ error: "Missing identifying fields" });
    }

    console.log(`[Araka Webhook] Received update for txId: ${txId} / txRef: ${txRef}`);

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
    const finalizationResult = await finalizePayment(internalTxId, parsedPayload);

    return res.status(200).json({ 
      status: "received", 
      processed: finalizationResult?.success || finalizationResult?.failed || false
    });

  } catch (error) {
    console.error("[Araka Webhook] Error processing callback:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
