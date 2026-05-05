import oracledb from 'oracledb';
import Logs from '../logConfig';

export interface ConnectionDetails {
  user: string;
  password?: string;
  connectionString?: string;
}

class OracleDB {
  private connection?: oracledb.Connection;
  private connectionDetails?: ConnectionDetails;

  isConnected(): boolean {
    return this.connection !== undefined;
  }

  async connect(connectionDetails: ConnectionDetails): Promise<void> {
    try {
      this.connection = await oracledb.getConnection(connectionDetails);
      this.connectionDetails = connectionDetails;
      await Logs.agregarLineaAlLog(`Conexion a BD con usuario: ${connectionDetails.user} exitosa!`);
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`${Logs.workerTag} Error conentandose a la BD con usuario: ${connectionDetails.user} ${err.message}`);
      } else {
        throw new Error(`${Logs.workerTag} Error conentandose a laBD con usuario: ${connectionDetails.user}`);
      }
    }
  }

  async executeQuery(connectionDetails: ConnectionDetails, query: string): Promise<any> {
    if (!this.connection) {
      await this.connect(connectionDetails);
    } else if (this.connectionDetails && (
      this.connectionDetails.user !== connectionDetails.user ||
      this.connectionDetails.password !== connectionDetails.password ||
      this.connectionDetails.connectionString !== connectionDetails.connectionString
    )) {
      await this.closeConnection();
      await this.connect(connectionDetails);
    }

    if (this.connection) {
      try {
        const result = await this.connection.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (result.rows && result.rows.length === 0) {
          await Logs.agregarLineaAlLog(`Query ejecutado pero no retorno informacion!`, false);
        } else {
          await Logs.agregarLineaAlLog(`Query ejecutado corrrectamente!`);
        }
        return result.rows;
      } catch (err) {
        if (err instanceof Error) {
          throw new Error(`${Logs.workerTag} Error ejecutando query: ${err.message}`);
        } else {
          throw new Error(`${Logs.workerTag} Error desconocido ejecutando query`);
        }
      }
    } else {
      throw new Error(`${Logs.workerTag} No hay una conexion a BD activa!`);
    }
  }

  async closeConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = undefined;
        await Logs.agregarLineaAlLog(`Conexion a BD cerrada exitosamente!`);
      } catch (err) {
        throw new Error(`${Logs.workerTag} Error cerrando conexion a BD : ${err} `);
      }
    } else {
      throw new Error(`${Logs.workerTag} No hay conexion de BD abierta que cerrar.`);
    }
  }
}

export default OracleDB;
