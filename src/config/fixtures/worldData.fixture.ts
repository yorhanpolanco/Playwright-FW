import fs from 'node:fs';
import path from 'path';
import { TestInfo } from '@playwright/test';
import Logs from '../logConfig';
import { replacePlaceholders } from '../../utilidades/playwright-utilidades';

export function obtenerCasosDeData(jsonFile: string): string[] {
    const filePath = path.resolve(__dirname, '../../test/data/', `${jsonFile}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`${Logs.FgRed}Archivo de data no encontrado: ${filePath}${Logs.Reset}`);
    }
    return Object.keys(
        JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    );
}

export type WorldData = {
    dataJson: { [key: string]: any };
    dataquery: Array<{ [key: string]: any }>;
    dataApiResponse: { [key: string]: any };
    obtenerDataJson: (key?: string) => any;
    obtenerDataQuery: () => Array<{ [key: string]: any }>;
    obtenerCeldaQuery: (columna: string, fila: number) => any;
    obtenerDataApiResponse: (key?: string) => any;
    cargarDataFeature: (jsonFile: string, objetoJson: string) => Promise<void>;
};

export type WorldDataFixture = {
    worldData: WorldData;
};

export const worldDataFixture = {
    worldData: async ({}: {}, use: (r: WorldData) => Promise<void>, testInfo: TestInfo) => {
        let internalDataJson:        { [key: string]: any }         = {};
        let internalDataquery:       Array<{ [key: string]: any }>  = [];
        let internalDataApiResponse: { [key: string]: any }         = {};

        const worldData: WorldData = {
            get dataJson()        { return internalDataJson; },
            set dataJson(val)     { internalDataJson = val; },
            get dataquery()       { return internalDataquery; },
            set dataquery(val)    { internalDataquery = val; },
            get dataApiResponse() { return internalDataApiResponse; },
            set dataApiResponse(val) { internalDataApiResponse = val; },

            obtenerDataJson: (key?: string) => {
                if (key) {
                    if (key in internalDataJson) {
                        return internalDataJson[key];
                    }
                    Logs.agregarLineaAlLog(`La llave '${key.toUpperCase()}' no existe en el archivo de data`, false);
                    return undefined;
                }
                return JSON.stringify(internalDataJson);
            },

            obtenerDataQuery: () => internalDataquery,

            obtenerCeldaQuery: (columna: string, fila: number): any => {
                const key = columna.toUpperCase();
                if (!internalDataquery || internalDataquery.length === 0) {
                    Logs.agregarLineaAlLog(`No hay resultados de query cargados`, false);
                    return undefined;
                }
                const row = internalDataquery[fila - 1];
                if (!row) {
                    Logs.agregarLineaAlLog(`La fila ${fila} no existe en el resultado del query`, false);
                    return undefined;
                }
                if (!(key in row)) {
                    Logs.agregarLineaAlLog(`La columna '${key}' no existe en el resultado del query`, false);
                    return undefined;
                }
                return row[key];
            },

            obtenerDataApiResponse: (key?: string) => {
                if (key) {
                    if (key in internalDataApiResponse) {
                        return internalDataApiResponse[key];
                    }
                    Logs.agregarLineaAlLog(`${key.toUpperCase()} no existe en el resultado del request del API`, false);
                    return undefined;
                }
                return JSON.stringify(internalDataApiResponse);
            },

            cargarDataFeature: async (jsonFile: string, objetoJson: string) => {
                const filePath = path.resolve(__dirname, '../../test/data/', `${jsonFile}.json`);
                if (fs.existsSync(filePath)) {
                    const log = Logs.formantCabecera(`Se encontró archivo Json con los datos para las pruebas`);
                    await Logs.agregarLineaAlLog(log, true);
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    internalDataJson = replacePlaceholders(JSON.parse(fileContent)[objetoJson]);

                    if (internalDataJson && Object.keys(internalDataJson).length > 0) {
                        const successLog = Logs.formantCabecera(`Se cargó archivo Json con los datos para las pruebas`);
                        await Logs.agregarLineaAlLog(successLog, true);
                    } else {
                        const errorLog = Logs.formantCabecera(`${Logs.workerTag} No se cargó data del Json a pesar de que el archivo existe, verifique el segundo key en el feature y en su archivo de data.`);
                        throw new Error(`${Logs.FgRed}${errorLog}${Logs.Reset}`);
                    }
                } else {
                    const warnLog = `==>No se encontró archivo Json con los datos para las pruebas<==`;
                    await Logs.agregarLineaAlLog(warnLog.toUpperCase());
                }
            }
        };

        await use(worldData);

        if (Object.keys(worldData.dataJson).length > 0) {
            const dataDePrueba = { "_DESCRIPCION": "DATA UTILIZADA EN LOS ESCENARIOS DE PRUEBA", ...worldData.dataJson };
            testInfo.attach('dataJson', {
                body: JSON.stringify(dataDePrueba, null, 2),
                contentType: 'application/json'
            });
        }

        if (Object.keys(worldData.dataApiResponse).length > 0) {
            testInfo.attach('dataApiResponse', {
                body: JSON.stringify(worldData.dataApiResponse, null, 2),
                contentType: 'application/json'
            });
        }
    }
};
