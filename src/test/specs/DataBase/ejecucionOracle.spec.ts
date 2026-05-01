import { test, expect } from '../../../config/fixtures/index';

test.describe('Ejecucion de sentencias en Oracle', () => {
  test('Ejecutar consulta de Oracle - "query1"', async ({ databaseService, worldData }) => {
    await test.step('Given Ejecutar "query" Oracle en "BD" usuario "usuario"', async () => {
      const result = await databaseService.executeOracleQuery('BD', 'usuario', 'query', worldData.dataJson);
      worldData.dataquery = result;
    });

    await test.step('Then Mostrar resultado del query por consola', async () => {
      const consulta = worldData.obtenerDataQuery();
      if (Array.isArray(consulta)) {
        expect(consulta).toBeInstanceOf(Object);
        expect(Object.keys(consulta).length).toBeGreaterThan(0);
      }
      console.log('Valor impreso desde desde ejemplo de reutilizacion ' + JSON.stringify(consulta));
    });
  });
});
