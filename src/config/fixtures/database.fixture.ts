import DatabaseService from '../DB/oracleService';
import Logs from '../logConfig';

export type DatabaseFixture = {
    databaseService: DatabaseService;
};

export const databaseFixture = {
    databaseService: async ({}: {}, use: (r: DatabaseService) => Promise<void>) => {
        const db = new DatabaseService();
        await use(db);
        const isConnected = await db.status();
        if (isConnected) {
            await Logs.agregarLineaAlLog(`Intentando cerrar conexion a la BD`);
            await db.close();
        }
    }
};
