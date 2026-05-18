import { cargarEscenario, cargarTodosLosEscenarios } from '../../config/performance/loadData.ts';
import { asRateLimitData, RateLimitData } from '../../config/performance/rateLimitTypes.ts';
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

const allScenarios: Record<string, RateLimitData> | null = SCENARIO_KEY
  ? null
  : (() => {
      const raw = cargarTodosLosEscenarios(DATA_FILE);
      const result: Record<string, RateLimitData> = {};
      for (const [key, data] of Object.entries(raw)) {
        result[key] = asRateLimitData(data, key);
      }
      return result;
    })();

export const options = allScenarios
  ? crearOpcionesMultiplesRateLimit(allScenarios)
  : crearOpcionesRateLimit(SCENARIO_KEY as string, singleScenario!);

export default function (): void {
  let data: RateLimitData;

  if (allScenarios !== null) {
    const key   = __ENV.CURRENT_SCENARIO;
    const found = allScenarios[key];
    if (!found) {
      console.error(`❌ CURRENT_SCENARIO inválido o no definido: "${key}"`);
      return;
    }
    data = found;
  } else {
    data = singleScenario!;
  }

  ejecutarFase(data, __ITER);
}
