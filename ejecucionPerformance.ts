import { execSync } from 'child_process';
import fs from 'fs';
import dayjs from 'dayjs';
import Logs from './src/config/logConfig';

interface Argumentos {
  dataFile?: string;
  scenario?: string;
  env: string;
}

const fecha = dayjs().format('DD-MM-YYYY_HHmmss');

function extraerArgumentos(): Argumentos {
  const resultado: Partial<Argumentos> = {};

  for (const arg of process.argv.slice(2)) {
    const separador = arg.indexOf('=');
    if (separador === -1) continue;
    const key   = arg.slice(0, separador);
    const value = arg.slice(separador + 1);

    switch (key) {
      case 'data_file': resultado.dataFile = value; break;
      case 'scenario':  resultado.scenario  = value; break;
      case 'env':       resultado.env       = value; break;
    }
  }

  const env = resultado.env ?? process.env.ENV;
  if (!env) {
    throw new Error('Debes proveer el argumento env=<entorno>');
  }

  return { ...resultado, env };
}

function configurarAmbiente(env: string): void {
  process.loadEnvFile(`.env.${env}`);
}

async function ejecutar(): Promise<void> {
  const args = extraerArgumentos();

  configurarAmbiente(args.env);
  process.env.ENV = args.env;

  await Logs.imprimirCabecera();

  fs.mkdirSync('reports/K6-report', { recursive: true });

  const k6EnvVars: string[] = [];
  if (args.dataFile) k6EnvVars.push(`-e data_file=${args.dataFile}`);
  if (args.scenario) k6EnvVars.push(`-e scenario=${args.scenario}`);

  const reportLabel = args.dataFile?.replace(/\//g, '_') ?? 'test';
  const reportFile  = `reports/K6-report/performance_dashboard_${reportLabel}_${fecha}.html`;

  const command = [
    'npx cross-env',
    'K6_WEB_DASHBOARD=true',
    `K6_WEB_DASHBOARD_EXPORT=${reportFile}`,
    'k6 run --include-system-env-vars',
    ...k6EnvVars,
    'src/test/performance/performanceTest.ts',
  ].join(' ');

  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';

  try {
    execSync(command, { stdio: 'inherit', shell, env: process.env });
    console.log('Ejecución de k6 completada exitosamente.');
  } catch (error: any) {
    process.exit(error.status || 1);
  }
}

ejecutar();
