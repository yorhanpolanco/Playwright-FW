import {ConnectionDetails} from '../DB/oracleConfig';


  interface DBCredentials {
    [key: string]: {
      [key: string]: ConnectionDetails;
    };
  }
  
  /**
   * Definir el objeto DBCredentials
   */
  const DBCredentials: DBCredentials = {
    qadgii: {
      taxchoc: {
        user: 'taxchoc',
        password: process.env.DB_PASSWORD_QADGII_TAXCHOC,
        connectionString: process.env.DB_CADENA_QADGII
      },
      TRK: {
        user: 'taxchoc',
        password: process.env.DB_PASSWORD_QADGII_TAXCHOC,
        connectionString: process.env.DB_CADENA_QADGII
      }
    },
    qadb01: {
      taxchoc: {
        user: 'taxchoc',
        password: process.env.DB_PASSWORD_QADB01_TAXCHOC,
        connectionString: process.env.DB_CADENA_QADB01
      }
    }
  };
  
  /**
   * 
   * @param BD - Base de datos donde se ejecutara el query
   * @param user - Usuario con el que se ejecutara el query
   * @returns - Retorna las credenciales de conexion
   */
  export function getCredentials(BD: string, user: string): ConnectionDetails {
    if (DBCredentials[BD] && DBCredentials[BD][user]) {
      return DBCredentials[BD][user];
    } else {
      const log=`Las credenciales BD=${BD} usuario=${user} no fueron encontradas en el archivo DBConnectionConfig`;
      throw new Error(log);
    }
  }
  