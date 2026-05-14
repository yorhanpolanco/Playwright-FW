import { spawnSync } from 'child_process';
import Logs from './src/config/logConfig';
import * as dotenv from 'dotenv';
import * as path from 'path';
import dayjs from 'dayjs';
import fs from 'fs';

function parseArgs() {
    const args = process.argv.slice(2);
    const options: Record<string, string> = {
        // env default is omitted so playwright.config.ts falls back to its default if not passed
    };

    args.forEach(arg => {
        if (arg.includes('=')) {
            const [key, ...rest] = arg.split('=');
            options[key] = rest.join('=');
        }
    });

    return options;
}

async function run() {

    const opts = parseArgs();

    // Inyectar contexto para que playwright.config.ts y otros modulos (como reportes) lo lean
    if (opts.env) { process.env.ENV = opts.env } else { process.env.ENV = 'dev' };
    if (opts.folder) process.env.FOLDER = opts.folder;
    if (opts.browser) { process.env.BROWSER = opts.browser } else { process.env.BROWSER = 'MultiBrowser' };
    if (opts.tags) process.env.TAGS = opts.tags;
    if (opts.workers) process.env.WORKERS = opts.workers;
    if (opts.feature) process.env.FEATURE = opts.feature;

    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
    }

    const sanitize = (value?: string) =>
        value?.replace(/[^a-zA-Z0-9-_]/g, '');

    const fecha = dayjs().format('DD-MM-YYYY_HHmmss');
    const { ENV, BROWSER, FEATURE, FOLDER, TAGS } = process.env;

    const contexto =
        sanitize(FEATURE) ??
        sanitize(FOLDER) ??
        sanitize(TAGS?.replace(/@/g, '').replace(/,/g, '_'));

    const nombre_report = `${ENV}-${BROWSER}${contexto ? `-${contexto}` : ''}-${fecha}`;

    process.env.Report = nombre_report;

    const ruta = `logs/${nombre_report}-logs.txt`;

    process.env.RUTA_LOGS = ruta;

    await Logs.crearArchivoLogs(process.env.RUTA_LOGS);
    await Logs.imprimirCabecera();

    console.log(`==> Ejecucion controlada por runner.ts`);
    if (opts.env) console.log(`    Entorno: ${opts.env}`);
    if (opts.browser) console.log(`    Navegador: ${opts.browser}`);
    if (opts.tags) console.log(`    Tags: ${opts.tags}`);
    if (opts.workers) console.log(`    Workers: ${opts.workers}`);

    const npxCommand = /^win/.test(process.platform) ? 'npx.cmd' : 'npx';

    // Ejecutar Playwright
    console.log('\n==> Iniciando ejecucion de Playwright...');
    const pwArgs = ['playwright', 'test'];

    // Playwright soporta filtrar pasando cualquier parte de la ruta o nombre del archivo
    if (opts.folder) pwArgs.push(opts.folder);
    if (opts.feature) pwArgs.push(opts.feature);

    if (opts.browser) pwArgs.push(`--project=${opts.browser}`);
    if (opts.tags) {
        // Eliminar comillas externas si el shell las incluyó
        const rawTags = opts.tags.replace(/^['"]|['"]$/g, '');
        const tagList = rawTags.split(',').map(t => t.trim()).filter(Boolean);

        if (tagList.length === 1) {
            pwArgs.push(`--grep=${tagList[0]}`);
        } else {
            pwArgs.push(`--grep="${tagList.join('|')}"`);
        }
    }
    if (opts.workers) pwArgs.push(`--workers=${opts.workers}`);

    const pwResult = spawnSync(npxCommand, pwArgs, { stdio: 'inherit', env: process.env, shell: true });

    if (pwResult.status !== null) {
        process.exit(pwResult.status);
    }
}

run();
