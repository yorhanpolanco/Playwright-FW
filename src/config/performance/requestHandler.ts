import http from 'k6/http';
import { check } from 'k6';
import { validarEstructura } from '../performance/validator.ts';
import { CaseData } from '../performance/loadData';

/**
 * @description - Envía una solicitud HTTP y valida la respuesta.
 * @param {Object} CaseData - Datos de prueba que incluyen el método, URL, cuerpo, parámetros y claves esperadas.
 * @returns - {Response} Respuesta del servidor después de enviar la solicitud.
 */
export function sendRequest(data: CaseData) {

  const payload = JSON.stringify(data.body);   
  const params  ={ headers: { ...data.params },timeout: '120s' };

  const res = http.request(data.metodo, data.url, payload, params );

  check(res, { 'Validar que el status code es 200': (r) => r.status === 200 });

  validarEstructura(res, data.keysEsperados);

  return res;
}
