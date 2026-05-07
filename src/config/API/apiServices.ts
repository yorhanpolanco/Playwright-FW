import ApiSetting, { Header } from '../API/apiConfig';
import { getAccessToken } from '../API/defaultAzureCredential';
import getAuthDetails from './apiAuth';
import { obtenerVariablesVacias } from '../../utilidades/playwright-utilidades';
import Logs from '../logConfig';

class ApiService {
  private apiSetting: ApiSetting;

  constructor() {
    this.apiSetting = new ApiSetting();
  }

  async ejecutarRequest(metodo: string, url: string, endpoint: string, headers: string, auth?: string, data?: any): Promise<Object> {
    let headerSetting: Header;
    let urlApi;
    let endpointApi;
    let headersApi;
    let authApi;
    let dataApi;
    let metodoApi;

    if (!metodo || !url || !endpoint) {
      const campos = await obtenerVariablesVacias({ metodo, url, endpoint });
      throw new Error(`${Logs.workerTag} No se puede realizar el request porque no fue agregado el valor de ${campos.join(',')}`);
    }

    urlApi = url;
    endpointApi = endpoint;
    headersApi = headers? (typeof headers === 'string' ? JSON.parse(headers) : headers): {};
    authApi = auth ? await getAuthDetails(auth) as Header : undefined;
    dataApi = data ? data : undefined;
    metodoApi = metodo;
    headerSetting = { ...headersApi, ...authApi };
    await Logs.agregarLineaAlLog(`Se ejecutará el metodo ${metodoApi} en ${urlApi}${endpointApi}`);

    const response = await this.apiSetting.ejecutarMetodo(metodoApi, urlApi, endpointApi, headerSetting, dataApi);
    return response;

  }


}

export default ApiService;
