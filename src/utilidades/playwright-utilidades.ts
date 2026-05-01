import { Page, BrowserContext, Browser } from '@playwright/test';
import Logs from '../config/logConfig'

export class Utilidades {

  /**
   * Esta funcion es la version typescript de {@link logConfig.Logs.agregarLineaAlLog}
    * @param linea - Texto que se mostrará en el log.
    * @param color - Variable booleana que si se envía true activa el color del texto en la consola.
   */
  static async agregarLineaAlLog(linea: string, color?: boolean) {
    if (typeof color === 'boolean') {
      await Logs.agregarLineaAlLog(linea, color);
    } else {
      await Logs.agregarLineaAlLog(linea, '');
    }
  }

  /**
   * Obtener el nombre de variables que estan vacias
   * @param variables variables que se desean validar en el formato {v1, v2, v3}
   * @returns Retorna una lista con el nombre de las variables que estan vacias
   */
  static async obtenerVariablesVacias(variables: { [key: string]: any }): Promise<string[]> {
    return Object.entries(variables)
      .filter(([_, valor]) => valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0))
      .map(([nombre]) => nombre);
  }

}