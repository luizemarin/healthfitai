import { createHash, randomBytes } from 'node:crypto';

/**
 * Token do convite.
 *   - 32 bytes aleatórios (criptograficamente seguros) em base64url: 43 caracteres,
 *     seguro para ir na URL sem escape.
 *   - No banco vai só o SHA-256 em hex (64 caracteres). SHA-256 basta porque o
 *     token já é aleatório e longo; e permite achar o convite direto pelo hash.
 */
const TAMANHO_TOKEN_BYTES = 32;

export function gerarToken(): string {
  return randomBytes(TAMANHO_TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
