// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { UserProfile, UserRole } from './api';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isKeycloakOffline: boolean;
  token: string | null;
  profile: UserProfile | null;
  username: string | null;
  roles: UserRole[];
  hasRole: (role: UserRole) => boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: (minValidity?: number) => Promise<boolean>;
}
