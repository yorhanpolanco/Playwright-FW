import { test as base } from '@playwright/test';
import { worldDataFixture, WorldDataFixture } from './worldData.fixture';
import { databaseFixture, DatabaseFixture } from './database.fixture';
import { apiFixture, ApiFixture } from './api.fixture';
import { pomFixture, PomFixture } from './pom.fixture';

type AppFixtures = WorldDataFixture & DatabaseFixture & ApiFixture & PomFixture;

import { Utilidades } from '../../utilidades/playwright-utilidades';

export const test = base.extend<AppFixtures>({
    ...worldDataFixture,
    ...databaseFixture,
    ...apiFixture,
    ...pomFixture,
    page: async ({ page }, use) => {
        page.on('console', async (msg) => {
            if (msg.type() === 'error') {
                const log = `${msg.type().toUpperCase()}: ${msg.text()} =>${msg.args()}`;
                await Utilidades.agregarLineaAlLog(log);
            }
        });
        await use(page);
    }
});

export { expect } from '@playwright/test';
