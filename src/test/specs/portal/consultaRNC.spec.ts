import { test, expect } from '../../../config/fixtures/index';

const DATA_FILE = 'consultaRnc';

test.describe('Regression de consulta RNC', () => {
  test.beforeEach(async ({ consultaRNCPage }) => {
    await test.step('Given Usuario accede a la pagina de la DGII', async () => {
      await consultaRNCPage.goto();
    });
  });

  for (const caso of ['casoValidos']) {
    test(`Usuario consulta rnc correctamente - "${caso}"`, { tag: ['@smoke', '@regression', '@first'] }, async ({ consultaRNCPage, worldData }) => {
      await test.step(`Given Cargar datos del archivo "${DATA_FILE}" para el caso "${caso}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, caso);
      });

      await test.step('When El usuario despliega las opciones de herramientas para acceder a consulta RNC', async () => {
        await consultaRNCPage.cerrarAlerta();
        await consultaRNCPage.deplegarMenuHerramientas();
        await consultaRNCPage.accederConsultas();
        await consultaRNCPage.accederConsultaRNC();
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

      await test.step('And El usuario deberia ver los "valoresEsperados" del rnc consultado', async () => {
        await consultaRNCPage.scrollHastaTabla(consultaRNCPage.respuesta, worldData.obtenerDataJson('valoresEsperados'));
        await expect(consultaRNCPage.respuesta).toHaveText(worldData.obtenerDataJson('valoresEsperados'));
      });
    });
  }

  const casosFallidos = [
    { key: 'casoValidos2.rnc', label: 'casoValidos2.labelsEsperados', datos: 'casoValidos2.valoresEsperados' },
    { key: 'casoValidos2',     label: 'labelsEsperados',              datos: 'valoresEsperados' },
  ];

  for (const { key, label, datos } of casosFallidos) {
    test(`Usuario consulta rnc con data no valida - "${key}"`, { tag: ['@fallidos'] }, async ({ consultaRNCPage, worldData }) => {
      await test.step(`Given Cargar datos del archivo "${DATA_FILE}" para el caso "${key}"`, async () => {
        await worldData.cargarDataFeature(DATA_FILE, key);
      });

      await test.step('When El usuario despliega las opciones de herramientas para acceder a consulta RNC', async () => {
        await consultaRNCPage.cerrarAlerta();
        await consultaRNCPage.deplegarMenuHerramientas();
        await consultaRNCPage.accederConsultas();
        await consultaRNCPage.accederConsultaRNC();
      });

      await test.step('And El usuario realiza una consulta utilizando el "rnc"', async () => {
        const rnc = worldData.dataquery && worldData.dataquery.length > 0
          ? worldData.obtenerDataQuery('RGE_RUC', 1)
          : worldData.obtenerDataJson('rnc');
        await consultaRNCPage.buscarPorRnc(rnc);
      });

      await test.step(`Then El usuario deberia ver los "${label}" de la consulta`, async () => {
        await consultaRNCPage.scrollHastaTabla(consultaRNCPage.etiquetasTabla, worldData.obtenerDataJson(label));
        await expect(consultaRNCPage.etiquetasTabla).toHaveText(worldData.obtenerDataJson(label));
      });

      await test.step(`And El usuario deberia ver los "${datos}" del rnc consultado`, async () => {
        await consultaRNCPage.scrollHastaTabla(consultaRNCPage.respuesta, worldData.obtenerDataJson(datos));
        await expect(consultaRNCPage.respuesta).toHaveText(worldData.obtenerDataJson(datos));
      });
    });
  }
});
