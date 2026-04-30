/**
 * Nettoie une chaîne de caractères pour n'extraire que le bloc JSON.
 * Utile pour les réponses de LLM qui incluent souvent des balises ```json ... ```
 */
export function cleanJSON(raw: string): string {
  // Supprimer les balises de code markdown
  let cleaned = raw.replace(/```json\n?|```/g, '').trim();
  
  // Trouver le premier { et le dernier } pour isoler l'objet
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.substring(start, end + 1);
  }
  
  return cleaned;
}

export function safeJSONParse(raw: string): any {
  try {
    return JSON.parse(cleanJSON(raw));
  } catch (error) {
    console.error('[JSON_PARSE_ERROR] Raw output:', raw);
    throw new Error('Le format de réponse de l\'IA est invalide.');
  }
}
