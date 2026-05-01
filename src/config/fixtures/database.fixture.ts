import DatabaseService from '../DB/oracleService';
import { Utilidades } from '../../utilidades/playwright-utilidades';

export type DatabaseFixture = {
    databaseService: DatabaseService;
};

export const databaseFixture = {
    databaseService: async ({ }: any, use: (r: DatabaseService) => Promise<void>) => {
        const db = new DatabaseService();
        await use(db);
        const isConnected = await db.status();
        if (isConnected) {
            await Utilidades.agregarLineaAlLog("Intentando cerrar conexion a la BD");
            await db.close();
        }
    }
};
