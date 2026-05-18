/// <reference types="k6" />
import { sleep } from 'k6';
import { check } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { validarEstructura } from './validator.ts';
import { RateLimitData } from './rateLimitTypes.ts';

/**
 * Ejecuta la fase correspondiente al número de iteración del VU (__ITER, 0-indexed):
 *
 *   [0 .. N-1]  → dentro del límite   → valida statusEsperado (+ schema si aplica)
 *   [N]         → sobre el límite     → valida statusRateLimit
 *   [N+1]       → tras retry-after    → espera retryAfterSegundos, valida statusEsperado
 */
export function ejecutarFase(data: RateLimitData, iteracion: number): void {
  const { peticionesPermitidas, statusRateLimit, retryAfterSegundos } = data.rateLimit;
  const escenario = exec.scenario.name;

  const payload = data.payload ? JSON.stringify(data.payload) : null;
  const headers: Record<string, string> = { ...data.header };
  const token = __ENV.AZURE_TOKEN;
  if (token) headers['Authorization'] = token;

  const url    = data.urlBase + data.endpoint;
  const method = data.metodo.toUpperCase();

  if (iteracion === 0) {
    console.log(`\n▶ Iniciando escenario: ${escenario} | ${method} ${data.endpoint} | límite: ${peticionesPermitidas} req | retry-after: ${retryAfterSegundos}s`);
  }

  if (iteracion < peticionesPermitidas) {
    // Fase 1 — peticiones dentro del límite permitido
    // exec.vu.tags aplica el tag a TODAS las métricas del VU (HTTP + checks)
    exec.vu.metrics.tags['fase'] = 'dentro_limite';
    const res = http.request(method, url, payload, { headers, timeout: '30s' });
    check(res, {
      [`[${escenario}][dentro del límite #${iteracion + 1}] status ${data.statusEsperado}`]: (r) =>
        r.status === data.statusEsperado,
    });
    if (data._schema) validarEstructura(res, data._schema);

  } else if (iteracion === peticionesPermitidas) {
    // Fase 2 — petición N+1: debe devolver el status de rate limit
    exec.vu.metrics.tags['fase'] = 'sobre_limite';
    console.log(`⚡ [${escenario}] Enviando petición ${peticionesPermitidas + 1} (sobre el límite), esperando status ${statusRateLimit}...`);
    const res = http.request(method, url, payload, { headers, timeout: '30s' });
    check(res, {
      [`[${escenario}][sobre el límite] status ${statusRateLimit}`]: (r) => r.status === statusRateLimit,
    });

  } else {
    // Fase 3 — esperar retry-after y verificar que el servicio se recupera
    exec.vu.metrics.tags['fase'] = 'tras_retry_after';
    console.log(`⏳ [${escenario}] Esperando ${retryAfterSegundos}s (retry-after) antes de reintentar...`);
    sleep(retryAfterSegundos);
    const res = http.request(method, url, payload, { headers, timeout: '30s' });
    check(res, {
      [`[${escenario}][tras retry-after] status ${data.statusEsperado}`]: (r) =>
        r.status === data.statusEsperado,
    });
    if (data._schema) validarEstructura(res, data._schema);
  }
}
