import { test, expect } from '../../../config/fixtures/index';
import ApiService from '../../../config/API/apiServices';
import  {WorldData}  from '../../../config/fixtures/worldData.fixture';

export class ejecucionAPIFlow {
    constructor(private apiService: ApiService, private worldData:WorldData) {}

    async ejecutarRequest(): Promise<void> {
        const result = await this.apiService.ejecutarRequest(this.worldData.dataJson.metodo, this.worldData.dataJson.urlBase, this.worldData.dataJson.ruta, this.worldData.dataJson.cabecera, this.worldData.dataJson.autorizacion, this.worldData.dataJson.datos);
        this.worldData.dataApiResponse = result;
    }

    async consultarPorRnc(rnc: string): Promise<void> {

    }
}
