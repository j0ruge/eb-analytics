/**
 * Remove pontos, traços e espaços do CPF
 * @param cpf - CPF formatado ou não (ex: "123.456.789-00" ou "12345678900")
 * @returns CPF limpo com apenas números
 */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/[\.\-\s]/g, '');
}

/**
 * Valida CPF usando o algoritmo oficial de dígitos verificadores
 * @param cpf - CPF a ser validado (pode estar formatado ou não)
 * @returns true se CPF é válido, false caso contrário
 */
export function validateCpf(cpf: string): boolean {
  const cleanCpf = normalizeCpf(cpf);

  // CPF deve ter exatamente 11 dígitos
  if (cleanCpf.length !== 11) {
    return false;
  }

  // CPF não pode ter todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCpf)) {
    return false;
  }

  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) {
    return false;
  }

  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) {
    return false;
  }

  return true;
}

/**
 * Formata CPF para exibição no padrão XXX.XXX.XXX-XX
 * Aceita tanto CPF limpo quanto já formatado.
 * Retorna o valor original se não contiver exatamente 11 dígitos.
 * @param cpf - CPF formatado ou não
 * @returns CPF formatado ou o valor original se inválido
 */
export function formatCpfDisplay(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
