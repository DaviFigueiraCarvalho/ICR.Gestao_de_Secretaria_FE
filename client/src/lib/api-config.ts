/**
 * Configuração da URL base da API ICR.
 *
 * O frontend SEMPRE chama o proxy Express local (/api/icr/*).
 * O Express encaminha para o container ICR definido por ICR_API_URL no servidor.
 *
 * Arquitetura:
 *   browser → /api/icr/* → Express proxy → ICR_API_URL (ex: http://icr-api:8080)
 *
 * Isso garante:
 *  - Sem CORS: o browser só fala com o Express
 *  - Service discovery Docker: Node.js resolve nomes de containers na rede interna
 */
export const API_BASE = '/api/icr';
