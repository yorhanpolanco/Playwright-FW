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

function validarTipo(value: any, schema: JsonSchema, label: string): string | null {
  if (schema.type === undefined) return null;
  const tipos = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!tipos.some(t => matchesType(value, t))) {
    return `"${label}": tipo esperado ${JSON.stringify(schema.type)}, recibido "${getJsonType(value)}"`;
  }
  return null;
}

function validarEnum(value: any, schema: JsonSchema, label: string): string | null {
  if (schema.enum === undefined) return null;
  if (!schema.enum.some((v: any) => v === value)) {
    return `"${label}": "${value}" no permitido. Valores válidos: [${schema.enum.join(', ')}]`;
  }
  return null;
}

function validarRequired(value: any, schema: JsonSchema, label: string): string[] {
  if (!schema.required) return [];
  return schema.required
    .filter(key => !(key in value))
    .map(key => `"${label}": campo requerido "${key}" ausente`);
}

function validarProperties(value: any, schema: JsonSchema, ruta: string): string[] {
  if (!schema.properties) return [];
  const label = ruta || 'root';
  const errores: string[] = [];

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

  return errores;
}

function validarObjeto(value: any, schema: JsonSchema, ruta: string): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const label = ruta || 'root';
  return [
    ...validarRequired(value, schema, label),
    ...validarProperties(value, schema, ruta),
  ];
}

function validarArray(value: any, schema: JsonSchema, ruta: string): string[] {
  if (!Array.isArray(value) || !schema.items) return [];
  const errores: string[] = [];
  for (let i = 0; i < value.length; i++) {
    errores.push(...validarValor(value[i], schema.items, ruta ? `${ruta}[${i}]` : `[${i}]`));
  }
  return errores;
}

function validarValor(value: any, schema: JsonSchema, ruta: string): string[] {
  const label = ruta || 'root';
  const tipoError = validarTipo(value, schema, label);
  if (tipoError) return [tipoError];

  const enumError = validarEnum(value, schema, label);
  return [
    ...(enumError ? [enumError] : []),
    ...validarObjeto(value, schema, ruta),
    ...validarArray(value, schema, ruta),
  ];
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
