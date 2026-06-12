import {ConnectionDetails} from '../DB/oracleConfig';

const FgRed = '\x1b[31m';
const Reset = '\x1b[0m';


  interface DBCredentials {
    [key: string]: {
      [key: string]: ConnectionDetails;
    };
  }
  
  /**
   * Definir el objeto DBCredentials
   */
  const DBCredentials: DBCredentials = {
    QASB: {
      USER: {
        user: 'USER',
        password: process.env.DB_PASSWORD_QASB_USER,
        connectionString: process.env.DB_CADENA_QASB
      },
      TRK: {
        user: 'USER',
        password: process.env.DB_PASSWORD_QASB_USER,
        connectionString: process.env.DB_CADENA_QASB
      }
    },
    qadb01: {
      USER: {
        user: 'USER',
        password: process.env.DB_PASSWORD_QADB01_USER,
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
      throw new Error(`${FgRed}${log}${Reset}`);
    }
  }
  