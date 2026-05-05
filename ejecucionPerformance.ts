import { execSync } from 'child_process';
import fs from 'fs';
import dayjs from 'dayjs';
import Logs from './src/config/logConfig';

let dataFile: string | undefined;
let defaultDataFile: string | undefined;
const fecha = dayjs().format('DD-MM-YYYY_HHmmss');

function extraerArgumentos(): void {
  const args = process.argv.slice(2);
  args.forEach(arg => {
    if (arg.startsWith('data_file=')) {
      dataFile = arg;
      defaultDataFile = dataFile.split('=')[1];
    } else if (arg.startsWith('env=')) {
      process.env.ENV = arg.split('=')[1];
    }
  });
  if (!process.env.ENV) {
    throw new Error('Debes proveer el argumento env=<entorno>');
  }
}

function configurarAmbiente(): void {
  const envPath = `.env.${process.env.ENV}`;
  process.loadEnvFile(envPath);
}

async function ejecutar(): Promise<void> {
  extraerArgumentos();
  configurarAmbiente();
  await Logs.imprimirCabecera();

  fs.mkdirSync('reports', { recursive: true });
  fs.mkdirSync('reports/K6-report', { recursive: true });

  const command = [
    'npx cross-env',
    'K6_WEB_DASHBOARD=true',
    `K6_WEB_DASHBOARD_EXPORT=reports/K6-report/performance_dashboard_${defaultDataFile}_${fecha}.html`,
    'k6 run --include-system-env-vars',
    `-e ${dataFile}`,
    'src/test/performance/performanceTest.ts'
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
