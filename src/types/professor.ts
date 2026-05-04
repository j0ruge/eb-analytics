export interface Professor {
  id: string;
  doc_id: string | null; // CPF limpo (11 dígitos) ou null para registros legados sincronizados
  name: string;
  created_at: string;
}
