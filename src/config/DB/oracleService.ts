import OracleDB, { ConnectionDetails } from '../DB/oracleConfig';
import { getCredentials } from '../DB/DBConnectionConfig'
import { Utilidades } from '../../utilidades/playwright-utilidades';

class DatabaseService {
  private oracleDB: OracleDB;

  constructor() {
    this.oracleDB = new OracleDB();
  }

  async executeOracleQuery(nombreBD: string, usuario: string, consulta: string, dataJson?: any): Promise<any> {
    let credenciales: ConnectionDetails;
    let query: string;

    if (!nombreBD || !usuario || !consulta) {
      const campos = await Utilidades.obtenerVariablesVacias({ nombreBD, usuario, consulta });
      throw new Error(`${Utilidades.workerTag} No se pudo ejecutar el query porque no fue agregado el valor de ${campos.join(',')}`);
    }

    if (dataJson && Object.keys(dataJson).length > 0) {
      await Utilidades.agregarLineaAlLog(`Encontró data en la tabla de ejemplos del feature para conextarse a la BD`);
      const jsonData = dataJson;
      const BD = jsonData[nombreBD];
      const usuarioBD = jsonData[usuario];
      credenciales = getCredentials(BD, usuarioBD);
      await Utilidades.agregarLineaAlLog(`Se ejecutará el query en la BD: ${BD} con el usuario: ${usuarioBD}`);
      query = jsonData[consulta];
    } else {
      credenciales = getCredentials(nombreBD, usuario);
      await Utilidades.agregarLineaAlLog(`Se ejecutará el query en la BD: ${nombreBD} con el usuario: ${usuario}`);
      query = consulta;
    }

    const connectionDetails = {
      user: credenciales.user,
      password: credenciales.password || '',
      connectionString: credenciales.connectionString || ''
    };

    await Utilidades.agregarLineaAlLog(`Cargó las credenciales correctamente`);

    const result = await this.oracleDB.executeQuery(connectionDetails, query);
    return result;
  }

  async status(): Promise<boolean> {
    return this.oracleDB.isConnected();
  }

  async close() {
    await this.oracleDB.closeConnection();
  }
}

export default DatabaseService;
