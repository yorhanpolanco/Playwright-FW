import { test, expect } from '../../../config/fixtures/index';

const DATA_FILE = 'pruebaEjecucionQuery';

const casos = [
  { caso: 'query1', BD: 'BD', usuario: 'usuario', consulta: 'query' },
];

test.describe('Ejecucion de sentencias en Oracle', () => {
  for (const { caso, BD, usuario, consulta } of casos) {
    test(`Ejecutar consulta Oracle - "${caso}"`, { tag: ['@EjecutarQuery'] }, async ({ databaseService, worldData }) => {

      await test.step(`Given Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
      });

      await test.step(`And Ejecutar "${consulta}" Oracle en "${BD}" usuario "${usuario}"`, async () => {
        const result = await databaseService.executeOracleQuery(BD, usuario, consulta, worldData.dataJson);
        worldData.dataquery = result;
      });

      await test.step('Then Mostrar resultado del query por consola', async () => {
        const resultado = worldData.obtenerDataQuery();
        if (Array.isArray(resultado)) {
          expect(resultado).toBeInstanceOf(Object);
          expect(Object.keys(resultado).length).toBeGreaterThan(0);
        }
        console.log('Resultado del query: ' + JSON.stringify(resultado));
      });
    });
  }
});
