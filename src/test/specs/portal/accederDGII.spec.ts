import { test, expect } from '../../../config/fixtures/index';
import { ConsultaRNCFlow } from '../../flows/portal/consultaRNC.flow';

const DATA_FILE = 'consultaRnc';

test.describe('Acceder a DGII y consultar BD', () => {
  test.beforeEach(async ({ consultaRNCPage }) => {
    await test.step('Given Usuario accede a la pagina de la DGII', async () => {
      await consultaRNCPage.goto();
    });
  });

  test('Usuario consulta rnc que obtuvo desde la BD correctamente - "casoValidos"', { tag: ['@regression'] }, async ({ consultaRNCPage, databaseService, worldData }) => {
    const flow = new ConsultaRNCFlow(consultaRNCPage);

    await test.step('Given Cargar datos del archivo "consultaRnc" para el caso "casoValidos"', async () => {
      await worldData.cargarDataFeature(DATA_FILE, 'casoValidos');
    });

    await test.step('And Ejecutar "query" Oracle en "BD" usuario "usuario"', async () => {
      const result = await databaseService.executeOracleQuery('BD', 'usuario', 'query', worldData.dataJson);
      worldData.dataquery = result;
    });

    await test.step('When El usuario navega a consulta RNC y busca por rnc', async () => {
      const rnc = worldData.dataquery.length > 0
        ? worldData.obtenerCeldaQuery('RGE_RUC', 1)
        : worldData.obtenerDataJson('rnc');
      await flow.consultarPorRnc(rnc);
    });

    await test.step('Then El usuario deberia ver los "labelsEsperados" de la consulta', async () => {
      await consultaRNCPage.scrollHastaTabla(consultaRNCPage.etiquetasTabla, worldData.obtenerDataJson('labelsEsperados'));
      await expect(consultaRNCPage.etiquetasTabla).toHaveText(worldData.obtenerDataJson('labelsEsperados'));
    });

    await test.step('And Mostrar resultado del query por consola', async () => {
      const resultado = worldData.obtenerDataQuery();
      if (Array.isArray(resultado)) {
        expect(resultado).toBeInstanceOf(Object);
        expect(Object.keys(resultado).length).toBeGreaterThan(0);
      }
      console.log('Resultado del query: ' + JSON.stringify(resultado));
    });
  });
});
