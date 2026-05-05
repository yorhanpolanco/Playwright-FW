import { Page } from '@playwright/test';
import { consultaRNCPOM } from '../../test/pom/portal/consultaRNC';

export type PomFixture = {
    consultaRNCPage: consultaRNCPOM;
};

export const pomFixture = {
    consultaRNCPage: async ({ page }: { page: Page }, use: (pom: consultaRNCPOM) => Promise<void>) => {
        const pom = new consultaRNCPOM(page);
        await use(pom);
    }
};
