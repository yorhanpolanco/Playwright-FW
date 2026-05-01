import { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { Utilidades } from '../utilidades/playwright-utilidades';
import Logs from './logConfig';

export default class CustomReporter implements Reporter {

    // Mapa para mantener el conteo de steps por cada escenario (TestCase) en ejecución
    private stepCounters: Map<string, number> = new Map();

    private getWorkerPrefix(result: TestResult): string {
        return `[W${result.workerIndex}] `;
    }

    private getScenarioName(test: TestCase, result: TestResult): string {
        return test.title;
    }

    onTestBegin(test: TestCase, result: TestResult) {
        // Inicializamos el contador de steps para este escenario
        this.stepCounters.set(test.id, 0);

        const featureName = test.parent.parent?.title || test.parent.title;
        const log = `${this.getWorkerPrefix(result)}FEATURE: ${featureName}`;

        void Utilidades.agregarLineaAlLog(Logs.formantCabecera(log.toUpperCase()), true);
        void Utilidades.agregarLineaAlLog(this.getWorkerPrefix(result) + `SCENARIO: ${this.getScenarioName(test, result).toUpperCase()}`, true);
    }

    onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
        if (step.category === 'test.step' && (step.title.startsWith('Given ') || step.title.startsWith('When ') || step.title.startsWith('Then ') || step.title.startsWith('And '))) {
            // Incrementamos el contador para este escenario
            const pasoActual = (this.stepCounters.get(test.id) || 0) + 1;
            this.stepCounters.set(test.id, pasoActual);

            const log = `${this.getWorkerPrefix(result)}Se esta ejecutando el step ${pasoActual}: ${step.title}`;
            void Utilidades.agregarLineaAlLog(log, true);
        }
    }

    onTestEnd(test: TestCase, result: TestResult) {
        if (result.status === 'failed') {
            const errorMessage = `${this.getWorkerPrefix(result)}Error: ${result.error?.message || 'Error desconocido'}`;
            void Utilidades.agregarLineaAlLog(errorMessage, false);
            void Utilidades.agregarLineaAlLog(`${this.getWorkerPrefix(result)}Fue finalizado con error el escenario de prueba: ${this.getScenarioName(test, result).toUpperCase()}!`, false);
        } else {
            void Utilidades.agregarLineaAlLog(`${this.getWorkerPrefix(result)}Fue finalizado el escenario de prueba: ${this.getScenarioName(test, result).toUpperCase()}!`, true);
        }

        // Limpiamos el contador de la memoria una vez finaliza el test
        this.stepCounters.delete(test.id);
    }
}
