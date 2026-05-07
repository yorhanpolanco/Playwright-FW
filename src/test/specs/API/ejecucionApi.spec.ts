import { test, expect } from '../../../config/fixtures/index';
import {ejecucionAPIFlow} from '../../flows/API/ejecucionAPI.flow';

const DATA_FILE = 'API/apiExample';

const casos = ['escenario1','escenario3'];

test.describe('Ejecucion de Api', () => {
  
  for (const caso of casos) {
    test(`Ejecutar api - "${caso}"`, { tag: ['@smoke', '@regression', '@smokeApi'] }, async ({ apiService, worldData }) => {
      let flow= new ejecucionAPIFlow(apiService, worldData);


      await test.step(`Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
      });

      await test.step(`Ejecutar metodo "metodo" en "urlBase""ruta" con "cabecera", autorizacion "autorizacion" y data "datos"`, async () => {
        await flow.ejecutarRequest();
      });

      await test.step('Mostrar response del api que se ejecuto', async () => {
        console.log(worldData.obtenerDataApiResponse());
        expect(worldData.obtenerDataApiResponse('status')).toEqual(worldData.obtenerDataJson('statusEsperado'));
      });
    });
  }
});
