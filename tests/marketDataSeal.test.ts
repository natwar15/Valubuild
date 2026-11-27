import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { sealMarketFiles, openMarketFiles } from '../src/server/marketDataSeal.ts';

test('sealed market data round-trips and rejects the wrong key', () => {
  const key = crypto.randomBytes(32).toString('base64');
  const files = { 'listings_all.csv': 'a,b\n1,2\n', 'market_index.csv': 'x\n3\n' };
  const sealed = sealMarketFiles(files, key);
  assert.ok(!sealed.includes('a,b'));
  assert.deepEqual(openMarketFiles(sealed, key), files);
  assert.throws(() => openMarketFiles(sealed, crypto.randomBytes(32).toString('base64')));
});
