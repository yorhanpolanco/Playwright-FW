const { execSync } = require('child_process');
const dayjs = require('dayjs');
const logs = require('./src/config/logConfig.js');

let dataFile; // Valor por defecto: 'rba'
let fecha = dayjs().format('DD-MM-YYYY_HHmmss');
let defaultDataFile;

function extraerArgumentos() {
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

function configurarAmbiente() {
  const envPath = `.env.${process.env.ENV}`;
  process.loadEnvFile(envPath);
}

async function ejecutar() {
  extraerArgumentos();
  configurarAmbiente();
  await logs.imprimirCabecera();

  // Construir el comando con cross-env
  const command = `npx cross-env K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=src/test-result/reports/performance_dashboard_${defaultDataFile}_${fecha}.html k6 run --include-system-env-vars -e ${dataFile} src/test/performance/performanceTest.ts`;

  // Ejecutar el comando con spawn
  try {
    // Ejecuta y muestra output en consola
    const output = execSync(command, { stdio: 'inherit', shell: true, env: process.env });
    console.log('Ejecución de k6 completada exitosamente.');
  } catch (error) {
    //console.error('Error al ejecutar el comando:', error);
    process.exit(error.status || 1);
  }
}

// Llamar a la función principal
ejecutar();

// > logs/performance_k6_logs.txt 2>&1