import ApiSetting, { Header } from '../API/apiConfig';
import getAuthDetails, {getAccessToken} from './apiAuth';
import { obtenerVariablesVacias, isValidUrl } from '../../utilidades/playwright-utilidades';
import Logs from '../logConfig';

class ApiService {
  private apiSetting: ApiSetting;

  constructor() {
    this.apiSetting = new ApiSetting();
  }

  async ejecutarRequest(metodo: string, url: string, endpoint: string, headers: string | Header, auth?: string, payload?: unknown): Promise<unknown> {
    if (!metodo || !url || !endpoint) {
      const campos = await obtenerVariablesVacias({ metodo, url, endpoint });
      throw new Error(`${Logs.workerTag} No se puede realizar el request porque no fue agregado el valor de ${campos.join(',')}`);
    }

    const parsedHeaders: Header = typeof headers === 'string'
      ? JSON.parse(headers)
      : (headers ?? {});

    const trimmedAuth = auth?.trim();
    const authHeader: Header = trimmedAuth
      ? isValidUrl(trimmedAuth)
        ? (await getAccessToken(trimmedAuth)) as Header
        : getAuthDetails(trimmedAuth) as Header
      : {};

    const headerSetting: Header = { ...parsedHeaders, ...authHeader };

    await Logs.agregarLineaAlLog(`Se ejecutará el metodo ${metodo} en ${url}${endpoint}`);

    const response = await this.apiSetting.ejecutarMetodo(metodo, url, endpoint, headerSetting, payload);
    return response;
  }


}

export default ApiService;
