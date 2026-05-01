import { APIRequestContext, APIResponse, request } from '@playwright/test';

export interface Header {
    [key: string]: string
}

class ApiSetting {
    private requestContext!: APIRequestContext;

    /** Inicializar nuevo contexto con la url Base para el request
     * @param baseURL - Url base para realizar el request
     */
    async init(baseURL: string) {
        this.requestContext = await request.newContext({
            baseURL: baseURL,
            ignoreHTTPSErrors: true,
        });
    }

    async get(endpoint: string, headers?: Header, data?: any): Promise<APIResponse> {
        return this.requestContext.get(endpoint, { data, headers });
    }

    async post(endpoint: string, headers?: Header, data?: any): Promise<APIResponse> {
        return this.requestContext.post(endpoint, { data, headers });
    }

    async put(endpoint: string, headers?: Header, data?: any): Promise<APIResponse> {
        return this.requestContext.put(endpoint, { data, headers });
    }

    async patch(endpoint: string, headers?: Header, data?: any): Promise<APIResponse> {
        return this.requestContext.patch(endpoint, { data, headers });
    }

    async delete(endpoint: string, headers?: Header): Promise<APIResponse> {
        return this.requestContext.delete(endpoint, { headers });
    }

    /** Liberar recursos utilizados por el request */
    async dispose() {
        await this.requestContext.dispose();
    }

    /** Funcion para convertir numeros de mas de 16 digitos a string
     *  la intencion es evitar el redondeo que realiza JSON.parse cuando el numero es muy grande
     * @param jsonText - json en formato texto
     * @returns - String con los numeros de mas de 16 digitos como string
     */
    async formatLargeNumbers(jsonText: string): Promise<string> {
        // Utiliza una expresión regular para encontrar números grandes en la cadena JSON
        return jsonText.replace(/(?<!")\b\d{16,}\b(?!")/g, '"$&"');
    }

    /** Función de orden superior que se utliza para invocar las funciones de los metodos
     * @param metodo - Tipo de metodo a ejecutar GET, POST, PUT, PATCH, DELETE
     * @returns - Response con la data del request
      */
    async ejecutarMetodo(metodo: string, url: string, endpoint: string, headers?: Header, data?: any): Promise<Object> {

        metodo = metodo.toLowerCase();

        const metodoMap: { [key: string]: Function } = {
            'get': this.get.bind(this),
            'post': this.post.bind(this),
            'put': this.put.bind(this),
            'patch': this.patch.bind(this),
            'delete': this.delete.bind(this),
        };

        if (!metodoMap.hasOwnProperty(metodo)) {
            throw new Error(`Metodo HTTP: '${metodo}' no soportado. Los métodos válidos son: ${Object.keys(metodoMap).join(', ')}.`);
        }

        await this.init(url);

        const metodoFunc = metodoMap[metodo];

        const response = await metodoFunc(endpoint, headers, data);

        const status = await response.status();
        const statusText = await response.statusText();
        const urlRequest = await response.url();
        const header = await response.headers();
        const jsonBody = await JSON.parse(await this.formatLargeNumbers(await response.text()));

        // Construir response con la data deseada
        const responseData = {
            status: status,
            statusText: statusText,
            urlRequest: urlRequest,
            headers: header,
            body: jsonBody,
        };

        await this.dispose();
        return responseData;
    }
}

export default ApiSetting;
