/// <reference types="k6" />

import { SharedArray } from 'k6/data';
import { replacePlaceholders } from './replacePlaceHoldersPerf.ts';

/**
 * @typedef {Object} CaseData - Formato de datos de prueba para las solicitudes HTTP.
 * @property {string} metodo - El método HTTP a utilizar (GET, POST, etc.).
 * @property {string} url - La URL del endpoint a probar.
 * @property {any} [body] - El cuerpo de la solicitud (opcional).
 * @property {any} [params] - Parámetros adicionales para la solicitud (opcional).
 * @property {number} transacciones - Número de transacciones a realizar.
 * @property {string[]} keysEsperados - Claves esperadas en la respuesta.
 * @property {number} [expectedStatus] - Código de estado HTTP esperado (default: 200).
 */
export type CaseData = {
  metodo: string;
  urlBase: string;
  ruta: string;
  body?: any;
  params?: any;
  transacciones: number;
  keysEsperados: string[];
  expectedStatus?: number;
};

const FgRed = "\x1b[31m";
const Reset = "\x1b[0m";

const allCases = new SharedArray<CaseData>('caseData', (): CaseData[] => {
  const file = __ENV.data_file;
  console.warn(`*****************************La variable tiene el valor ${file}`);
  if (!file) throw new Error(FgRed + `

❌ Falta definir la variable de entorno data_file.

🧭 Qué hacer:
  1. Prepara un archivo JSON con los datos de prueba en la ruta "src/test/data/performanceData".
  2. Ejecuta este comando desde la raíz del proyecto:

     npm run perf data_file=<nombre_del_archivo>

✔️ Ejemplo:
     npm run perf data_file=performanceData

     ` + Reset);

  const content = open(`../../test/data/performanceData/${file}.json`);
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e: any) {
    throw new Error(`❌ El JSON en ${file}.json es invalido: ${e.message}`);
  }

  const arr = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return replacePlaceholders(arr) as CaseData[];
});

export const testData: CaseData = allCases[0];
