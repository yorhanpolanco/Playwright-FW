/// <reference types="k6" />
import { replacePlaceholders } from './replacePlaceHoldersPerf.ts';

export type ScenarioData = {
  metodo: string;
  urlBase: string;
  endpoint: string;
  header: Record<string, string>;
  autorizacion: string;
  payload?: any;
  statusEsperado: number;
  schemaRef?: string;
  transacciones: number;
  _schema?: Record<string, any>;
};

const FgRed = "\x1b[31m";
const Reset = "\x1b[0m";

/**
 * Carga un escenario específico del archivo de datos compartido con Playwright.
 * Utiliza open() para leer tanto el JSON de data como el JSON de schema (si aplica).
 * Debe llamarse en el scope de inicialización de k6 (nivel de módulo), no dentro de default function.
 *
 * @param dataFile   - Ruta relativa a src/test/data/API/ sin extensión (ej: "API/apiExample")
 * @param scenarioKey - Clave del escenario en el JSON (ej: "escenario3")
 */
export function cargarEscenario(dataFile: string, scenarioKey: string): ScenarioData {
  const dataContent = open(import.meta.resolve(`../../test/data/API/${dataFile}.json`));

  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(dataContent);
  } catch (e: any) {
    throw new Error(FgRed+`❌ JSON inválido en ${dataFile}.json: ${e.message}` +Reset);
  }

  const scenario = parsed[scenarioKey];
  if (!scenario) {
    throw new Error(FgRed+`❌ Escenario "${scenarioKey}" no encontrado en ${dataFile}.json` +Reset);
  }

  const data = replacePlaceholders(scenario) as ScenarioData;

  if (data.schemaRef) {
    const schemaContent = open(import.meta.resolve(`../../test/data/API/schemas/${data.schemaRef}.json`));
    const schemas = JSON.parse(schemaContent);
    data._schema = schemas[scenarioKey];
  }

  return data;
}
