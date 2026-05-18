/// <reference types="k6" />
import { Options } from 'k6/options';
import { RateLimitConfig, RateLimitData } from './rateLimitTypes.ts';

const THRESHOLDS: Options['thresholds'] = {
  'http_req_duration':             ['p(90)<2000', 'p(95)<3000'],
  'checks{fase:dentro_limite}':    ['rate==1.0'],
  'checks{fase:sobre_limite}':     ['rate==1.0'],
  'checks{fase:tras_retry_after}': ['rate==1.0'],
};

/**
 * Tiempo realista de ejecución en segundos: se usa como startTime del siguiente escenario.
 * Asume ~2s por request (conservador pero realista) + retryAfter + 5s de margen.
 */
function tiempoEjecucionSeg(rl: RateLimitConfig): number {
  return (rl.peticionesPermitidas + 2) * 2 + rl.retryAfterSegundos + 5;
}

/**
 * Duración máxima de seguridad en segundos: techo absoluto para que k6 no cancele el escenario.
 * Asume ~5s por request + retryAfter + 30s de buffer.
 */
function maxDuracionSeg(rl: RateLimitConfig): number {
  return (rl.peticionesPermitidas + 2) * 5 + rl.retryAfterSegundos + 30;
}

function buildK6Scenario(
  key: string,
  rl: RateLimitConfig,
  startOffsetSeg: number,
): Record<string, any> {
  return {
    executor: 'shared-iterations',
    vus: 1,
    // N dentro del límite + 1 sobre el límite + 1 tras retry-after
    iterations: rl.peticionesPermitidas + 2,
    maxDuration: `${maxDuracionSeg(rl)}s`,
    env: { CURRENT_SCENARIO: key },
    ...(startOffsetSeg > 0 && { startTime: `${startOffsetSeg}s` }),
  };
}

/**
 * Genera las opciones de k6 para un único escenario de rate limit.
 */
export function crearOpcionesRateLimit(key: string, data: RateLimitData): Options {
  return {
    scenarios:  { rate_limit: buildK6Scenario(key, data.rateLimit, 0) },
    thresholds: THRESHOLDS,
  };
}

/**
 * Genera las opciones de k6 para múltiples escenarios de rate limit ejecutados de forma secuencial.
 * Cada escenario arranca tras la duración máxima estimada del anterior.
 */
export function crearOpcionesMultiplesRateLimit(
  scenarios: Record<string, RateLimitData>,
): Options {
  const k6Scenarios: Record<string, any> = {};
  let offsetSeg = 0;

  for (const [key, data] of Object.entries(scenarios)) {
    k6Scenarios[key] = buildK6Scenario(key, data.rateLimit, offsetSeg);
    offsetSeg += tiempoEjecucionSeg(data.rateLimit);
  }

  return {
    scenarios:  k6Scenarios,
    thresholds: THRESHOLDS,
  };
}
