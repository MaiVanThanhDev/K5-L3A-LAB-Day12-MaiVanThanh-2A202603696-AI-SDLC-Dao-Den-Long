import { test } from 'node:test';
import { cases } from './cases.js';

for (const c of cases) test(`${c.id} ${c.req}`, () => { c.run(); });
