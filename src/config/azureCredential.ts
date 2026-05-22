import { DefaultAzureCredential, InteractiveBrowserCredential, useIdentityPlugin } from '@azure/identity';
import type { TokenCredential, AccessToken, GetTokenOptions } from '@azure/identity';
import { vsCodePlugin } from '@azure/identity-vscode';

useIdentityPlugin(vsCodePlugin);

const tenantId = process.env.AZURE_TENANT_ID || undefined;

const _default = new DefaultAzureCredential({ tenantId });
const _interactive = new InteractiveBrowserCredential({ tenantId });

export const azureCredential: TokenCredential = {
  async getToken(scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> {
    try {
      return await _default.getToken(scopes, options);
    } catch {
      if (process.env.CI) throw new Error('DefaultAzureCredential falló en CI. Verifique Managed Identity o la conexion del servicio.');
      return await _interactive.getToken(scopes, options);
    }
  },
};
