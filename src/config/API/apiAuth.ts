import Logs from '../logConfig';
import { DefaultAzureCredential } from "@azure/identity";

let _credential: DefaultAzureCredential | null = null;

export interface ApiAuthConfig {
    [key: string]: {
        [key: string]: string | undefined;
    };
};

const ApiAuthDetails: ApiAuthConfig = {
    bearerToken: {
        token: process.env.API_QA_BEARER_TOKEN,
    },
    apiKeyDev: {
        key: "ApiKey",
        value: process.env.API_Key_DEV,
    },
};

export default function getAuthDetails(auth: string) {
    if (auth === undefined || auth === "") {
        Logs.agregarLineaAlLog(`No se especifico un Autorizacion`);
    }
    else if (ApiAuthDetails[auth]) {
      Logs.agregarLineaAlLog(`Se utilizarán las credenciales de autorización para API=${auth}`);
        return ApiAuthDetails[auth];
    } else {
        throw new Error(`${Logs.workerTag} Las credenciales de autorización para API=${auth} no fueron encontradas en el archivo ApiAuthConfig`);
    }
}

function getCredential(): DefaultAzureCredential {
  if (!_credential) {
    _credential = new DefaultAzureCredential();
  }
  return _credential;
}

export async function getAccessToken(scope: string): Promise<object> {
  if (!scope) return {};

  try {
    const tokenResponse = await getCredential().getToken(scope);

    if (!tokenResponse) {
      throw new Error(`${Logs.workerTag} La respuesta del token fue nula`);
    }else{
      Logs.agregarLineaAlLog(`Token obtenido exitosamente para el scope "${scope}".`);
    }

    return { Authorization: `Bearer ${tokenResponse.token}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${Logs.workerTag} No se pudo obtener el token de Azure para el scope "${scope}".\n` +
      `  Ejecución local : ejecute "az login" con la cuenta que tiene acceso al app registration.\n` +
      `  Pipeline        : verifique que el agente de Azure DevOps tiene la identidad administrada o la conexión de servicio configurada.\n` +
      `  Detalle         : ${detail}`
    );
  }
}
