import { check } from 'k6';
import { Response } from 'k6/http';

type JsonSchemaType = string | string[];

type JsonSchema = {
  type?: JsonSchemaType;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: any[];
  format?: string;
};

// Patrones de ajv-formats (fast mode) — mirror exacto de los usados por AJV
const FORMAT_VALIDATORS: Record<string, RegExp> = {
  'date':          /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
  'time':          /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
  'date-time':     /^\d{4}-[0-1]\d-[0-3]\dT(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
  'email':         /^[a-z0-9.!#$%&'*+/=?^_`{}|~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
  'uuid':          /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
  'hostname':      /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
  'ipv4':          /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
  'ipv6':          /^(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,7}:|(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|:(?::[0-9a-f]{1,4}){1,7}|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1?\d)?\d)(?:\.(?:25[0-5]|(?:2[0-4]|1?\d)?\d)){3}|(?:[0-9a-f]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1?\d)?\d)(?:\.(?:25[0-5]|(?:2[0-4]|1?\d)?\d)){3})$/i,
  'uri':           /^[a-z][a-z0-9+\-.]*:(?:\/\/(?:[^\s/?#]*)?)?[^\s?#]*(?:\?[^\s#]*)?(?:#[^\s]*)?$/i,
  'uri-reference': /^(?:[a-z][a-z0-9+\-.]*:(?:\/\/(?:[^\s/?#]*)?)?)?[^\s?#]*(?:\?[^\s#]*)?(?:#[^\s]*)?$/i,
};

// Misma lógica que AJV: integer si value % 1 === 0, number para cualquier número
function getJsonType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return value % 1 === 0 ? 'integer' : 'number';
  return typeof value;
}

// number es superconjunto de integer, igual que JSON Schema
function matchesType(value: any, tipo: string): boolean {
  const actual = getJsonType(value);
  return actual === tipo || (tipo === 'number' && actual === 'integer');
}

function validarValor(value: any, schema: JsonSchema, ruta: string): string[] {
  const errores: string[] = [];
  const label = ruta || 'root';

  // type: string | string[] — union: válido si coincide con CUALQUIER tipo del array
  if (schema.type !== undefined) {
    const tipos = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!tipos.some(t => matchesType(value, t))) {
      const actual = getJsonType(value);
      errores.push(`"${label}": tipo esperado ${JSON.stringify(schema.type)}, recibido "${actual}"`);
      return errores;
    }
  }

  // format — solo aplica a strings, igual que AJV
  if (schema.format !== undefined && typeof value === 'string') {
    const regex = FORMAT_VALIDATORS[schema.format];
    if (regex && !regex.test(value)) {
      errores.push(`"${label}": formato "${schema.format}" inválido para "${value}"`);
    }
  }

  // enum
  if (schema.enum !== undefined) {
    if (!schema.enum.some((v: any) => v === value)) {
      errores.push(`"${label}": "${value}" no permitido. Valores válidos: [${schema.enum.join(', ')}]`);
    }
  }

  // object
  const esObjeto = typeof value === 'object' && value !== null && !Array.isArray(value);
  if (esObjeto) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errores.push(`"${label}": campo requerido "${key}" ausente`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          errores.push(...validarValor(value[key], propSchema, ruta ? `${ruta}.${key}` : key));
        }
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in (schema.properties as object))) {
            errores.push(`"${label}": propiedad adicional no permitida "${key}"`);
          }
        }
      }
    }
  }

  // array
  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      errores.push(...validarValor(value[i], schema.items, ruta ? `${ruta}[${i}]` : `[${i}]`));
    }
  }

  return errores;
}

/**
 * Valida el body del response contra un JSON Schema compatible con AJV.
 * Soporta: type (string | string[]), format, required, properties,
 * additionalProperties, items, enum. Compatible con el runtime de k6.
 */
export function validarEstructura(res: Response, schema: JsonSchema): void {
  const json = res.json();
  const errores = validarValor(json, schema, '');

  check(res, {
    'Validar estructura del response': () => {
      if (errores.length > 0) {
        console.error(`Errores de validación de esquema:\n${errores.join('\n')}`);
        return false;
      }
      return true;
    }
  });
}
