import fs from 'fs';
import path from 'path';
import { Utilidades } from '../../utilidades/playwright-utilidades';
import Logs from '../logConfig';

export type WorldData = {
    dataJson: { [key: string]: any };
    dataquery?: Array<{ [key: string]: any }>;
    dataApiResponse: { [key: string]: any };
    obtenerDataJson: (key?: string) => any;
    obtenerDataQuery: (key?: string | number, fila?: number) => any;
    obtenerDataApiResponse: (key?: string) => any;
    cargarDataFeature: (jsonFile: string, objetoJson: string) => Promise<void>;
};

export type WorldDataFixture = {
    worldData: WorldData;
};

export const worldDataFixture = {
    worldData: async ({ }: any, use: (r: WorldData) => Promise<void>, testInfo: any) => {
        let internalDataJson: { [key: string]: any } = {};
        let internalDataquery: Array<{ [key: string]: any }> = [];
        let internalDataApiResponse: { [key: string]: any } = {};

        const worldData: WorldData = {
            get dataJson() { return internalDataJson; },
            set dataJson(val) { internalDataJson = val; },
            get dataquery() { return internalDataquery; },
            set dataquery(val) { internalDataquery = val; },
            get dataApiResponse() { return internalDataApiResponse; },
            set dataApiResponse(val) { internalDataApiResponse = val; },

            obtenerDataJson: (key?: string) => {
                if (key) {
                    if (key in internalDataJson) {
                        return internalDataJson[key];
                    } else {
                        Utilidades.agregarLineaAlLog(`La llave '${key.toUpperCase()}' no existe en el archivo de data`, false);
                        return undefined;
                    }
                } else {
                    return JSON.stringify(internalDataJson);
                }
            },

            obtenerDataQuery: (key?: string | number, fila?: number): any => {
                let actualKey: string | undefined = typeof key === 'string' ? key.toUpperCase() : undefined;
                let actualFila: number | undefined = fila;

                if (typeof key === 'number' && fila) {
                    Utilidades.agregarLineaAlLog(`El primer valor de la funcion obtenerDataQuery debe ser un string y actualmente es un numero(${key})`, false);
                    return undefined;
                } else if (typeof key === 'number') {
                    actualFila = key;
                    actualKey = undefined;
                }

                if (actualFila) {
                    if (actualKey) {
                        if (internalDataquery && internalDataquery.length > 0 && internalDataquery[0][actualKey]) {
                            return internalDataquery.map(item => item[actualKey as string])[actualFila - 1];
                        } else {
                            Utilidades.agregarLineaAlLog(`${actualKey} no existe en el resultado del query`, false);
                        }
                    } else {
                        return internalDataquery ? internalDataquery[actualFila - 1] : internalDataquery;
                    }
                } else {
                    if (actualKey) {
                        if (internalDataquery && internalDataquery.length > 0 && internalDataquery[0][actualKey]) {
                            return internalDataquery.map(item => item[actualKey as string]);
                        } else {
                            Utilidades.agregarLineaAlLog(`${actualKey} no existe en el resultado del query`, false);
                        }
                    } else {
                        return internalDataquery;
                    }
                }
            },

            obtenerDataApiResponse: (key?: string) => {
                if (key) {
                    if (internalDataApiResponse[key]) {
                        return internalDataApiResponse[key];
                    } else {
                        Utilidades.agregarLineaAlLog(`${key.toUpperCase()} no existe en el resultado del request del API`, false);
                    }
                } else {
                    return JSON.stringify(internalDataApiResponse);
                }
            },

            cargarDataFeature: async (jsonFile: string, objetoJson: string) => {
                const filePath = path.resolve(__dirname, '../../test/data/', jsonFile);
                if (fs.existsSync(filePath)) {
                    const log = Logs.formantCabecera('Se encontró archivo Json con los datos para las pruebas');
                    await Utilidades.agregarLineaAlLog(log, true);
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    internalDataJson = JSON.parse(fileContent)[objetoJson];

                    if (internalDataJson && Object.keys(internalDataJson).length > 0) {
                        const successLog = Logs.formantCabecera('Se cargó archivo Json con los datos para las pruebas');
                        await Utilidades.agregarLineaAlLog(successLog, true);
                    } else {
                        const errorLog = Logs.formantCabecera('No se cargó data del Json a pesar de que el archivo existe, verifique el segundo key en el feature y en su archivo de data.');
                        throw new Error(errorLog);
                    }
                } else {
                    const warnLog = '==>No se encontró archivo Json con los datos para las pruebas, la prueba se ejecutará con los datos en la tabla de example<==';
                    await Logs.formantCabecera('_');
                    await Utilidades.agregarLineaAlLog(warnLog.toUpperCase());
                    await Logs.formantCabecera('_');
                }
            }
        };

        // Se eliminó la cabecera quemada (FEATURE: Unknown) ya que delegamos
        // esta responsabilidad a CustomReporter.ts para evitar duplicidades
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
