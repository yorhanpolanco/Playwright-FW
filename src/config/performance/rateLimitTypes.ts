/// <reference types="k6" />
import { ScenarioData } from './loadData.ts';

export type RateLimitConfig = {
  peticionesPermitidas: number; // requests permitidas antes de alcanzar el límite
  statusRateLimit: number;      // HTTP status esperado al superar el límite (ej: 429)
  retryAfterSegundos: number;   // segundos hasta que el límite se resetee
};

export type RateLimitData = ScenarioData & {
  rateLimit: RateLimitConfig;
};

const FgRed = '\x1b[31m';
const Reset = '\x1b[0m';

function hasValidRateLimit(d: RateLimitData): boolean {
  return (
    !!d.rateLimit                                        &&
    typeof d.rateLimit.peticionesPermitidas === 'number' &&
    typeof d.rateLimit.statusRateLimit      === 'number' &&
    typeof d.rateLimit.retryAfterSegundos   === 'number'
  );
}

/**
 * Castea y valida que un ScenarioData contenga la configuración de rate limit.
 * Falla en el init context de k6 si el campo rateLimit está ausente o mal tipado.
 */
export function asRateLimitData(data: ScenarioData, key: string): RateLimitData {
  const d = data as RateLimitData;
  if (!hasValidRateLimit(d)) {
    throw new Error(
      FgRed +
      `❌ Escenario "${key}" requiere el campo rateLimit con: ` +
      `peticionesPermitidas (number), statusRateLimit (number), retryAfterSegundos (number)` +
      Reset,
    );
  }
  return d;
}

/**
 * Igual que asRateLimitData pero devuelve null en vez de lanzar cuando rateLimit está
 * ausente o mal tipado. No emite ningún log; el caller decide cómo reportar los omitidos.
 */
export function tryAsRateLimitData(data: ScenarioData): RateLimitData | null {
  const d = data as RateLimitData;
  return hasValidRateLimit(d) ? d : null;
}
