// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function authConfig() {
  return {
    issuer: required('OIDC_ISSUER'),
    audience: required('OIDC_AUDIENCE'),
    jwksUrl: required('OIDC_JWKS_URL'),
  };
}
