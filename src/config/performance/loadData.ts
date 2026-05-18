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

function parsearJson(contenido: string, nombreArchivo: string): Record<string, any> {
  try {
    return JSON.parse(contenido);
  } catch (e: any) {
    throw new Error(FgRed + `❌ JSON inválido en ${nombreArchivo}: ${e.message}` + Reset);
  }
}

/**
 * Carga un escenario específico del archivo de datos compartido con Playwright.
 * Utiliza open() para leer tanto el JSON de data como el JSON de schema (si aplica).
 * Debe llamarse en el scope de inicialización de k6 (nivel de módulo), no dentro de default function.
 *
 * @param dataFile    - Ruta relativa a src/test/data/API/ sin extensión (ej: "API/apiExample")
 * @param scenarioKey - Clave del escenario en el JSON (ej: "escenario3")
 */
export function cargarEscenario(dataFile: string, scenarioKey: string): ScenarioData {
  const dataContent = open(import.meta.resolve(`../../test/data/API/${dataFile}.json`));
  const parsed = parsearJson(dataContent, `${dataFile}.json`);

  const scenario = parsed[scenarioKey];
  if (!scenario) {
    throw new Error(FgRed + `❌ Escenario "${scenarioKey}" no encontrado en ${dataFile}.json` + Reset);
  }

  const data = replacePlaceholders(scenario) as ScenarioData;

  if (data.schemaRef) {
    const schemaContent = open(import.meta.resolve(`../../test/data/API/schemas/${data.schemaRef}.json`));
    data._schema = parsearJson(schemaContent, `schemas/${data.schemaRef}.json`)[scenarioKey];
  }

  return data;
}

/**
 * Carga todos los escenarios del archivo de datos en una sola pasada.
 * Pre-carga todos los schemas referenciados en el init context de k6 (open() sólo es válido aquí).
 * Retorna un mapa de clave → ScenarioData listo para usarse en el default function.
 *
 * @param dataFile - Ruta relativa a src/test/data/API/ sin extensión (ej: "API/apiExample")
 */
export function cargarTodosLosEscenarios(dataFile: string): Record<string, ScenarioData> {
  const dataContent = open(import.meta.resolve(`../../test/data/API/${dataFile}.json`));
  const parsed = parsearJson(dataContent, `${dataFile}.json`);

  // Pre-cargar schemas únicos referenciados; open() sólo puede llamarse en init context
  const schemaCache: Record<string, Record<string, any>> = {};
  for (const rawScenario of Object.values(parsed)) {
    const ref = (rawScenario as any).schemaRef as string | undefined;
    if (ref && !schemaCache[ref]) {
      const schemaContent = open(import.meta.resolve(`../../test/data/API/schemas/${ref}.json`));
      schemaCache[ref] = parsearJson(schemaContent, `schemas/${ref}.json`);
    }
  }

  const resultado: Record<string, ScenarioData> = {};
  for (const [key, rawScenario] of Object.entries(parsed)) {
    const data = replacePlaceholders(rawScenario) as ScenarioData;
    if (data.schemaRef && schemaCache[data.schemaRef]) {
      data._schema = schemaCache[data.schemaRef][key];
    }
    resultado[key] = data;
  }

  return resultado;
}
