// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import Keycloak from 'keycloak-js';
import { UserRole } from '../types/api';

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM || 'dxdesk';
const keycloakClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'dxdesk-web';

export const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: keycloakRealm,
  clientId: keycloakClientId,
});

let initPromise: Promise<boolean> | null = null;
let isKeycloakUnavailable = false;
const sessionLostListeners = new Set<() => void>();
function notifySessionLost() {
  sessionLostListeners.forEach(listener => listener());
}
export function onSessionLost(listener: () => void): () => void {
  sessionLostListeners.add(listener);
  return () => { sessionLostListeners.delete(listener); };
}
export function expireSession(): void {
  keycloak.clearToken();
  notifySessionLost();
}
keycloak.onAuthLogout = notifySessionLost;
keycloak.onAuthRefreshError = expireSession;
keycloak.onTokenExpired = () => { void ensureFreshToken(30); };

/**
 * Initialize Keycloak once with PKCE S256.
 * Safe against React 18 StrictMode double initialization.
 * Does not throw on identity server unavailability to allow signed-out Home route rendering.
 */
export async function initKeycloak(): Promise<boolean> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const discovery = await fetch(
        `${keycloakUrl}/realms/${keycloakRealm}/.well-known/openid-configuration`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!discovery.ok) throw new Error('Identity server unavailable');
      const authenticated = await keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        enableLogging: false,
      });
      isKeycloakUnavailable = false;
      return Boolean(authenticated);
    } catch (error) {
      // Identity server is offline or unreachable
      console.warn('Keycloak OIDC server is unavailable:', error);
      isKeycloakUnavailable = true;
      return false;
    }
  })();

  return initPromise;
}

export function isIdentityServerOffline(): boolean {
  return isKeycloakUnavailable;
}

export function getAccessToken(): string | null {
  return keycloak.token || null;
}

/**
 * Refreshes the token if it expires within minValidity seconds.
 * Never persists tokens to storage.
 */
export async function ensureFreshToken(minValidity = 30): Promise<boolean> {
  if (!keycloak.authenticated) {
    notifySessionLost();
    return false;
  }
  try {
    await keycloak.updateToken(minValidity);
    return Boolean(keycloak.token);
  } catch (error) {
    expireSession();
    return false;
  }
}

export async function login(): Promise<void> {
  await keycloak.login({
    redirectUri: window.location.origin,
  });
}

export async function logout(): Promise<void> {
  const url = keycloak.createLogoutUrl({
    redirectUri: window.location.origin,
  });
  expireSession();
  window.location.assign(url);
}

export function parseTokenRoles(): UserRole[] {
  if (!keycloak.tokenParsed) {
    return [];
  }
  const realmRoles = (keycloak.tokenParsed.realm_access?.roles || []) as string[];
  const allRoles = realmRoles;

  const validRoles: UserRole[] = [];
  if (allRoles.includes('Manager')) validRoles.push('Manager');
  if (allRoles.includes('Agent')) validRoles.push('Agent');
  if (allRoles.includes('Employee')) validRoles.push('Employee');

  return validRoles;
}

export function getParsedUsername(): string | null {
  if (!keycloak.tokenParsed) {
    return null;
  }
  return (
    keycloak.tokenParsed.preferred_username ||
    keycloak.tokenParsed.name ||
    keycloak.tokenParsed.sub ||
    null
  );
}

export function getParsedSubject(): string | null {
  return keycloak.tokenParsed?.sub ?? null;
}
