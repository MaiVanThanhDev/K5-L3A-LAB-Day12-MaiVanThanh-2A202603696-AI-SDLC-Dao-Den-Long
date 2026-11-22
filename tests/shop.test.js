import { test } from 'node:test';
import { casesShop } from './cases-shop.js';

for (const c of casesShop) test(`${c.id} ${c.req}`, { skip: c.skip || false }, async () => { await c.run(); });
