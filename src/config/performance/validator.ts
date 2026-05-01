import { check } from 'k6';
import { Response } from 'k6/http';

type Esquema = Record<string, any>;

/**
 * @description - Obtiene un valor de un objeto por una ruta dada.
 * @param {Object} obj - El objeto del cual se quiere obtener el valor.
 * @param {string} path - La ruta al valor deseado, usando notación de puntos o corchetes.
 * @param {any} [defaultValue=undefined] - Valor por defecto a retornar si la ruta no existe.
 * @returns {any} - El valor encontrado en la ruta especificada o el valor por defecto.
 */
function getByPath(obj, path, defaultValue = undefined) {
  let parts = path
    .replace(/\[([^\[\]]+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  //console.log(`getByPath -> ruta: "${path}", partes:`, parts); // Debugging line para ver la ruta padre del json
  return parts.reduce((res, key) => {

    //console.log(`  Nivel actual:`, res, `▼ buscando clave: "${key}"`); // Debugging line para ver el nivel actual del json
    if (res != null && key in res) {

      //console.log(`    ✔ Encontrado "${key}" →`, res[key]); // Debugging line para ver el valor encontrado
      return res[key];
    }
    console.warn(`    ✘ Clave "${key}" NO existe`, defaultValue);
    console.warn(`    Ruta completa: "${path}"`); // Debugging line para ver la ruta completa
    console.warn(`    Json donde se esta intentando consultar ${path}: "${JSON.stringify(obj)}"`); // Debugging line para ver la ruta parcial
    return defaultValue;
  }, obj);
}

/**
 * @description - Obtiene el tipo de dato de un valor.
 * @param {any} value - El valor del cual se quiere obtener el tipo.
 * @returns {string} - El tipo de dato del valor.
 */
function obtenerTipo(value: any): string {
  if (Array.isArray(value)) return 'array';
  return typeof value;
}


/**
 * @description - Valida que una propiedad de un objeto tenga el tipo y la longitud mínima esperada.
 * @param {Object} obj - El objeto a validar.
 * @param {string} clave - La clave de la propiedad a validar.
 * @param {string[]} ruta - Ruta al valor dentro del objeto.
 * @param {Object} esquema - Esquema que define las expectativas de tipo y longitud mínima.
 */
function validarPropiedad(obj: any, clave: any, ruta: string[], esquema: any) {

  let rutaCompleta = ruta.join('.');
  let cantidadCaracteres = getByPath(esquema, `${rutaCompleta}.perfMinLength`);
  let tipoEsperado = getByPath(esquema, `${rutaCompleta}.perfType`);

  check(obj, {
    [`Validar que el key "${clave}" tiene el tipo de dato correcto`]: (j) => {

      let response = getByPath(j, rutaCompleta);
      let valor =(obtenerTipo(response) === tipoEsperado);
      if (!valor) {
        console.warn(`El tipo de dato de "${clave}" es "${obtenerTipo(response)}", pero se esperaba "${tipoEsperado}".`);
      }
      return valor;
    },
  })

  if (cantidadCaracteres > 0) {
    check(obj, {
      [`Validar que el key "${clave}" tiene la cantidad de caracteres esperados`]: (j) => {
        let response = typeof getByPath(j, rutaCompleta) === 'number' ? getByPath(j, rutaCompleta).toString() : getByPath(j, rutaCompleta);
        let valor = response.length >= cantidadCaracteres;
        if (!valor) {
          console.warn(`El key "${clave}" tiene ${response.length} caracteres, pero se esperaba al menos ${cantidadCaracteres}.`);
        }
        return valor;
      },
    });
  }
}

/**
 * @description - Valida la estructura de un objeto JSON contra un esquema esperado.
 * @param {Response} res - Respuesta del servidor que contiene el JSON a validar.
 * @param {Esquema} keysEsperados - Esquema que define las expectativas de tipo y longitud mínima.
 * @returns {boolean} - Retorna true si la validación es exitosa, false en caso contrario.
 */
export function validarEstructura(res: Response, keysEsperados: Esquema){

  let json = res.json();

  function recorrerEsquema(obj: any, esquema: any, ruta: string[] = []): void {

    for (const clave in esquema) {

      if (esquema[clave] && typeof esquema[clave] === 'object' && !Array.isArray(esquema[clave])) {

        if (Object.hasOwn(esquema[clave], "perfType") && Object.hasOwn(esquema[clave], "perfMinLength")) {

          validarPropiedad(json, clave, [...ruta, clave], keysEsperados /*esquema*/);

        } else if (Object.hasOwn(esquema[clave], "perfType")) {

          console.warn(`La propiedad "${clave}" no tiene definida la propiedad "perfMinLength".`);

        } else if (Object.hasOwn(esquema[clave], "perfMinLength")) {

          console.warn(`La propiedad "${clave}" no tiene definida la propiedad "perfType".`);

        } else {

          recorrerEsquema(obj[clave], esquema[clave], [...ruta, clave]);
          
        }
      } else if (Array.isArray(esquema[clave])) {

        esquema[clave].forEach((item: any, index: number) => {
          recorrerEsquema(obj[clave][index], item, [...ruta, clave, index.toString()]);

        });

      } else {
        console.warn(`La propiedad "${clave}" no es un objeto ni un array. Se omitirá la validación para esta clave.`);

      }
    }
  }

  recorrerEsquema(json, keysEsperados);
}
