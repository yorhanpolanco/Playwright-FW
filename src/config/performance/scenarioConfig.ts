import { Options } from 'k6/options';
import { ScenarioData } from './loadData';

function percent(trans: number, p: number): number {
  return Math.ceil(trans * p);
}

function crearPerfil(name: string, rate: number, pre: number, max: number, duration: string, start?: string): any {
  const s: any = {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1m',
    duration,
    preAllocatedVUs: pre,
    maxVUs: max,
    tags: { scenarioType: name },
  };
  if (start) s.startTime = start;
  return s;
}

const THRESHOLDS_BASE = {
  'http_req_duration': ['p(90)<500', 'p(95)<800', 'p(99)<1200'],
  'http_req_failed':   ['rate<0.005'],
  'checks':            ['rate>=0.995'],
};

// Especificaciones de cada perfil: startMin es el minuto de inicio dentro del ciclo,
// durationMin es su duración. CICLO_TOTAL_MIN se calcula automáticamente a partir de aquí.
// Para activar o desactivar perfiles, comentar/descomentar las entradas del array.
const SPECS = [
  { key: 'low',       label: 'carga_baja',  rateFn: (t: number) => percent(t, 0.01), preFn: (_: number) => 1,               maxFn: (t: number) => percent(t, 0.01), duration: '1m',  startMin: 0   },
  // { key: 'medium',    label: 'carga_media', rateFn: (t: number) => percent(t, 0.5),  preFn: (t: number) => percent(t, 0.125), maxFn: (t: number) => percent(t, 0.5),  duration: '30m', startMin: 1   },
  // { key: 'high',      label: 'carga_alta',  rateFn: (t: number) => t,                preFn: (t: number) => percent(t, 0.25),  maxFn: (t: number) => t,                duration: '60m', startMin: 31  },
  // { key: 'stress',    label: 'estres',      rateFn: (t: number) => t * 2,            preFn: (t: number) => percent(t, 0.5),   maxFn: (t: number) => t * 2,            duration: '60m', startMin: 91  },
  // { key: 'endurance', label: 'resistencia', rateFn: (t: number) => t * 1.5,          preFn: (t: number) => percent(t, 0.5),   maxFn: (t: number) => t * 1.5,          duration: '12h', startMin: 151 },
] as const;

// Tiempo total del ciclo: startMin del último perfil + su duración en minutos.
// Se recalcula solo cuando se activan o desactivan perfiles en SPECS.
const CICLO_TOTAL_MIN = (() => {
  const last = SPECS[SPECS.length - 1];
  const durMin = parseInt(last.duration, 10) * (last.duration.endsWith('h') ? 60 : 1);
  return last.startMin + durMin;
})();

/**
 * Construye los perfiles de carga activos (definidos en SPECS) para un número de transacciones dado.
 * Los nombres de los k6 scenarios se prefijarán con `prefix_` cuando prefix sea no vacío,
 * y todos sus startTime se desplazarán por `offsetMin` minutos para ejecución secuencial.
 * Si se provee `env`, se inyecta en cada perfil (usado para CURRENT_SCENARIO en multi-escenario).
 */
function buildAllProfiles(
  trans: number,
  prefix: string,
  offsetMin: number,
  env?: Record<string, string>
): Record<string, any> {
  const name  = (n: string): string => prefix ? `${prefix}_${n}` : n;
  const start = (min: number): string | undefined => {
    const total = offsetMin + min;
    return total > 0 ? `${total}m` : undefined;
  };

  const profiles: Record<string, any> = {};
  for (const spec of SPECS) {
    const s = crearPerfil(spec.label, spec.rateFn(trans), spec.preFn(trans), spec.maxFn(trans), spec.duration, start(spec.startMin));
    if (env) s.env = env;
    profiles[name(spec.key)] = s;
  }

  return profiles;
}

/**
 * Genera opciones de k6 para un único escenario de datos.
 * @param transacciones - Transacciones por minuto en carga alta.
 */
export function crearOpciones(transacciones: number): Options {
  return {
    thresholds: {
      ...THRESHOLDS_BASE,
      'checks{name:"Validar_status_code_200"}': ['rate==1.0'],
    },
    scenarios: buildAllProfiles(transacciones, '', 0),
  };
}

/**
 * Genera opciones de k6 para múltiples escenarios de datos ejecutados de forma secuencial.
 * Cada key del JSON recibe el mismo set de perfiles (low → endurance) que crearOpciones,
 * desplazado en el tiempo para que los ciclos no se solapen.
 * El env.CURRENT_SCENARIO permite al default function despachar la request correcta por VU.
 *
 * @param scenarios - Mapa de clave → ScenarioData cargado desde el JSON de datos.
 */
export function crearOpcionesMultiples(scenarios: Record<string, ScenarioData>): Options {
  const allProfiles: Record<string, any> = {};
  let offsetMin = 0;

  for (const [key, data] of Object.entries(scenarios)) {
    const trans = data.transacciones ?? 100;
    Object.assign(allProfiles, buildAllProfiles(trans, key, offsetMin, { CURRENT_SCENARIO: key }));
    offsetMin += CICLO_TOTAL_MIN;
  }

  return {
    thresholds: {
      ...THRESHOLDS_BASE,
      'checks{name:"Validar_status_code_200"}': ['rate==1.0'],
    },
    scenarios: allProfiles,
  };
}
