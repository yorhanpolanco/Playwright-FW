import { sleep } from 'k6';
import { cargarEscenario } from '../../config/performance/loadData.ts';
import { sendRequest } from '../../config/performance/requestHandler.ts';
import { crearOpciones } from '../../config/performance/scenarioConfig.ts';

const DATA_FILE = __ENV.data_file || 'API/apiExample';
const SCENARIO_KEY = __ENV.scenario || 'escenario3';

const data = cargarEscenario(DATA_FILE, SCENARIO_KEY);

export const options = crearOpciones(data.transacciones ?? 100);

export default function () {
  sendRequest(data);
  sleep(Math.random() * 2 + 1);
}
