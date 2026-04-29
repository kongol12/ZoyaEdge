export type UserPlan = 'Discovery' | 'Zoya PRO' | 'Zoya PREMIUM';

export interface AIAnalysisResult {
  score: number;
  risk: number;
  discipline: number;
  consistency: number;
  decision: "STOP" | "REDUCE" | "GO";
  keyIssues: string[];
  actions: string[];
  summary?: string;
  detailedReport?: GPTReport;
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
