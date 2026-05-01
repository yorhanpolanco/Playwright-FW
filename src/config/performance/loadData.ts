import { SharedArray } from 'k6/data';
import { replacePlaceholders } from './replacePlaceholders.ts';

/**
 * @typedef {Object} CaseData - Formato de datos de prueba para las solicitudes HTTP.
 * @property {string} metodo - El método HTTP a utilizar (GET, POST, etc.).
 * @property {string} url - La URL del endpoint a probar.
 * @property {any} [body] - El cuerpo de la solicitud (opcional).
 * @property {any} [params] - Parámetros adicionales para la solicitud (opcional).
 * @property {number} transacciones - Número de transacciones a realizar.
 * @property {string[]} keysEsperados - Claves esperadas en la respuesta.
 */
export type CaseData = {
  metodo: string;
  url: string;
  body?: any;
  params?: any;
  transacciones: number;
  keysEsperados: string[];
};

const FgRed = "\x1b[31m";
const Reset = "\x1b[0m";

/**
 * @description - Carga los datos de prueba desde un archivo JSON.
 * @returns {CaseData[]} - Datos de prueba en formato Json.
 */
export const testData: CaseData = new SharedArray('caseData', () => {
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

     `+ Reset);
  const content = open(`../../test/data/performanceData/${file}.json`);

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`❌ El JSON en ${file}.json es invalido: ${e.message}`);
  }

  const arr = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return replacePlaceholders(arr) as CaseData[];
})[0];
