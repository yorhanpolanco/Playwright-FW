import ApiSetting, { Header } from '../API/apiConfig';
import getAuthDetails from '../API/apiAuth';
import { Utilidades } from '../../utilidades/playwright-utilidades';
import { join } from 'path';

class ApiService {
  private apiSetting: ApiSetting;

  constructor() {
    this.apiSetting = new ApiSetting();
  }

  async ejecutarRequest(dataJson: any, metodo: string, url: string, endpoint: string, headers: string, auth?: string, data?: any): Promise<any> {
    let headerSetting: Header;
    let urlApi;
    let endpointApi;
    let headersApi;
    let authApi;
    let dataApi;

    if (!metodo || !url || !endpoint) {
      const campos = await Utilidades.obtenerVariablesVacias({ metodo, url, endpoint });
      throw new Error(`No se puede realizar el request porque no fue agregado el valor de ${campos.join(',')}`);
    }


    if (dataJson && Object.keys(dataJson).length > 0) {

      await Utilidades.agregarLineaAlLog("Encontró data en la tabla de ejemplos del feature para ejecutar Api");

      const jsonData = await dataJson;
      urlApi = await jsonData[url];
      endpointApi = await jsonData[endpoint];
      headersApi = await jsonData[headers];
      authApi = auth ? await getAuthDetails(await jsonData[auth]) as Header : undefined;
      dataApi = data ? await jsonData[data] : undefined;
      headerSetting = { ...headersApi, ...authApi };
      await Utilidades.agregarLineaAlLog(`Se ejecutará el metodo ${metodo} en ${urlApi}${endpointApi}`);

    } else {

      urlApi = url;
      endpointApi = endpoint;
      headersApi = headers ? JSON.parse(headers) as Header : {};
      authApi = auth ? await getAuthDetails(auth) as Header : undefined;
      dataApi = data ? data : undefined;
      headerSetting = { ...headersApi, ...authApi };
      await Utilidades.agregarLineaAlLog(`Se ejecutará el metodo ${metodo} en ${urlApi}${endpointApi}`);
    }

    const response = await this.apiSetting.ejecutarMetodo(metodo, urlApi, endpointApi, headerSetting, dataApi);
    return response;

  }


}

export default ApiService;
