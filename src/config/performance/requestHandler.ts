import http from 'k6/http';
import { check } from 'k6';
import { validarEstructura } from '../performance/validator.ts';
import { ScenarioData } from '../performance/loadData';

/**
 * Envía una solicitud HTTP usando la estructura de datos compartida con Playwright
 * y valida el status code y la estructura del response contra el JSON Schema del escenario.
 */
export function sendRequest(data: ScenarioData) {
  const payload = data.payload ? JSON.stringify(data.payload) : null;
  const headers: Record<string, string> = { ...data.header };

  if (data.autorizacion) {
    headers['Authorization'] = data.autorizacion;
  }

  const params = { headers, timeout: '120s' };
  const res = http.request(data.metodo.toUpperCase(), data.urlBase + data.endpoint, payload, params);

  check(res, {
    'Validar status code': (r) => r.status === (data.statusEsperado ?? 200)
  });

  if (data._schema) {
    validarEstructura(res, data._schema);
  }

  return res;
}
