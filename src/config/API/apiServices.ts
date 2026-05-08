import ApiSetting, { Header } from '../API/apiConfig';
import getAuthDetails, {getAccessToken} from './apiAuth';
import { obtenerVariablesVacias } from '../../utilidades/playwright-utilidades';
import Logs from '../logConfig';

class ApiService {
  private apiSetting: ApiSetting;

  constructor() {
    this.apiSetting = new ApiSetting();
  }

  async ejecutarRequest(metodo: string, url: string, endpoint: string, headers: string, auth?: string, payload?: any): Promise<Object> {
    if (!metodo || !url || !endpoint) {
      const campos = await obtenerVariablesVacias({ metodo, url, endpoint });
      throw new Error(`${Logs.workerTag} No se puede realizar el request porque no fue agregado el valor de ${campos.join(',')}`);
    }

    const parsedHeaders = headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {};
    //const authHeader = auth ? await getAuthDetails(auth) as Header : {};
    const authHeader = auth ? await getAccessToken(auth) as Header : {};

    const headerSetting: Header = { ...parsedHeaders, ...authHeader };

    await Logs.agregarLineaAlLog(`Se ejecutará el metodo ${metodo} en ${url}${endpoint}`);

    const response = await this.apiSetting.ejecutarMetodo(metodo, url, endpoint, headerSetting, payload);
    return response;
  }


}

export default ApiService;
