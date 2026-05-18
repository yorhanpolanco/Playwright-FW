import { cargarEscenario, cargarTodosLosEscenarios } from '../../config/performance/loadData.ts';
import { asRateLimitData, tryAsRateLimitData, RateLimitData } from '../../config/performance/rateLimitTypes.ts';
import {
  crearOpcionesRateLimit,
  crearOpcionesMultiplesRateLimit,
} from '../../config/performance/rateLimitScenarioConfig.ts';
import { ejecutarFase } from '../../config/performance/rateLimitHandler.ts';

const DATA_FILE    = __ENV.data_file;
const SCENARIO_KEY = __ENV.scenario;

// --- Init context de k6: open() sólo puede llamarse aquí ---
const singleScenario: RateLimitData | null = SCENARIO_KEY
  ? asRateLimitData(cargarEscenario(DATA_FILE, SCENARIO_KEY), SCENARIO_KEY)
  : null;

const omitidos: string[] = [];

const allScenarios: Record<string, RateLimitData> | null = SCENARIO_KEY
  ? null
  : (() => {
      const raw = cargarTodosLosEscenarios(DATA_FILE);
      const result: Record<string, RateLimitData> = {};
      for (const [key, data] of Object.entries(raw)) {
        const rl = tryAsRateLimitData(data);
        if (rl) result[key] = rl;
        else omitidos.push(key);
      }
      return result;
    })();

export const options = allScenarios !== null
  ? crearOpcionesMultiplesRateLimit(allScenarios)
  : crearOpcionesRateLimit(SCENARIO_KEY as string, singleScenario!);

// setup() corre exactamente una vez en k6, a diferencia del init context que corre
// por VU. Es el único lugar seguro para emitir warnings de escenarios omitidos.
export function setup(): void {
  for (const key of omitidos) {
    console.warn(`⚠️  Escenario "${key}" omitido: no contiene rateLimit válido (peticionesPermitidas, statusRateLimit, retryAfterSegundos)`);
  }
}

export default function (): void {
  if (allScenarios !== null) {
    const key   = __ENV.CURRENT_SCENARIO;
    const found = allScenarios[key];
    if (!found) {
      console.error(`❌ CURRENT_SCENARIO inválido o no definido: "${key}"`);
      return;
    }
    ejecutarFase(found, __ITER);
    return;
  }

  ejecutarFase(singleScenario!, __ITER);
}
