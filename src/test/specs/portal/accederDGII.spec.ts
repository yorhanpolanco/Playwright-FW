import { test, expect } from '../../../config/fixtures/index';
import { consultaRNCPOM } from '../../pom/consultaRNC';

test.describe('Acceder a DGII y consultar BD', () => {
  let consultaRNC: consultaRNCPOM;

  test.beforeEach(async ({ page }) => {
    await test.step('Given Usuario accede a la pagina de la DGII', async () => {
      consultaRNC = new consultaRNCPOM(page);
      await consultaRNC.goto();
    });
  });

  test('Usuario consulta rnc que obtuvo desde la BD correctamente - "casoValidos"', { tag: ['@regression'] }, async ({ databaseService, worldData }) => {
    await test.step('When El usuario despliega las opciones de herramientas para acceder a consulta RNC', async () => {
      await consultaRNC.cerrarAlerta();
      await consultaRNC.deplegarMenuHerramientas();
      await consultaRNC.accederConsultas();
      await consultaRNC.accederConsultaRNC();
    });

    await test.step('And Ejecutar "query" Oracle en "BD" usuario "usuario"', async () => {
      const result = await databaseService.executeOracleQuery('BD', 'usuario', 'query', worldData.dataJson);
      worldData.dataquery = result;
    });

    await test.step('And El usuario realiza una consulta utilizando el "rnc"', async () => {
      const rnc = worldData.dataquery && worldData.dataquery.length > 0
        ? worldData.obtenerDataQuery('RGE_RUC', 1)
        : worldData.obtenerDataJson('rnc');
      await consultaRNC.buscarPorRnc(rnc);
    });

    await test.step('Then El usuario deberia ver los "labelsEsperados" de la consulta', async () => {
      await consultaRNC.scrollHastaTabla(consultaRNC.etiquetasTabla, worldData.obtenerDataJson('labelsEsperados'));
      await expect(consultaRNC.etiquetasTabla).toHaveText(worldData.obtenerDataJson('labelsEsperados'));
    });

    await test.step('And Mostrar resultado del query por consola', async () => {
      const consulta = worldData.obtenerDataQuery();
      if (Array.isArray(consulta)) {
        expect(consulta).toBeInstanceOf(Object);
        expect(Object.keys(consulta).length).toBeGreaterThan(0);
      }
      console.log('Valor impreso desde desde ejemplo de reutilizacion ' + JSON.stringify(consulta));
    });
  });
});
