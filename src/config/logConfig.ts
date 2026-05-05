import fs from 'fs';

class Logs {
    static get workerTag(): string {
        return `[W${process.env.TEST_WORKER_INDEX || '?'}]`;
    }

    static #obtenerFechaYHoraActual(): string {
        return new Date().toLocaleString();
    }

    static async crearArchivoLogs(ruta: string): Promise<void> {
        if (!fs.existsSync(ruta)) {
            fs.writeFileSync(ruta, '', { flag: 'w' });
            console.log(`Se creo el archivo: ${ruta}`);
        }
    }

    static async #escribirEnLog(linea: string, color?: boolean | string): Promise<void> {
        const Reset   = '\x1b[0m';
        const FgGreen = '\x1b[32m';
        const FgRed   = '\x1b[31m';
        const rutaLogs = process.env.RUTA_LOGS;

        if (color === true) {
            console.log(`${FgGreen}${linea} ${Reset}`);
        } else if (color === false) {
            console.log(`${FgRed}${Logs.#obtenerFechaYHoraActual()} ${linea}${Reset}`);
        } else {
            linea = `${Logs.#obtenerFechaYHoraActual()} ${linea}`;
            console.log(linea);
        }

        if (rutaLogs) {
            try {
                await fs.promises.appendFile(rutaLogs, linea + '\n', 'utf8');
            } catch (error) {
                console.error('Error al escribir en el archivo:', error);
            }
        }
    }

    static async agregarLineaAlLogHeader(linea: string, color?: boolean | string): Promise<void> {
        await Logs.#escribirEnLog(linea, color);
    }

    static async agregarLineaAlLog(linea: string, color?: boolean): Promise<void> {
        await Logs.#escribirEnLog(`${Logs.workerTag} ${linea}`, typeof color === 'boolean' ? color : '');
    }

    static formantCabecera(cabecera: string): string {
        const caracter = '*';
        const maxCaracters = 74;
        if (cabecera) {
            const relleno = maxCaracters > cabecera.length ? maxCaracters - cabecera.length : 0;
            const inicio = Math.floor(relleno / 2);
            const fin = relleno - inicio;
            if (relleno > 0) {
                return `${caracter.repeat(inicio)} ${cabecera} ${caracter.repeat(fin)}`;
            }
            return cabecera;
        }
        return caracter.repeat(maxCaracters + 2);
    }

    static #obtenerParametros(): string[] {
        const variables: string[] = [];
        const environment = process.env.ENV;
        const featureName = process.env.FEATURE;
        const browserName = process.env.BROWSER;
        const folderName  = process.env.FOLDER;
        const tags        = process.env.TAGS;
        const paralelo    = process.env.PARALELO;

        if (browserName)  variables.push(`Browser => ${browserName}`);
        if (environment)  variables.push(`Env => ${environment}`);
        if (featureName)  variables.push(`Feature => ${featureName}`);
        if (folderName)   variables.push(`Folder => ${folderName}`);
        if (tags)         variables.push(`Tags => ${tags}`);
        if (paralelo)     variables.push(`paralelo => ${paralelo}`);

        return variables;
    }

    static #logoCabecera(): string {
        return `
         SSSSSSSSSSSSSSS BBBBBBBBBBBBBBBBB
         SS:::::::::::::::SB::::::::::::::::B
        S:::::SSSSSS::::::SB::::::BBBBBB:::::B
        S:::::S     SSSSSSSBB:::::B     B:::::B
        S:::::S              B::::B     B:::::B
        S:::::S              B::::B     B:::::B
         S::::SSSS           B::::BBBBBB:::::B
          SS::::::SSSSS      B:::::::::::::BB
            SSS::::::::SS    B::::BBBBBB:::::B
               SSSSSS::::S   B::::B     B:::::B
                    S:::::S  B::::B     B:::::B
                    S:::::S  B::::B     B:::::B
        SSSSSSS     S:::::SBB:::::BBBBBB::::::B
        S::::::SSSSSS:::::SB:::::::::::::::::B
        S:::::::::::::::SS B::::::::::::::::B
         SSSSSSSSSSSSSSS   BBBBBBBBBBBBBBBBB
        `;
    }

    static async imprimirCabecera(): Promise<void> {
        await Logs.#escribirEnLog(Logs.formantCabecera(''), true);
        await Logs.#escribirEnLog(Logs.formantCabecera(Logs.#logoCabecera()), true);
        await Logs.#escribirEnLog(Logs.formantCabecera(''), true);
        for (const param of Logs.#obtenerParametros()) {
            await Logs.#escribirEnLog(Logs.formantCabecera(param), true);
        }
    }
}

export default Logs;
