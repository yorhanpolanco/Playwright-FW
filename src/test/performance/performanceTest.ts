import { sleep } from 'k6';
import { testData } from '../../config/performance/loadData.ts';
import { sendRequest } from '../../config/performance/requestHandler.ts';


export { options } from '../../config/performance/scenarioConfig.ts';

/**
 * @description - Función principal que se ejecuta en cada iteración del test de rendimiento.
 * @example
 * Esta función envía una solicitud y duerme por un tiempo aleatorio entre 1 y 3 segundos.
 */
export default function () {
  const data = testData;
  sendRequest(data);
  sleep(Math.random() * 2 + 1);
}
