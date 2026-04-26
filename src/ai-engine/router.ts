import { SubscriptionPlan, AnalysisMode } from './types';

export type AIProviderName = "deepseek" | "gemini" | "gpt";

export function getPipelineForPlanAndMode(
  plan: SubscriptionPlan,
  mode: AnalysisMode
): AIProviderName[] {
  let requestedPipeline: AIProviderName[] = [];

  // Define based on mode
  if (mode === "CONCISE") {
    requestedPipeline = ["deepseek", "gemini"];
  } else if (mode === "STANDARD" || mode === "DETAILED") {
    requestedPipeline = ["deepseek", "gemini", "gpt"];
  }

  // Restrict based on plan capabilities
  if (plan === "free" || plan === ("discovery" as any)) {
    return ["deepseek"]; // Forced to Deepseek only
  }
  
  if (plan === "zoya_pro") {
    // Pro cannot access GPT
    return requestedPipeline.filter(p => p !== "gpt");
  }

  if (plan === "zoya_premium") {
    // Premium has access to everything requested
    return requestedPipeline;
  }

  return ["deepseek"]; // Default fallback
}

export function routeAI(
  task: "pre-process" | "decision" | "report",
  plan: SubscriptionPlan,
  mode: AnalysisMode
): AIProviderName {
  // Select the appropriate model for a specific task if it's available in the pipeline
  const pipeline = getPipelineForPlanAndMode(plan, mode);

  if (task === "pre-process") {
    return "deepseek";
  }

  if (task === "decision") {
    return pipeline.includes("gemini") ? "gemini" : "deepseek";
  }

  if (task === "report") {
    return pipeline.includes("gpt") ? "gpt" : (pipeline.includes("gemini") ? "gemini" : "deepseek");
  }

  return "deepseek";
}
