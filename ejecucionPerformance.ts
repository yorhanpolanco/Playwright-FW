import { execSync } from 'node:child_process';
import fs from 'node:fs';
import dayjs from 'dayjs';
import Logs from './src/config/logConfig';
import getAuthDetails, { getAccessToken } from './src/config/API/apiAuth';
import { isValidUrl, replacePlaceholders } from './src/utilidades/playwright-utilidades';

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
      case 'scenario':  resultado.scenario = value; break;
      case 'env':       resultado.env      = value; break;
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

/**
 * Resuelve el token de autorización buscando el primer valor de `autorizacion`
 * no vacío entre los escenarios provistos. Retorna undefined si ninguno tiene auth.
 */
async function resolverAutorizacion(
  scenarios: Record<string, unknown>
): Promise<string | undefined> {
  for (const rawScenario of Object.values(scenarios)) {
    const autorizacion = replacePlaceholders(
      ((rawScenario as any)?.autorizacion as string) ?? ''
    ).trim();

    if (!autorizacion) continue;

    const tokenObj = isValidUrl(autorizacion)
      ? await getAccessToken(autorizacion)
      : getAuthDetails(autorizacion);

    const token = (tokenObj as Record<string, string | undefined>)?.Authorization;
    if (token) return token;
  }

  return undefined;
}

async function ejecutar(): Promise<void> {
  const args = extraerArgumentos();

  configurarAmbiente(args.env);
  process.env.ENV = args.env;

  await Logs.imprimirCabecera();

  fs.mkdirSync('reports/K6-report', { recursive: true });

  if (args.dataFile) {
    const dataPath = `src/test/data/API/${args.dataFile}.json`;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch {
      throw new Error(`No se pudo leer o parsear el archivo de datos: ${dataPath}`);
    }

    // Si se especificó un escenario puntual, usar sólo ese para la resolución de auth
    const scopeAuth = args.scenario
      ? { [args.scenario]: parsed[args.scenario] }
      : parsed;

    const token = await resolverAutorizacion(scopeAuth);
    if (token) {
      process.env.AZURE_TOKEN = token;
      const scopeLabel = args.scenario ?? 'todos los escenarios';
      await Logs.agregarLineaAlLogHeader(`Token de Azure inyectado (scope: ${scopeLabel}).`);
    }
  }

  const k6EnvVars: string[] = [];
  if (args.dataFile) k6EnvVars.push(`-e data_file=${args.dataFile}`);
  if (args.scenario)  k6EnvVars.push(`-e scenario=${args.scenario}`);

  const reportLabel    = args.dataFile?.replace(/\//g, '_') ?? 'test';
  const scenarioSuffix = args.scenario ? `_${args.scenario}` : '';
  const reportFile     = `reports/K6-report/performance_dashboard_${reportLabel}${scenarioSuffix}_${fecha}.html`;

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
    await Logs.agregarLineaAlLogHeader('Ejecución de k6 completada exitosamente.');
  } catch (error: unknown) {
    const status = (error instanceof Error && 'status' in error)
      ? (error as NodeJS.ErrnoException & { status?: number }).status
      : undefined;
    process.exit(status ?? 1);
  }
}

ejecutar().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error fatal durante la ejecución: ${message}`);
  process.exit(1);
});
