import Logs from '../logConfig';

export interface ApiAuthDetails {
    [key: string]: {
        [key: string]: string | undefined;
    };
};

const ApiAuthDetails: ApiAuthDetails = {
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
        return ApiAuthDetails[auth];
    } else {
        throw new Error(`${Logs.workerTag} Las credenciales de autorización para API=${auth} no fueron encontradas en el archivo ApiAuthConfig`);
    }
}
