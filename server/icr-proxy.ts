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

const isLoginPath = (path: string): boolean => path === "/api/v1/auth/login";

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
};

const parseNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};

const parseIdFromValue = (value: unknown): number | undefined => {
  const direct = parseNumberOrUndefined(value);
  if (typeof direct === 'number') return direct;

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      parseNumberOrUndefined(record.id) ??
      parseNumberOrUndefined(record.value) ??
      parseNumberOrUndefined(record.code)
    );
  }

  return undefined;
};

const parseIdFromRecord = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const parsed = parseIdFromValue(record[key]);
    if (typeof parsed === 'number') return parsed;
  }
  return undefined;
};

const parseStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const extractTokenFromLoginResponse = (payload: unknown, headers: Record<string, unknown>): string | undefined => {
  const headerAuth = headers.authorization ?? headers.Authorization;
  if (typeof headerAuth === 'string' && headerAuth.trim()) {
    return headerAuth.replace(/^Bearer\s+/i, '').trim();
  }

  const root = toRecord(payload);
  const dataNode = toRecord(root.data);
  const candidateSources = [root, dataNode];

  for (const source of candidateSources) {
    const rawToken =
      source.token ??
      source.accessToken ??
      source.access_token ??
      source.jwt ??
      source.authToken;

    if (typeof rawToken === 'string' && rawToken.trim()) {
      return rawToken.replace(/^Bearer\s+/i, '').trim();
    }
  }

  return undefined;
};

const extractLoginBaseUser = (payload: unknown): Record<string, unknown> => {
  const root = toRecord(payload);
  const dataNode = toRecord(root.data);

  if (Object.keys(dataNode).length > 0) return dataNode;
  if (Object.keys(root).length > 0) return root;
  return {};
};

const enrichLoginResponse = async (loginPayload: unknown, authToken: string, username?: string) => {
  const baseUser = extractLoginBaseUser(loginPayload);
  const resolvedUsername = parseStringOrUndefined(baseUser.username) ?? username;

  let memberId = parseIdFromRecord(baseUser, ['memberId', 'memberID', 'member_id', 'idMember', 'member']);
  let familyId = parseIdFromRecord(baseUser, ['familyId', 'familyID', 'family_id', 'family']);
  let churchId = parseIdFromRecord(baseUser, ['churchId', 'churchID', 'church_id', 'church']);
  let federationId = parseIdFromRecord(baseUser, ['federationId', 'federationID', 'federation_id', 'federation']);
  let memberName =
    parseStringOrUndefined(baseUser.memberName) ??
    parseStringOrUndefined(baseUser.churchMemberName) ??
    parseStringOrUndefined(baseUser.federationMemberName) ??
    parseStringOrUndefined(baseUser.name);

  if (resolvedUsername) {
    try {
      const userRolesResponse = await axios.get(
        `${ENV.icrApiUrl}/api/user-roles/users/by-username/${encodeURIComponent(resolvedUsername)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (userRolesResponse.status >= 200 && userRolesResponse.status < 300) {
        const userRoleRow = toRecord(userRolesResponse.data);
        memberId = parseIdFromRecord(userRoleRow, ['memberId', 'memberID', 'member_id', 'idMember', 'member']) ?? memberId;
        memberName =
          parseStringOrUndefined(userRoleRow.memberName) ??
          parseStringOrUndefined(userRoleRow.churchMemberName) ??
          parseStringOrUndefined(userRoleRow.federationMemberName) ??
          memberName;
      }
    } catch {
      /* ignore enrichment failure */
    }
  }

  if (typeof memberId === 'number') {
    try {
      const memberResponse = await axios.get(
        `${ENV.icrApiUrl}/api/members/${memberId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (memberResponse.status >= 200 && memberResponse.status < 300) {
        const memberRow = toRecord(memberResponse.data);
        familyId = parseIdFromRecord(memberRow, ['familyId', 'familyID', 'family_id', 'family']) ?? familyId;
        memberName =
          parseStringOrUndefined(memberRow.name) ??
          parseStringOrUndefined(memberRow.memberName) ??
          parseStringOrUndefined(memberRow.churchMemberName) ??
          parseStringOrUndefined(memberRow.federationMemberName) ??
          memberName;
      }
    } catch {
      /* ignore enrichment failure */
    }
  }

  if (typeof familyId === 'number') {
    try {
      const familyResponse = await axios.get(
        `${ENV.icrApiUrl}/api/families/${familyId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (familyResponse.status >= 200 && familyResponse.status < 300) {
        const familyRow = toRecord(familyResponse.data);
        churchId = parseIdFromRecord(familyRow, ['churchId', 'churchID', 'church_id', 'church']) ?? churchId;
      }
    } catch {
      /* ignore enrichment failure */
    }
  }

  if (typeof churchId === 'number' && typeof federationId !== 'number') {
    try {
      const churchResponse = await axios.get(
        `${ENV.icrApiUrl}/api/churches/${churchId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (churchResponse.status >= 200 && churchResponse.status < 300) {
        const churchRow = toRecord(churchResponse.data);
        federationId = parseIdFromRecord(churchRow, ['federationId', 'federationID', 'federation_id', 'federation']) ?? federationId;
      }
    } catch {
      /* ignore enrichment failure */
    }
  }

  return {
    ...toRecord(loginPayload),
    ...baseUser,
    username: resolvedUsername ?? parseStringOrUndefined(baseUser.username),
    memberId,
    familyId,
    churchId,
    federationId,
    memberName,
  };
};

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

    if (isLoginPath(targetPath) && apiResponse.status >= 200 && apiResponse.status < 300) {
      const authToken = extractTokenFromLoginResponse(apiResponse.data, apiResponse.headers as Record<string, unknown>);
      if (authToken) {
        const enrichedLoginResponse = await enrichLoginResponse(apiResponse.data, authToken, parseStringOrUndefined((req.body as Record<string, unknown> | undefined)?.username));
        res.status(apiResponse.status).json(enrichedLoginResponse);
        return;
      }
    }

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
