import type { AzureConfiguration } from './types/azure.types';

const REQUIRED_VARS = [
  'AZURE_DEVOPS_ORG',
  'AZURE_DEVOPS_PROJECT',
  'AZURE_DEVOPS_PAT',
  'AZURE_TESTPLAN_ID',
  'AZURE_TESTSUITE_ID',
] as const;

let _config: AzureConfiguration | null = null;

export function loadAzureConfig(): AzureConfiguration {
  if (_config) return _config;

  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `[Azure] Faltan variables de entorno obligatorias: ${missing.join(', ')}\n` +
      `  Configure estas variables en su archivo .env o en las variables del pipeline.`,
    );
  }

  _config = {
    org: process.env.AZURE_DEVOPS_ORG!,
    project: process.env.AZURE_DEVOPS_PROJECT!,
    pat: process.env.AZURE_DEVOPS_PAT!,
    testPlanId: process.env.AZURE_TESTPLAN_ID!,
    testSuiteId: process.env.AZURE_TESTSUITE_ID!,
    apiVersion: process.env.AZURE_API_VERSION ?? '7.1',
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),
    enableBugCreation: (process.env.ENABLE_BUG_CREATION ?? 'true') !== 'false',
    flakyThreshold: parseInt(process.env.FLAKY_THRESHOLD ?? '3', 10),
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
