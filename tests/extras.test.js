import { test } from 'node:test';
import { casesExtras } from './cases-extras.js';

for (const c of casesExtras) test(`${c.id} ${c.req}`, async () => { await c.run(); });
