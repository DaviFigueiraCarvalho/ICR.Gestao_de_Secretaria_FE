/**
 * Proxy reverso para a API ICR
 *
 * Todas as chamadas do frontend para /api/icr/* são encaminhadas para
 * o container da API ICR na mesma rede Docker (ICR_API_URL).
 *
 * Benefícios:
 *  - Sem problemas de CORS: o browser fala apenas com o Express
 *  - Service discovery Docker: o Node.js resolve "http://icr-api:8080"
 *    pelo nome do serviço na rede interna, sem expor a URL ao cliente
 *  - Centralização: trocar a URL da API exige apenas mudar ICR_API_URL
 */

import { Router, Request, Response } from "express";
import axios, { AxiosRequestConfig, AxiosError } from "axios";
import { ENV } from "./_core/env";

export const icrProxyRouter = Router();

// Prefixo que o frontend usa para chamar a API ICR via este proxy
const PROXY_PREFIX = "/api/icr";

icrProxyRouter.all(`${PROXY_PREFIX}/*`, async (req: Request, res: Response) => {
  // Remove o prefixo /api/icr e repassa o restante para a API real
  const targetPath = req.path.replace(PROXY_PREFIX, "");
  const targetUrl = `${ENV.icrApiUrl}${targetPath}`;

  // Repassa query string
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  console.log(`🔄 [ICR Proxy] ${req.method} ${req.path} -> ${fullUrl}`);
  console.log(`🔄 [ICR Proxy] ICR_API_URL: ${ENV.icrApiUrl}`);

  // Monta os headers — repassa Authorization se existir, remove headers de host
  const forwardHeaders: Record<string, string> = {
    "Content-Type": req.headers["content-type"] ?? "application/json",
  };
  if (req.headers["authorization"]) {
    forwardHeaders["Authorization"] = req.headers["authorization"] as string;
    console.log(`🔄 [ICR Proxy] Forwarding Authorization header`);
  }

  const config: AxiosRequestConfig = {
  method: req.method as AxiosRequestConfig["method"],
  url: fullUrl,
  headers: forwardHeaders,
  // Garante que o body seja enviado corretamente
  data: req.method !== 'GET' ? req.body : undefined, 
  validateStatus: () => true,
  timeout: 60000, // Aumentado para 60s para operações pesadas de DB
};

  try {
    const apiResponse = await axios(config);

    console.log(`🔄 [ICR Proxy] Response status: ${apiResponse.status} ${apiResponse.statusText}`);
    console.log(`🔄 [ICR Proxy] Response headers:`, apiResponse.headers);

    // Repassa o status e o body da API para o frontend
    res.status(apiResponse.status).json(apiResponse.data);
  } catch (err) {
    const axiosErr = err as AxiosError;
    console.error(`❌ [ICR Proxy] Erro ao chamar ${fullUrl}:`, axiosErr.message);
    console.error(`❌ [ICR Proxy] Error details:`, axiosErr.response?.status, axiosErr.response?.statusText);

    if (axiosErr.code === "ECONNREFUSED" || axiosErr.code === "ENOTFOUND") {
      console.error(`❌ [ICR Proxy] Container ICR indisponível: ${ENV.icrApiUrl}`);
      res.status(503).json({
        error: "API ICR indisponível",
        detail: `Não foi possível conectar a ${ENV.icrApiUrl}. Verifique se o container está rodando e se ICR_API_URL está correto.`,
        icrApiUrl: ENV.icrApiUrl,
      });
    } else {
      console.error(`❌ [ICR Proxy] Erro interno:`, axiosErr.message);
      res.status(500).json({
        error: "Erro interno no proxy",
        detail: axiosErr.message,
      });
    }
  }
});
