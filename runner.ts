import { spawnSync } from 'node:child_process';
import Logs from './src/config/logConfig';
import * as dotenv from 'dotenv';
import * as path from 'path';
import dayjs from 'dayjs';
import fs from 'node:fs';

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

function applyEnvVars(opts: Record<string, string>) {
    process.env.ENV = opts.env || 'dev';
    process.env.BROWSER = opts.browser || 'MultiBrowser';
    if (opts.folder) process.env.FOLDER = opts.folder;
    if (opts.tags) process.env.TAGS = opts.tags;
    if (opts.workers) process.env.WORKERS = opts.workers;
    if (opts.feature) process.env.FEATURE = opts.feature;
}

function buildTagArgs(tags: string): string[] {
    const rawTags = tags.replace(/^['"]|['"]$/g, '');
    const tagList = rawTags.split(',').map(t => t.trim()).filter(Boolean);
    return tagList.length === 1
        ? [`--grep=${tagList[0]}`]
        : [`--grep="${tagList.join('|')}"`];
}

function buildPlaywrightArgs(opts: Record<string, string>): string[] {
    const args = ['playwright', 'test'];
    if (opts.folder) args.push(opts.folder);
    if (opts.feature) args.push(opts.feature);
    if (opts.browser) args.push(`--project=${opts.browser}`);
    if (opts.tags) args.push(...buildTagArgs(opts.tags));
    if (opts.workers) args.push(`--workers=${opts.workers}`);
    return args;
}

function logRunOptions(opts: Record<string, string>) {
    console.log(`==> Ejecucion controlada por runner.ts`);
    if (opts.env) console.log(`    Entorno: ${opts.env}`);
    if (opts.browser) console.log(`    Navegador: ${opts.browser}`);
    if (opts.tags) console.log(`    Tags: ${opts.tags}`);
    if (opts.workers) console.log(`    Workers: ${opts.workers}`);
}

async function run() {
    const opts = parseArgs();

    applyEnvVars(opts);

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
    process.env.RUTA_LOGS = `logs/${nombre_report}-logs.txt`;

    await Logs.crearArchivoLogs(process.env.RUTA_LOGS);
    await Logs.imprimirCabecera();

    logRunOptions(opts);

    const npxCommand = /^win/.test(process.platform) ? 'npx.cmd' : 'npx';

    console.log('\n==> Iniciando ejecucion de Playwright...');
    const pwArgs = buildPlaywrightArgs(opts);
    const pwResult = spawnSync(npxCommand, pwArgs, { stdio: 'inherit', env: process.env, shell: true });

    if (pwResult.status !== null) {
        process.exit(pwResult.status);
    }
}

run();
