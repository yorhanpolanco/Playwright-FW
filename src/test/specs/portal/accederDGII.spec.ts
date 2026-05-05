import { test, expect } from '../../../config/fixtures/index';

const DATA_FILE = 'consultaRnc';

const casos = ['casoValidos'];

test.describe('Acceder a DGII y consultar BD', () => {
  test.beforeEach(async ({ consultaRNCPage }) => {
    await test.step('Given Usuario accede a la pagina de la DGII', async () => {
      await consultaRNCPage.goto();
    });
  });

  for (const caso of casos) {
    test(`Usuario consulta rnc que obtuvo desde la BD correctamente - "${caso}"`, { tag: ['@regression'] }, async ({ consultaRNCPage, databaseService, worldData }) => {

      await test.step(`Given Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
      });

      await test.step('When El usuario despliega las opciones de herramientas para acceder a consulta RNC', async () => {
        await consultaRNCPage.cerrarAlerta();
        await consultaRNCPage.deplegarMenuHerramientas();
        await consultaRNCPage.accederConsultas();
        await consultaRNCPage.accederConsultaRNC();
      });

      await test.step('And Ejecutar "query" Oracle en "BD" usuario "usuario"', async () => {
        const result = await databaseService.executeOracleQuery('BD', 'usuario', 'query', worldData.dataJson);
        worldData.dataquery = result;
      });

      await test.step('And El usuario realiza una consulta utilizando el "rnc"', async () => {
        const rnc = worldData.dataquery && worldData.dataquery.length > 0
          ? worldData.obtenerDataQuery('RGE_RUC', 1)
          : worldData.obtenerDataJson('rnc');
        await consultaRNCPage.buscarPorRnc(rnc);
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
  }
});
