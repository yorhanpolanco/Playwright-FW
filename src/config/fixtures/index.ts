import { test as base } from '@playwright/test';
import { worldDataFixture, WorldDataFixture } from './worldData.fixture';
import { databaseFixture, DatabaseFixture } from './database.fixture';
import { apiFixture, ApiFixture } from './api.fixture';

type AppFixtures = WorldDataFixture & DatabaseFixture & ApiFixture;

import { Utilidades } from '../../utilidades/playwright-utilidades';

export const test = base.extend<AppFixtures>({
    ...worldDataFixture,
    ...databaseFixture,
    ...apiFixture,
    page: async ({ page }, use) => {
        page.on('console', async (msg) => {
            if (msg.type() === 'error') {
                const log = `[W${process.env.TEST_WORKER_INDEX || '?'}] ${msg.type().toUpperCase()}: ${msg.text()} =>${msg.args()}`;
                await Utilidades.agregarLineaAlLog(log);
            }
        });
        await use(page);
    }
});

export { expect } from '@playwright/test';
