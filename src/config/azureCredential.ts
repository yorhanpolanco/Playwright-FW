import { 
  DefaultAzureCredential, 
  InteractiveBrowserCredential, 
  useIdentityPlugin, 
  AzurePipelinesCredential 
} from '@azure/identity';
import type { TokenCredential, AccessToken, GetTokenOptions } from '@azure/identity';
import Logs from '../config/logConfig';

if (!process.env.CI) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { vsCodePlugin } = require('@azure/identity-vscode');
    useIdentityPlugin(vsCodePlugin);
  void Logs.agregarLineaAlLog(`[Azure] Obteniendo credenciales desde VSC Azure Resource.`);
  } catch {
    // VS Code plugin no disponible
  }
}

let _pipelines: AzurePipelinesCredential | null = null;
let _default: DefaultAzureCredential | null = null;
let _interactive: InteractiveBrowserCredential | null = null;

const getTenantId = () => process.env.AZURE_TENANT_ID;

export const azureCredential: TokenCredential = {
  async getToken(scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken> {
    
    // ==========================================
    // FLUJO CI: Azure Pipelines
    // ==========================================
    if (process.env.CI) {
      if (!_pipelines) {
        const tenantId = getTenantId();
        const clientId = process.env.AZURE_CLIENT_ID;
        const svcConnId = process.env.AZURE_SERVICE_CONNECTION_ID;
        const sysToken = process.env.AZURE_SYSTEM_ACCESS_TOKEN;

        // Validación real, sin "as string"
        if (!tenantId || !clientId || !svcConnId || !sysToken) {
          throw new Error('[Auth CI] Faltan variables de entorno obligatorias para AzurePipelinesCredential.');
        }

          void Logs.agregarLineaAlLog(`[Azure] Obteniendo credenciales desde Azure Pipelines con tenantId=${tenantId}, clientId=${clientId}, svcConnId=${svcConnId} sysToken=${sysToken}`);

        _pipelines = new AzurePipelinesCredential(tenantId, clientId, svcConnId, sysToken);
      }

      try {
        return await _pipelines.getToken(scopes, options);
      } catch (error) {
        throw new Error(`[Auth CI] AzurePipelinesCredential falló. Verifica la conexión del servicio. Detalle: ${(error as Error).message}`);
      }
    }

    // ==========================================
    // FLUJO LOCAL: Default -> Interactive
    // ==========================================
    try {
      if (!_default) _default = new DefaultAzureCredential({ tenantId: getTenantId() });
      return await _default.getToken(scopes, options);
    } catch (defaultError) {
      
      try {
        if (!_interactive) _interactive = new InteractiveBrowserCredential({ tenantId: getTenantId() });
          void Logs.agregarLineaAlLog(`[Azure] Obteniendo credenciales desde el navegador.`);
        return await _interactive.getToken(scopes, options);
      } catch (interactiveError) {
         throw new Error(`[Auth Local] Autenticación fallida. 'Default' e 'Interactive' fallaron. Detalle: ${(interactiveError as Error).message}`);
      }
      
    }
  },
};