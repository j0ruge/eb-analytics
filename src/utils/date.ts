/**
 * Date utilities for parsing and formatting dates
 * Supports formats: YYYY-MM-DD and YYYY-MMM-DD (with PT-BR month abbreviations)
 */

// Mapeamento de meses em português do Brasil
const MONTHS_PT_BR = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
] as const;

const MONTH_TO_NUMBER: Record<string, number> = {
  "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4,
  "MAI": 5, "JUN": 6, "JUL": 7, "AGO": 8,
  "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12
};

/**
 * Valida se uma string está em formato de data aceito
 * @param input String a ser validada
 * @returns true se o formato é YYYY-MM-DD ou YYYY-MMM-DD
 */
export function isValidDateFormat(input: string): boolean {
  if (!input) return false;
  
  // Formato YYYY-MM-DD (numérico)
  const numericPattern = /^\d{4}-\d{2}-\d{2}$/;
  
  // Formato YYYY-MMM-DD (mês em texto PT-BR)
  const alphaPattern = /^\d{4}-(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)-\d{2}$/;
  
  return numericPattern.test(input) || alphaPattern.test(input);
}

/**
 * Parseia uma string de data nos formatos aceitos e retorna um objeto Date
 * @param input String no formato YYYY-MM-DD ou YYYY-MMM-DD
 * @returns Date object ou null se inválido
 */
export function parseInputDate(input: string): Date | null {
  if (!input || !isValidDateFormat(input)) {
    return null;
  }

  const parts = input.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const year = parseInt(parts[0], 10);
  const monthPart = parts[1];
  const day = parseInt(parts[2], 10);

  // Validar ano
  if (isNaN(year) || year < 1900 || year > 2100) {
    return null;
  }

  // Determinar mês (numérico ou alfabético)
  let month: number;
  if (/^\d{2}$/.test(monthPart)) {
    // Formato numérico (MM)
    month = parseInt(monthPart, 10);
  } else {
    // Formato alfabético (MMM)
    const monthNum = MONTH_TO_NUMBER[monthPart.toUpperCase()];
    if (!monthNum) {
      return null;
    }
    month = monthNum;
  }

  // Validar mês
  if (month < 1 || month > 12) {
    return null;
  }

  // Validar dia
  if (isNaN(day) || day < 1 || day > 31) {
    return null;
  }

  // Criar data (month - 1 porque Date usa 0-11 para meses)
  const date = new Date(year, month - 1, day);

  // Validar se a data é válida (ex: 30 de fevereiro retorna outra data)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Formata um objeto Date para o formato YYYY-MMM-DD (PT-BR)
 * @param date Objeto Date
 * @returns String formatada (ex: "2026-FEV-15")
 */
export function formatToYYYYMMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const day = date.getDate();

  const monthAbbr = MONTHS_PT_BR[month];
  const dayStr = day.toString().padStart(2, "0");

  return `${year}-${monthAbbr}-${dayStr}`;
}
