import { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import Logs from './logConfig';

export default class CustomReporter implements Reporter {

    private stepCounters: Map<string, number> = new Map();

    private getWorkerPrefix(result: TestResult): string {
        return `[W${result.workerIndex}] `;
    }

    private getScenarioName(test: TestCase, result: TestResult): string {
        return test.title;
    }

    onTestBegin(test: TestCase, result: TestResult) {
        this.stepCounters.set(test.id, 0);

        const featureName =  test.parent.title || test.parent.parent?.title;
        const log = `${this.getWorkerPrefix(result)}FEATURE: ${featureName}`;

        void Logs.agregarLineaAlLogHeader(Logs.formantCabecera(log.toUpperCase()), true);
        void Logs.agregarLineaAlLogHeader(this.getWorkerPrefix(result) + `SCENARIO: ${this.getScenarioName(test, result).toUpperCase()}`, true);
    }

    onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
        if (step.category === 'test.step' && (step.title.startsWith('Given ') || step.title.startsWith('When ') || step.title.startsWith('Then ') || step.title.startsWith('And '))) {
            const pasoActual = (this.stepCounters.get(test.id) || 0) + 1;
            this.stepCounters.set(test.id, pasoActual);

            const log = `${this.getWorkerPrefix(result)}Se esta ejecutando el step ${pasoActual}: ${step.title}`;
            void Logs.agregarLineaAlLogHeader(log, true);
        }
    }

    onStdOut(chunk: string | Buffer) {
        process.stdout.write(chunk);
    }

    onStdErr(chunk: string | Buffer) {
        process.stderr.write(chunk);
    }

    onTestEnd(test: TestCase, result: TestResult) {
        if (result.status === 'failed') {
            const errorMessage = `${this.getWorkerPrefix(result)}Error: ${result.error?.message || 'Error desconocido'}`;
            void Logs.agregarLineaAlLogHeader(errorMessage, false);
            void Logs.agregarLineaAlLogHeader(`${this.getWorkerPrefix(result)}Fue finalizado con error el escenario de prueba: ${this.getScenarioName(test, result).toUpperCase()}!`, false);
        } else {
            void Logs.agregarLineaAlLogHeader(`${this.getWorkerPrefix(result)}Fue finalizado el escenario de prueba: ${this.getScenarioName(test, result).toUpperCase()}!`, true);
        }

        this.stepCounters.delete(test.id);
    }
}
