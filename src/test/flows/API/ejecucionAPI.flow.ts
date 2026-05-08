import { test, expect } from '../../../config/fixtures/index';
import ApiService from '../../../config/API/apiServices';
import  {WorldData}  from '../../../config/fixtures/worldData.fixture';
import { SchemaValidator } from '../../../config/API/apiSchemaValidator';

export class EjecucionAPIFlow {
    constructor(private apiService: ApiService, private worldData: WorldData) {}

    async ejecutarRequest(): Promise<void> {
        const result = await this.apiService.ejecutarRequest(this.worldData.dataJson.metodo, this.worldData.dataJson.urlBase, this.worldData.dataJson.endpoint, this.worldData.dataJson.header, this.worldData.dataJson.autorizacion, this.worldData.dataJson.payload);
        this.worldData.dataApiResponse = result;
    }

    validarEstructuraResponse(scenarioKey: string): void {
        if(!this.worldData.dataJson.schemaRef) {
            console.warn(`No se proporcionó una referencia de esquema para el escenario "${scenarioKey}". Validación de estructura omitida.`);
            return;
        }
        SchemaValidator.validate(this.worldData.dataJson.schemaRef, scenarioKey, this.worldData.dataApiResponse.body);
    }
}
