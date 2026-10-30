// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { createPublicKey } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function renderGateway(template, jwks, issuer, audience, kid) {
  const keys = jwks.keys?.filter(key => key.kty === 'RSA' && key.use === 'sig'
    && key.alg === 'RS256' && (!kid || key.kid === kid)) ?? [];
  if (keys.length !== 1) throw new Error('Select exactly one RS256 signing key with GATEWAY_SIGNING_KID when rotating keys.');
  const pem = createPublicKey({ key: keys[0], format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  return template.replaceAll('__DXDESK_PUBLIC_KEY__', JSON.stringify(pem))
    .replaceAll('__DXDESK_ISSUER__', JSON.stringify(issuer))
    .replaceAll('__DXDESK_AUDIENCE__', JSON.stringify(audience));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [template, jwks, issuer, audience, output] = process.argv.slice(2);
  if (!output) throw new Error('Usage: render-gateway.mjs template jwks issuer audience output');
  await writeFile(output, renderGateway(await readFile(template, 'utf8'), JSON.parse(await readFile(jwks, 'utf8')),
    issuer, audience, process.env.GATEWAY_SIGNING_KID));
}
