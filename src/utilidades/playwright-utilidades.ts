type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

export async function obtenerVariablesVacias(variables: { [key: string]: any }): Promise<string[]> {
    return Object.entries(variables)
        .filter(([_, valor]) => valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0))
        .map(([nombre]) => nombre);
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reemplaza marcadores de posición con formato %NOMBRE_VARIABLE% en un objeto JSON
 * usando los valores de las variables de ambiente (process.env).
 *
 * Si la variable de ambiente no existe, el marcador se preserva sin cambios.
 */
export function replacePlaceholders<T extends JsonValue>(input: T): T {
    if (typeof input === 'string') {
        return input.replace(/%([^%]+)%/g, (_match, varName: string) => {
            return process.env[varName] ?? _match;
        }) as T;
    }

    if (input === null || typeof input !== 'object') {
        return input;
    }

    if (Array.isArray(input)) {
        return (input as JsonArray).map((el) => replacePlaceholders(el)) as T;
    }

    return Object.fromEntries(
        Object.entries(input as JsonObject).map(([key, value]) => [key, replacePlaceholders(value)])
    ) as T;
}
