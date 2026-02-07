/**
 * Normaliza texto para comparação e deduplicação.
 * - Remove espaços extras no início e fim
 * - Converte para UPPERCASE
 * - Colapsa múltiplos espaços em um único espaço
 * 
 * @example normalizeText("  EB354  - tempo  ") => "EB354 - TEMPO"
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Extrai o código de uma série a partir do nome completo.
 * Ex: "EB354 - Tempo de Despertar" => "EB354"
 * Se não encontrar padrão de código, retorna o texto normalizado.
 */
export function extractSeriesCode(seriesName: string | null | undefined): string {
  if (!seriesName) return 'SEM-SERIE';
  
  const normalized = normalizeText(seriesName);
  
  // Tenta extrair código no início (ex: "EB354 - Título")
  const match = normalized.match(/^([A-Z0-9-]+)/);
  if (match && match[1].length <= 20) {
    return match[1];
  }
  
  // Fallback: usa texto completo (truncado se necessário)
  return normalized.substring(0, 20);
}

/**
 * Extrai o título de uma série a partir do nome completo.
 * Ex: "EB354 - Tempo de Despertar" => "Tempo de Despertar"
 */
export function extractSeriesTitle(seriesName: string | null | undefined): string {
  if (!seriesName) return 'Sem Série';
  
  const trimmed = seriesName.trim();
  
  // Tenta extrair título após " - " (ex: "EB354 - Título")
  const dashIndex = trimmed.indexOf(' - ');
  if (dashIndex > 0 && dashIndex < trimmed.length - 3) {
    return trimmed.substring(dashIndex + 3).trim();
  }
  
  // Fallback: retorna texto completo
  return trimmed;
}
