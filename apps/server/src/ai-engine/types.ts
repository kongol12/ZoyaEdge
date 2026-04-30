export type UserPlan = 'Discovery' | 'Zoya PRO' | 'Zoya PREMIUM';

export interface AIAnalysisResult {
  summary: {
    total_pnl: number;
    winrate: number;
  };
  scores: {
    risk_score: number;
    discipline_score: number;
    consistency_score: number;
  };
  alerts: {
    type: 'risk' | 'behavior' | 'strategy' | 'discipline';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }[];
  actions: {
    priority: number;
    action: string;
    reason: string;
  }[];
  coach_decision: {
    status: 'green' | 'orange' | 'red';
    action: 'continue' | 'reduce_risk' | 'stop_trading';
  };
  detailedReport?: GPTReport;
  deepSeekSummary?: DeepSeekSummary;
}

export interface GPTReport {
  overview: string;
  risk_analysis: string;
  discipline_analysis: string;
  performance_analysis: string;
  action_plan: string[];
}

export interface DeepSeekSummary {
  patterns: string[];
  anomalies: string[];
  dataReduction: string;
  rawStats: any;
}

export interface AIUsageLog {
  userId: string;
  model: string;
  tokens: number;
  cost: number;
  plan: UserPlan;
  timestamp: any; // Firestore Timestamp
}
