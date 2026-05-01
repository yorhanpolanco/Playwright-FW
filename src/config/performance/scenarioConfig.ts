import { Options } from 'k6/options';
import { testData } from '../performance/loadData.ts';

const data = testData;
const trans = data.transacciones;

/**
 * 
 * @param p - Porcentaje de transacciones a calcular.
 * @description Esta función calcula el número de transacciones basado en un porcentaje dado.
 * @returns porcentaje de transacciones.
 * @example
 * percent(0.5) // Retorna el 50% de las transacciones totales.
 */
function percent(p: number): number {
  return Math.ceil(trans * p);
}

/**
 * @description - Crea opciones de configuración para los escenarios de carga.
 */
export const options: Options = {
  /**
   * @description - Configuracion de las validaciones de rendimiento.
   * @property {Object} thresholds - Define los umbrales de rendimiento para las métricas.
   * @property {string[]} thresholds.http_req_duration - Define los umbrales de duración de las solicitudes HTTP.
   * @property {string[]} thresholds.http_req_failed - Define los umbrales de solicitudes HTTP fallidas.
   * @property {string[]} thresholds.checks - Define los umbrales de validación de las respuestas.
   * @property {string[]} thresholds.checks{name:"Validar que el status code es 200"} - Define los umbrales de validación del código de estado HTTP.
   */
  thresholds: {
    'http_req_duration': ['p(90)<500', 'p(99)<1200'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
    'checks{name:"Validar que el status code es 200"}': ['rate>0.99']
  },
  scenarios: {
    carga_baja: create('carga_baja', percent(0.01), 1, percent(0.01),'1m'/*'7m'*/),
    /*arga_media: create('carga_media', percent(0.5), percent(0.125), percent(0.5),'30m' /*,'7m'),*/
    /*carga_alta: create('carga_alta', trans, percent(0.25), trans,'60m' ,'37m'),
    estres: create('estres', trans * 2, percent(0.5), trans * 2,'60m' ,'97m'),
    resistencia: create('resistencia', trans * 1.5, percent(0.5), trans * 1.5,'12h' ,'157m'),*/
  },
};


/**
 * @description Crea un escenario de prueba con una tasa constante de llegada.
 * @param {string} name - Nombre del escenario.
 * @param {number} rate - Tasa de llegada por minuto.
 * @param {number} pre - VUs preasignados.
 * @param {number} [max] - VUs máximos (opcional).
 * @param {string} [start] - Hora de inicio del escenario (opcional).
 * @returns {any} Objeto de configuración del escenario.
 */
function create(name: string, rate: number, pre: number, max: number, duration:string, start?: string): any {
  const s: any = {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1m',
    duration: duration,
    preAllocatedVUs: pre,
    maxVUs: max,
    tags: { scenarioType: name }
  };
  if (start) s.startTime = start;
  return s;
}
