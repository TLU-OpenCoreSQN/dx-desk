// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadSignature, validDownload } from '../dist/downloads.js';

test('signed downloads bind the object ID and expiry, reject tampering and expire precisely', () => {
  process.env.ATTACHMENT_SIGNING_KEY = 'unit-test-only-key-with-at-least-32-bytes';
  const now = Date.now();
  const expires = String(Math.floor(now / 1000) + 120);
  const id = '10000000-0000-4000-8000-000000000001';
  const signature = downloadSignature(id, expires);
  assert.equal(validDownload(id, expires, signature, now), true);
  assert.equal(validDownload(id.replace(/1$/, '2'), expires, signature, now), false);
  assert.equal(validDownload(id, String(Number(expires) + 1), signature, now), false);
  assert.equal(validDownload(id, expires, 'a'.repeat(64), now), false);
  assert.equal(validDownload(id, expires, signature, Number(expires) * 1000), false);
  for (const invalid of [undefined, [], {}, '1e10', ['1234567890'], expires + '0']) {
    assert.equal(validDownload(id, invalid, signature, now), false);
  }
  assert.equal(validDownload(id, expires, [], now), false);
  const future = String(Math.floor(now / 1000) + 121);
  assert.equal(validDownload(id, future, downloadSignature(id, future), now), false);
});
