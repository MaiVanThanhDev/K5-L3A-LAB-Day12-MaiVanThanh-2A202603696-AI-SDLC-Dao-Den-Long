import { test } from 'node:test';
import { cases4 } from './cases4.js';

for (const c of cases4) test(`${c.id} ${c.req}`, async () => { await c.run(); });
