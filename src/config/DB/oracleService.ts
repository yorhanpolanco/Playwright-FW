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

    if(!nombreBD || !usuario || !consulta){
      const campos = await Utilidades.obtenerVariablesVacias({nombreBD,usuario,consulta});
      throw new Error(`No se pudo ejecutar el query porque no fue agregado el valor de ${campos.join(',')}`);
    }

    if (dataJson && Object.keys(dataJson).length > 0) {
      await Utilidades.agregarLineaAlLog("Encontró data en la tabla de ejemplos del feature para conextarse a la BD");
      const jsonData = await dataJson;
      const BD=await jsonData[nombreBD];
      const usuarioBD=await jsonData[usuario];
      credenciales = await getCredentials(BD, usuarioBD);
      await Utilidades.agregarLineaAlLog(`Se ejecutará el query en la BD: ${BD} con el usuario: ${usuarioBD}`);
      query = await jsonData[consulta];
    } else {
      credenciales = await getCredentials(nombreBD, usuario);
      await Utilidades.agregarLineaAlLog(`Se ejecutará el query en la BD: ${nombreBD} con el usuario: ${usuario}`);
      query = await consulta;
    }

    const connectionDetails = {
      user: credenciales.user,
      password: credenciales.password || '',
      connectionString: credenciales.connectionString || ''
    };

    await Utilidades.agregarLineaAlLog("Cargó las credenciales correctamente");

    const result = await this.oracleDB.executeQuery(connectionDetails, query);
    return result;
  }

  async status(): Promise<boolean> {
    return this.oracleDB['connection'] !== undefined;
  }

  async close() {
    await this.oracleDB.closeConnection();
  }
}

export default DatabaseService;
