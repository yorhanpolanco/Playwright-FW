import { test, expect } from '../../../config/fixtures/index';
import { EjecucionAPIFlow } from '../../flows/API/ejecucionAPI.flow';
import { obtenerCasosDeData } from '../../../config/fixtures/worldData.fixture';

const DATA_FILE = 'API/apiExample';

const casos =obtenerCasosDeData(DATA_FILE);

test.describe('Ejecucion de Api', () => {
  
  for (const caso of casos) {
    test(`Ejecutar api - "${caso}"`, { tag: ['@smoke', '@regression', '@smokeApi'] }, async ({ apiService, worldData }) => {
      const flow = new EjecucionAPIFlow(apiService, worldData);


      await test.step(`Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
      });

      await test.step(`Ejecutar metodo "metodo" en "urlBase""endpoint" con "header", autorizacion "autorizacion" y data "payload"`, async () => {
        await flow.ejecutarRequest();
      });

      await test.step('Mostrar response del api que se ejecuto', async () => {
        console.log(worldData.obtenerDataApiResponse());
        expect(worldData.obtenerDataApiResponse('status')).toEqual(worldData.obtenerDataJson('statusEsperado'));
        flow.validarEstructuraResponse(caso);

      });
    });
  }
});
