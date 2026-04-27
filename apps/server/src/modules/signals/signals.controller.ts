import { Request, Response, NextFunction } from 'express';
import { processMt5Signal, analyzeSignalWithAI } from './signals.service';

export const handleMt5Signal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signalData = req.body;
    const result = await processMt5Signal(signalData);
    
    // Optionally trigger AI analysis in background
    analyzeSignalWithAI(result.signalId).catch(err => console.error("AI Analysis background error:", err));

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getSignalStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // ... logic to fetch signal status
    return res.json({ id, status: 'active' });
  } catch (error) {
    next(error);
  }
};
