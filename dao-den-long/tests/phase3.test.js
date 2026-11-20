import { test } from 'node:test';
import { cases3 } from './cases3.js';

for (const c of cases3) test(`${c.id} ${c.req}`, () => { c.run(); });
