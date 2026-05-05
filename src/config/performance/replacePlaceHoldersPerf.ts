/// <reference types="k6" />

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

/**
 * Reemplaza marcadores de posición con formato %NOMBRE_VARIABLE% en un objeto JSON
 * usando los valores de las variables de ambiente de k6 (__ENV).
 *
 * Si la variable de ambiente no existe, el marcador se preserva sin cambios.
 *
 * @param input - Valor JSON arbitrario (objeto, arreglo, string, número, booleano o null)
 * @returns El mismo valor con todos los marcadores reemplazados por sus equivalentes en __ENV
 */
export function replacePlaceholders<T extends JsonValue>(input: T): T {
    if (typeof input === 'string') {
        return input.replace(/%([^%]+)%/g, (_match, varName: string) => {
            const envVal = __ENV[varName];
            return envVal !== undefined ? envVal : _match;
        }) as T;
    }

    if (input === null || typeof input !== 'object') {
        return input;
    }

    if (Array.isArray(input)) {
        return (input as JsonArray).map((el) => replacePlaceholders(el)) as T;
    }

    const output: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(input as JsonObject)) {
        output[key] = replacePlaceholders(value);
    }
    return output as T;
}
