import { Options } from 'k6/options';
import { testData } from '../performance/loadData.ts';

const data  = testData;
const trans = data.transacciones;

function percent(p: number): number {
  return Math.ceil(trans * p);
}

/**
 * @description Crea un escenario de prueba con una tasa constante de llegada.
 * @param name     - Nombre del escenario.
 * @param rate     - Tasa de llegada por minuto.
 * @param pre      - VUs preasignados.
 * @param max      - VUs máximos.
 * @param duration - Duración del escenario.
 * @param start    - Tiempo de inicio relativo al inicio del test (e.g. '1m', '31m').
 */
function create(name: string, rate: number, pre: number, max: number, duration: string, start?: string): any {
  const s: any = {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1m',
    duration,
    preAllocatedVUs: pre,
    maxVUs: max,
    tags: { scenarioType: name }
  };
  if (start) s.startTime = start;
  return s;
}

/**
 * Todos los perfiles con startTime acumulados para ejecución secuencial:
 *   low       → 0    (duración 1m)
 *   medium    → 1m   (duración 30m)
 *   high      → 31m  (duración 60m)
 *   stress    → 91m  (duración 60m)
 *   endurance → 151m (duración 12h)
 *
 * Uso:
 *   k6 run script.js                          → ejecuta todos los perfiles
 *   k6 run script.js -e LOAD_PROFILE=low      → ejecuta solo el perfil indicado
 */
const allProfiles: Record<string, any> = {
  low:       create('carga_baja',  percent(0.01), 1,              percent(0.01), '1m'),
  medium:    create('carga_media', percent(0.5),  percent(0.125), percent(0.5),  '30m', '1m'),
  high:      create('carga_alta',  trans,          percent(0.25),  trans,         '60m', '31m'),
  stress:    create('estres',      trans * 2,      percent(0.5),   trans * 2,    '60m', '91m'),
  endurance: create('resistencia', trans * 1.5,    percent(0.5),   trans * 1.5,  '12h', '151m'),
};

export const options: Options = {
  thresholds: {
    'http_req_duration': ['p(90)<500', 'p(99)<1200'],
    'http_req_failed':   ['rate<0.01'],
    'checks':            ['rate>0.99'],
    'checks{name:"Validar status code"}': ['rate>0.99']
  },
  //scenarios: allProfiles,
  scenarios: { low: allProfiles.low },
};
