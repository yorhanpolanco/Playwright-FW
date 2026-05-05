import { test, expect } from '../../../config/fixtures/index';

const DATA_FILE = 'apiExample';

const casos = [
  { caso: 'escenario1', metodo: 'get' },
  { caso: 'escenario3', metodo: 'post' },
];

test.describe('Ejecucion de Api', () => {
  for (const { caso, metodo } of casos) {
    test(`Ejecutar api - "${caso}"`, { tag: ['@smoke', '@regression', '@smokeApi'] }, async ({ apiService, worldData }) => {
      await test.step(`Given Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
      });

      await test.step(`And Ejecutar metodo "${metodo}" en "urlBase""ruta" con "cabecera", autorizacion "autorizacion" y data "datos"`, async () => {
        const result = await apiService.ejecutarRequest(worldData.dataJson, metodo, 'urlBase', 'ruta', 'cabecera', 'autorizacion', 'datos');
        worldData.dataApiResponse = result;
      });

      await test.step('Then Mostrar response del api que se ejecuto', async () => {
        console.log(worldData.obtenerDataApiResponse());
        expect(worldData.obtenerDataApiResponse('status')).toEqual(200);
      });
    });
  }
});
