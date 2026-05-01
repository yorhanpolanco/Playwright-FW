import { Utilidades } from '../../utilidades/playwright-utilidades';

export interface ApiAuthDetails {
    [key: string]: {
        [key: string]: string | undefined;
    };
};

/**
 * Definir el objeto con las credenciales de Autorizacion
 * */
const ApiAuthDetails: ApiAuthDetails = {
    bearerToken: {
        token: process.env.API_QA_BEARER_TOKEN,
    },
    apiKeyDev: {
        key: "ApiKey",
        value: process.env.API_Key_DEV,
    },
};

/**
 * 
 * @param auth - tipo de Autorizacion
 * @returns - Retorna los detalles de autorización
 */
export default function getAuthDetails(auth: string) {
    if (auth === undefined || auth === "") {
        Utilidades.agregarLineaAlLog("No se especifico un Autorizacion");
    }
    else if (ApiAuthDetails[auth]) {
        return ApiAuthDetails[auth];
    } else {
        const log = `Las credenciales de autorización para API=${auth} no fueron encontradas en el archivo ApiAuthConfig`;
        throw new Error(log);
    }
}
