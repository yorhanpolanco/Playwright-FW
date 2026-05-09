import { Options } from 'k6/options';

function percent(trans: number, p: number): number {
  return Math.ceil(trans * p);
}

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
 * Genera el objeto de opciones de k6 basado en el número de transacciones del escenario.
 * @param transacciones - Número de transacciones por minuto en carga alta.
 */
export function crearOpciones(transacciones: number): Options {
  const trans = transacciones;

  const allProfiles: Record<string, any> = {
    low:       create('carga_baja',  percent(trans, 0.01), 1,                     percent(trans, 0.01), '1m'),
    medium:    create('carga_media', percent(trans, 0.5),  percent(trans, 0.125), percent(trans, 0.5),  '30m', '1m'),
    high:      create('carga_alta',  trans,                percent(trans, 0.25),  trans,               '60m', '31m'),
    stress:    create('estres',      trans * 2,            percent(trans, 0.5),   trans * 2,           '60m', '91m'),
    endurance: create('resistencia', trans * 1.5,          percent(trans, 0.5),   trans * 1.5,         '12h', '151m'),
  };

  return {
    thresholds: {
      'http_req_duration': ['p(90)<500', 'p(95)<800', 'p(99)<1200'],
      'http_req_failed':   ['rate<0.005'],
      'checks':            ['rate>=0.995'],
      'checks{name:"Validar_status_code_200"}': ['rate==1.0']
    },
    //scenarios: allProfiles,
    scenarios: { low: allProfiles.low },
  };
}
