import { Response } from 'express';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';
import { tradesService } from './trades.service';

export const getMyTrades = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await tradesService.getMyTrades(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    console.error("getMyTrades error:", error);
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const restoreTrades = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await tradesService.restoreTrades(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    console.error("restoreTrades error:", error);
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const deleteImportedTrades = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await tradesService.deleteImportedTrades(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    console.error("deleteImportedTrades error:", error);
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const healDates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await tradesService.healDates(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    console.error("healDates error:", error);
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};
