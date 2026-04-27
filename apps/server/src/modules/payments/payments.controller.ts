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
