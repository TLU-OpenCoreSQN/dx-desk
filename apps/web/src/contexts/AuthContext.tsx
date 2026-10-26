// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { UserProfile, UserRole } from '../types/api';
import { AuthState } from '../types/auth';
import {
  initKeycloak,
  getAccessToken,
  ensureFreshToken,
  login as kcLogin,
  logout as kcLogout,
  parseTokenRoles,
  getParsedUsername,
  isIdentityServerOffline,
  onSessionLost,
  expireSession,
  getParsedSubject,
} from '../services/keycloak';
import { getMe, ApiClientError } from '../services/api';

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isKeycloakOffline, setIsKeycloakOffline] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const sessionRevision = useRef(0);

  const clearAuthData = useCallback(() => {
    sessionRevision.current += 1;
    setIsAuthenticated(false);
    setToken(null);
    setProfile(null);
    setUsername(null);
    setRoles([]);
  }, []);

  const loadProfile = useCallback(async () => {
    const revision = sessionRevision.current;
    try {
      const userProfile = await getMe();
      if (revision !== sessionRevision.current) return;
      setProfile(userProfile);
      setUsername(userProfile.username);
      setRoles(userProfile.roles);
    } catch (err) {
      if (revision !== sessionRevision.current) return;
      if (err instanceof ApiClientError && err.statusCode === 401) {
        expireSession();
        clearAuthData();
        return;
      }
      console.warn('Could not load profile from /api/me, falling back to token payload:', err);
      const parsedRoles = parseTokenRoles();
      const parsedUser = getParsedUsername();
      setUsername(parsedUser);
      setRoles(parsedRoles);
      const subject = getParsedSubject();
      if (parsedUser && subject) {
        setProfile({
          id: subject,
          username: parsedUser,
          roles: parsedRoles,
        });
      }
    }
  }, [clearAuthData]);

  useEffect(() => onSessionLost(clearAuthData), [clearAuthData]);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const authenticated = await initKeycloak();
        if (!isMounted) return;

        if (authenticated) {
          const currentToken = getAccessToken();
          setToken(currentToken);
          setIsAuthenticated(true);
          await loadProfile();
        } else {
          clearAuthData();
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Authentication service could not be initialized:', err);
        clearAuthData();
      } finally {
        if (isMounted) {
          setIsKeycloakOffline(isIdentityServerOffline());
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [clearAuthData, loadProfile]);

  const login = useCallback(async () => {
    try { await kcLogin(); }
    catch { setIsKeycloakOffline(true); }
  }, []);

  const logout = useCallback(async () => {
    clearAuthData();
    try { await kcLogout(); }
    catch { expireSession(); setIsKeycloakOffline(true); }
  }, [clearAuthData]);

  const refreshToken = useCallback(async (minValidity = 30): Promise<boolean> => {
    const refreshed = await ensureFreshToken(minValidity);
    if (refreshed) {
      setToken(getAccessToken());
    } else {
      clearAuthData();
    }
    return refreshed;
  }, [clearAuthData]);

  const hasRole = useCallback(
    (role: UserRole): boolean => {
      return roles.includes(role);
    },
    [roles]
  );

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated,
      isLoading,
      isKeycloakOffline,
      token,
      profile,
      username,
      roles,
      hasRole,
      login,
      logout,
      refreshToken,
    }),
    [
      isAuthenticated,
      isLoading,
      isKeycloakOffline,
      token,
      profile,
      username,
      roles,
      hasRole,
      login,
      logout,
      refreshToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
