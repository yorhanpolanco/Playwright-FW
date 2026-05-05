import { test, expect } from '../../../config/fixtures/index';
import { ConsultaRNCFlow } from '../../flows/portal/consultaRNC.flow';

const DATA_FILE = 'consultaRnc';

test.describe('Regression de consulta RNC', () => {
  
  test.beforeEach(async ({ consultaRNCPage }) => {
    await test.step('Given Usuario accede a la pagina de la DGII', async () => {
      await consultaRNCPage.goto();
    });
  });

  test('Usuario consulta rnc correctamente - "casoValidos"', { tag: ['@smoke', '@regression', '@first'] }, async ({ consultaRNCPage, worldData }) => {
    const flow = new ConsultaRNCFlow(consultaRNCPage);

    await test.step('Given Cargar datos del archivo "consultaRnc" para el caso "casoValidos"', async () => {
      await worldData.cargarDataFeature(DATA_FILE, 'casoValidos');
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

    await test.step('And El usuario deberia ver los "valoresEsperados" del rnc consultado', async () => {
      await consultaRNCPage.scrollHastaTabla(consultaRNCPage.respuesta, worldData.obtenerDataJson('valoresEsperados'));
      await expect(consultaRNCPage.respuesta).toHaveText(worldData.obtenerDataJson('valoresEsperados'));
    });
  });

  const casosFallidos = ['casoValidos_cedulaLarga', 'casoValidos_sinMatch'];

  for (const caso of casosFallidos) {
    test(`Usuario consulta rnc con data no valida - "${caso}"`, { tag: ['@fallidos'] }, async ({ consultaRNCPage, worldData }) => {
      const flow = new ConsultaRNCFlow(consultaRNCPage);

      await test.step(`Given Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
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

      await test.step('And El usuario deberia ver los "valoresEsperados" del rnc consultado', async () => {
        await consultaRNCPage.scrollHastaTabla(consultaRNCPage.respuesta, worldData.obtenerDataJson('valoresEsperados'));
        await expect(consultaRNCPage.respuesta).toHaveText(worldData.obtenerDataJson('valoresEsperados'));
      });
    });
  }
});
