
/**
 * 
 * @param input - Recibe un objeto o una cadena que puede contener el marcador de posición % para buscar los valores en el .env.
 * @returns - Retorna el objeto o cadena con los marcadores de posición reemplazados por los valores del .env.
 */
export function replacePlaceholders(input: any): any {
  if (typeof input === 'string') {
    
    return input.replace(/%([^%]+)%/g, (_match, varName) => {
      const envVal = __ENV[varName];
      return envVal !== undefined ? envVal : _match;
    });
  }

  if (input === null || typeof input !== 'object') {

    return input;
  }

  if (Array.isArray(input)) {
    return input.map((el) => replacePlaceholders(el));
  }


  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = replacePlaceholders(value);
  }
  return output;
}
