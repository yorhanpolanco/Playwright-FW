import { consultaRNCPOM } from '../../pom/portal/consultaRNC';

export class ConsultaRNCFlow {
    constructor(private readonly pom: consultaRNCPOM) {}

    async navegarAConsultaRNC(): Promise<void> {
        await this.pom.cerrarAlerta();
        await this.pom.deplegarMenuHerramientas();
        await this.pom.accederConsultas();
        await this.pom.accederConsultaRNC();
    }

    async consultarPorRnc(rnc: string): Promise<void> {
        await this.navegarAConsultaRNC();
        await this.pom.buscarPorRnc(rnc);
    }
}
