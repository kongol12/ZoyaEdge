export interface AIAnalysisResult {
  score: number;
  risk: number;
  discipline: number;
  consistency: number;
  decision: "STOP" | "REDUCE" | "GO";
  keyIssues: string[];
  actions: string[];
}

export interface TradeActivity {
  pair: string;
  direction: "buy" | "sell";
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  pnl: number;
  strategy: string;
  emotion?: string;
  session?: string;
  date: string;
}

export type SubscriptionPlan = "free" | "zoya_pro" | "zoya_premium";
export type AnalysisMode = "CONCISE" | "STANDARD" | "DETAILED";

export interface AIProviderResult {
  raw: string;
  parsed?: any;
  tokensUsed: number;
  estimatedCost: number;
}
