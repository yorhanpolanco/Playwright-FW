import { Locator, Page, FrameLocator } from '@playwright/test';

export class consultaRNCPOM {
    readonly page: Page;
    readonly herramientas: Locator;
    readonly consultas: Locator;
    readonly consultaRNC: Locator;
    readonly iFrame: FrameLocator;
    readonly insertarRNC: Locator;
    readonly botonBuscar: Locator;
    readonly tabla: Locator;
    readonly etiquetasTabla: Locator;
    readonly respuesta: Locator;
    readonly campoRequerido: Locator;
    readonly botonAlerta: Locator;

    constructor(page: Page) {
        this.page = page;
        this.herramientas = page.locator('a[href="/herramientas/Paginas/default.aspx"]:has-text("Herramientas")');
        this.consultas = page.getByRole('link', { name: 'Consultas g' });
        this.consultaRNC = page.getByRole('link', { name: 'RNC Contribuyentes' });
        this.iFrame = page.frameLocator('#MSOPageViewerWebPart_WebPartWPQ2');
        this.insertarRNC = this.iFrame.getByPlaceholder('Escriba un RNC o Cédula válido');
        this.botonBuscar = this.iFrame.getByRole('button', { name: 'BUSCAR' });
        this.tabla = this.iFrame.locator('table#cphMain_dvDatosContribuyentes tbody tr');
        this.etiquetasTabla = this.tabla.locator('td:nth-child(1)');
        this.respuesta = this.tabla.locator('td:nth-child(2)');
        this.campoRequerido = this.iFrame.locator("#cphMain_rfvTxtRNCCedula");
        this.botonAlerta = page.getByRole('link', { name: 'CERRAR' });
    }

    async goto() {
        await this.page.goto(`${process.env.PORTAL_DGII}`, { waitUntil: 'load' });
        await this.page.waitForFunction(() => document.fonts.ready);
        await this.page.waitForLoadState('load');

    }

    async cerrarAlerta() {
        if (await this.botonAlerta.isVisible()) {
            await this.botonAlerta?.waitFor({ timeout: 3000, state: 'visible' });
            await this.botonAlerta?.click();
        }
    }

    async moverMouseAElemento(elemento: Locator) {
        let coordenadas = await elemento.boundingBox({ timeout: 5000 });
        if (!coordenadas) throw new Error("No se pudo obtener el bounding box del elemento");

        await this.page.mouse.move(coordenadas.x, coordenadas.y, { steps: 50 });
        return coordenadas;
    }

    async deplegarMenuHerramientas() {
        await this.herramientas.waitFor({ timeout: 3000, state: 'visible' });
        let coordenadasHerramientas = await this.moverMouseAElemento(this.herramientas);
        await this.herramientas.hover({
            position: { x: coordenadasHerramientas.width / 2, y: coordenadasHerramientas.height / 2 },
            timeout: 5000
        });
        await this.consultas.waitFor({ timeout: 3000, state: 'visible' });
        await this.moverMouseAElemento(this.consultas);
        await this.consultas.focus({ timeout: 3000 });
    }

    async accederConsultas() {
        await this.consultas.click({ timeout: 3000 });
    }

    async accederConsultaRNC() {
        await this.consultaRNC.waitFor({ state: 'visible' });
        await this.consultaRNC.focus({ timeout: 3000 })
        await this.consultaRNC.click({ clickCount: 2, timeout: 3000 });
    }

    async buscarPorRnc(rnc: string = '') {
        await this.insertarRNC.waitFor({ state: 'visible' });
        await this.insertarRNC.fill(rnc);
        await this.botonBuscar.waitFor({ state: 'visible' });
        await this.botonBuscar.click();
    }

    async scrollHastaTabla(locator: Locator, labels: [] | string) {
        if (Array.isArray(labels)) {
            let campo = await locator.nth(5);
            await campo.waitFor({ timeout: 3000, state: 'attached' });
            await campo.focus({ timeout: 3000 });
            await campo.scrollIntoViewIfNeeded({ timeout: 3000 });
            await campo.waitFor({ timeout: 10000, state: 'visible' });
        } else {
            await locator.waitFor();
            await locator.scrollIntoViewIfNeeded({ timeout: 3000 });
            await locator.waitFor({ timeout: 10000, state: 'visible' });

        }
    }


}