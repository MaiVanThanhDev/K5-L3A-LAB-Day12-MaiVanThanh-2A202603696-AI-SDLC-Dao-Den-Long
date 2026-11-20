import { test } from 'node:test';
import { cases2 } from './cases2.js';

for (const c of cases2) test(`${c.id} ${c.req}`, () => { c.run(); });
