import { GoogleGenAI } from '@google/genai';
import { calculateZoyaScores, Trade } from '../../../web/src/shared/lib/scoring';
import admin from 'firebase-admin';

export interface AIPipelineResponse {
  summary: {
    total_pnl: number;
    winrate: number;
  };
  scores: {
    risk_score: number;
    discipline_score: number;
    consistency_score: number;
  };
  alerts: Array<{
    type: 'risk' | 'behavior' | 'strategy' | 'discipline';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
  actions: Array<{
    priority: number;
    action: string;
    reason: string;
  }>;
  coach_decision: {
    status: 'green' | 'orange' | 'red';
    action: 'continue' | 'reduce_risk' | 'stop_trading';
  };
}

export class AIPipeline {
  private ai: GoogleGenAI | null = null;

  constructor(private db: admin.firestore.Firestore) {
    if (process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  /**
   * Executes the AI decision pipeline.
   * @param userId The user ID
   * @param subscription User subscription tier
   * @param mode Analysis mode (STANDARD, CONCISE, DETAILED)
   * @param trades Array of trades to analyze
   */
  async execute(userId: string, subscription: string, mode: string, trades: any[]): Promise<AIPipelineResponse> {
    // 1. STAGE 1: CORE ANALYSIS (Math-based)
    const normalizedTrades: Trade[] = trades.map(t => ({
      ...t,
      date: t.date?.toDate ? t.date.toDate().toISOString() : t.date
    }));
    
    const mathScores = calculateZoyaScores(normalizedTrades);

    // 2. STAGE 2: AI REFINEMENT
    let result: AIPipelineResponse;

    if (this.ai) {
      try {
        const prompt = this.buildPrompt(normalizedTrades, mathScores, mode);
        
        const aiResult = await this.ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
          }
        });

        const text = aiResult.text;
        if (!text) {
          throw new Error('AI produced empty content');
        }
        const cleanedText = text.replace(/```json\n?|```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        
        result = {
          summary: {
            total_pnl: normalizedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0),
            winrate: (normalizedTrades.filter(t => t.pnl > 0).length / Math.max(1, normalizedTrades.length)) * 100
          },
          scores: parsed.scores || {
            risk_score: mathScores.risk_score,
            discipline_score: mathScores.discipline_score,
            consistency_score: mathScores.consistency_score
          },
          alerts: parsed.alerts || [],
          actions: parsed.actions || [],
          coach_decision: parsed.coach_decision || {
            status: mathScores.status,
            action: mathScores.status === 'red' ? 'stop_trading' : (mathScores.status === 'orange' ? 'reduce_risk' : 'continue')
          }
        };
      } catch (error) {
        console.error("[AIPipeline] AI Stage failed:", error);
        result = this.generateFallbackResponse(normalizedTrades, mathScores);
      }
    } else {
      result = this.generateFallbackResponse(normalizedTrades, mathScores);
    }

    return result;
  }

  private buildPrompt(trades: Trade[], mathScores: any, mode: string): string {
    return `
You are the ZoyaEdge Trading Performance Decision Engine.
Your task is to analyze trading data and provide a strict, data-driven assessment.

### MISSION
- Detect Overtrading (> 5 trades/day)
- Detect Risk Imbalance (Max loss > 3x average win)
- Detect Emotional instability (High loss rate on emotional trades)
- Detect Strategy/Session weaknesses
- Provide actionable improvements

### CONTEXT
- Mode: ${mode}
- User Data: Last ${trades.length} trades provided.
- Mathematical Scores: ${JSON.stringify(mathScores)}

### DATASET
${JSON.stringify(trades.slice(-50))}

### OUTPUT FORMAT (STRICT JSON ONLY)
{
  "scores": {
    "risk_score": number (0-100),
    "discipline_score": number (0-100),
    "consistency_score": number (0-100)
  },
  "alerts": [
    { "type": "risk"|"behavior"|"strategy"|"discipline", "severity": "low"|"medium"|"high", "message": "string" }
  ],
  "actions": [
    { "priority": number, "action": "string", "reason": "string" }
  ],
  "coach_decision": {
    "status": "green" | "orange" | "red",
    "action": "continue" | "reduce_risk" | "stop_trading"
  }
}
`;
  }

  private generateFallbackResponse(trades: Trade[], mathScores: any): AIPipelineResponse {
    const alerts: any[] = [];
    if (mathScores.risk_score < 70) {
      alerts.push({ type: 'risk', severity: 'high', message: 'Gestion du risque critique détectée algorithmiquement.' });
    }
    
    return {
      summary: {
        total_pnl: trades.reduce((acc, t) => acc + (t.pnl || 0), 0),
        winrate: (trades.filter(t => t.pnl > 0).length / Math.max(1, trades.length)) * 100
      },
      scores: {
        risk_score: mathScores.risk_score,
        discipline_score: mathScores.discipline_score,
        consistency_score: mathScores.consistency_score
      },
      alerts,
      actions: [
        { priority: 1, action: "Maintenir le journal de trading", reason: "Le suivi rigoureux est la base de la performance." }
      ],
      coach_decision: {
        status: mathScores.status,
        action: mathScores.status === 'red' ? 'stop_trading' : (mathScores.status === 'orange' ? 'reduce_risk' : 'continue')
      }
    };
  }
}
