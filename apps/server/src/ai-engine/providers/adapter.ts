export interface LLMAdapter {
  call(prompt: string, context?: any): Promise<any>;
  getQuotaInfo?(): Promise<{ remaining: number; resetAt: Date }>;
  getCostPerToken?(): { input: number; output: number };
}

/**
 * Registry for additional adapters.
 * Future adapters like ClaudeAdapter, LlamaAdapter can be added here.
 */
export class AdapterFactory {
  static getAdapter(provider: string): LLMAdapter {
    switch (provider) {
      // Future implementations
      // case 'claude': return new ClaudeAdapter();
      default:
        throw new Error(`Adaptateur non implémenté pour le fournisseur: ${provider}`);
    }
  }
}
