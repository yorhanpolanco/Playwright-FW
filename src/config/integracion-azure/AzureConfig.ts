import type { AzureConfiguration } from './types/azure.types';
import Logs from '../logConfig';
import { azureCredential } from '../azureCredential';

const DEFAULT_AZURE_DEVOPS_SCOPE = 'https://app.vssps.visualstudio.com/.default';

const REQUIRED_VARS = [
  'AZURE_DEVOPS_ORG',
  'AZURE_DEVOPS_PROJECT',
  'AZURE_TESTPLAN_ID',
  'AZURE_TESTSUITE_ID',
] as const;

let _config: AzureConfiguration | null = null;
let _lastTokenExpiry: number | null = null;

export function loadAzureConfig(): AzureConfiguration {
  if (_config) return _config;

  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      Logs.FgRed + `[Azure] Faltan variables de entorno obligatorias: ${missing.join(', ')}\n` +
      `  Configure estas variables en su archivo .env o en las variables del pipeline.` + Logs.Reset,
    );
  }

  const scope = process.env.AZURE_DEVOPS_SCOPE ?? DEFAULT_AZURE_DEVOPS_SCOPE;

  _config = {
    org: process.env.AZURE_DEVOPS_ORG!,
    project: process.env.AZURE_DEVOPS_PROJECT!,
    getToken: async () => {
      try {
        const response = await azureCredential.getToken(scope);
        if (!response) throw new Error(`${Logs.FgRed}La respuesta del token fue nula${Logs.Reset}`);
        if (response.expiresOnTimestamp !== _lastTokenExpiry) {
          _lastTokenExpiry = response.expiresOnTimestamp;
          void Logs.agregarLineaAlLog(`[Azure] Nuevo token de Entra ID obtenido para Azure DevOps (scope: ${scope}, expira: ${new Date(response.expiresOnTimestamp).toISOString()}).`);
        }
        return response.token;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          Logs.FgRed + `[Azure] No se pudo obtener token de Entra ID para Azure DevOps (scope: ${scope}).\n` +
          `  Ejecución local    : ejecute "az login" con la cuenta que tiene acceso al proyecto.\n` +
          `  Pipeline           : verifique que el agente tiene la Managed Identity o las variables AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_CLIENT_SECRET configuradas.\n` +
          `  Detalle            : ${detail}` + Logs.Reset,
        );
      }
    },
    testPlanId: process.env.AZURE_TESTPLAN_ID!,
    testSuiteId: process.env.AZURE_TESTSUITE_ID!,
    apiVersion: process.env.AZURE_API_VERSION ?? '7.1',
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),
    enableBugCreation: (process.env.ENABLE_BUG_CREATION ?? 'true') !== 'false',
    enableTraceAttachments: (process.env.ENABLE_TRACE_ATTACHMENTS ?? 'true') !== 'false',
    tlsRejectUnauthorized: process.env.AZURE_TLS_REJECT_UNAUTHORIZED === 'true',
  };

  return _config;
}

export function isAzureConfigured(): boolean {
  return REQUIRED_VARS.every((v) => !!process.env[v]);
}

/**
 * Returns false when AZURE_DEVOPS_INTEGRATION_ENABLED is explicitly set to
 * "false", bypassing the entire integration without requiring var removal.
 * Any other value (including absent) is treated as enabled.
 */
export function isAzureIntegrationEnabled(): boolean {
  return process.env.AZURE_DEVOPS_INTEGRATION_ENABLED !== 'false';
}

export function resetAzureConfig(): void {
  _config = null;
}
