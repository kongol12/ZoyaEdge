export const GEMINI_DECISION_PROMPT = `Tu es le moteur de décision ZoyaEdge.
Voici les données de trades bruts et la pré-analyse DeepSeek.

Tu dois calculer 3 scores de 0 à 100 :
1. risk_score
2. discipline_score
3. consistency_score

Et produire une DECISION stricte : "STOP", "REDUCE" ou "GO".
Génère une analyse stricte, sans inventer de données.

RETOURNER UNIQUEMENT DU JSON VALIDE.

Format attendu :
{
  "score": number, // global (moyenne)
  "risk": number,
  "discipline": number,
  "consistency": number,
  "decision": "STOP" | "REDUCE" | "GO",
  "keyIssues": ["issue 1", "issue 2"],
  "actions": ["action 1", "action 2"]
}
`;
