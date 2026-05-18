import { sleep } from 'k6';
import { randomBytes } from 'k6/crypto';
import { cargarEscenario, cargarTodosLosEscenarios, ScenarioData } from '../../config/performance/loadData.ts';
import { sendRequest } from '../../config/performance/requestHandler.ts';
import { crearOpciones, crearOpcionesMultiples } from '../../config/performance/scenarioConfig.ts';

const DATA_FILE    = __ENV.data_file;
const SCENARIO_KEY = __ENV.scenario;

// --- Init context de k6: open() sólo puede llamarse aquí ---
const singleScenario: ScenarioData | null = SCENARIO_KEY
  ? cargarEscenario(DATA_FILE, SCENARIO_KEY)
  : null;

const allScenarios: Record<string, ScenarioData> | null = SCENARIO_KEY
  ? null
  : cargarTodosLosEscenarios(DATA_FILE);

export const options = allScenarios
  ? crearOpcionesMultiples(allScenarios)
  : crearOpciones(singleScenario!.transacciones ?? 100);

export default function () {
  let data: ScenarioData;

  if (allScenarios !== null) {
    const key = __ENV.CURRENT_SCENARIO;
    const found = allScenarios[key];
    if (!found) {
      console.error(`❌ CURRENT_SCENARIO inválido o no definido: "${key}"`);
      return;
    }
    data = found;
  } else {
    data = singleScenario!;
  }

  sendRequest(data);
  const [byte] = new Uint8Array(randomBytes(1));
  sleep(1 + (byte / 255) * 2);
}
