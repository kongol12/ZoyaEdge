import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';
import { paymentsService } from './payments.service';

export const syncSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await paymentsService.syncSettings(req.user.uid, req.user, req.body);
    return res.json(result);
  } catch (error: any) {
    console.error("[Payment Init Error]", error);
    return res.status(error.code || 500).json({ error: error.message || "Erreur interne", details: error.details });
  }
};

export const syncStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await paymentsService.syncStatus(req.user.uid, req.params.txId);
    return res.json(result);
  } catch (error: any) {
    console.error(`[Payment Status Error] txId: ${req.params.txId}`, error);
    return res.status(error.code || 500).json({ error: error.message || "Erreur lors de la vérification du statut." });
  }
};

export const handleArakaWebhook = async (req: Request, res: Response) => {
  try {
    console.log("[Araka Webhook Received]", JSON.stringify(req.body));
    // Extraction de l'ID de transaction (Araka envoie généralement transaction_id ou similar)
    const txId = req.body.transaction_id || req.body.transactionId || req.body.id || (req.body.order && req.body.order.transactionId);
    
    if (!txId) {
       console.warn("[Araka Webhook] No transaction ID found in body");
       return res.status(400).send("No transaction ID");
    }

    await paymentsService.finalizePayment(txId, req.body);
    return res.status(200).send("OK");
  } catch (error: any) {
    console.error("[Araka Webhook Error]", error);
    return res.status(500).send("Webhook Error");
  }
};

export const arakaDebug = async (req: Request, res: Response) => {
  try {
    const result = await paymentsService.arakaDebug(req.params.txId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
