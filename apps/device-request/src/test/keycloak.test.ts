// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kcInstance = vi.hoisted(() => ({
  init: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  token: undefined as string | undefined,
  tokenParsed: undefined as Record<string, unknown> | undefined,
}));

vi.mock('keycloak-js', () => ({
  default: vi.fn(function () { return kcInstance; }),
}));

import { accessToken, currentUser, initKeycloak } from '../keycloak';

beforeEach(() => {
  vi.resetAllMocks();
  kcInstance.token = undefined;
  kcInstance.tokenParsed = undefined;
});

describe('keycloak helpers', () => {
  it('initializes keycloak once (StrictMode safe)', async () => {
    kcInstance.init.mockResolvedValue(true);
    const first = initKeycloak();
    const second = initKeycloak();
    expect(first).toBe(second);
    await expect(first).resolves.toBe(true);
    expect(kcInstance.init).toHaveBeenCalledTimes(1);
  });

  it('extracts currentUser safely and filters recognized roles', () => {
    expect(currentUser()).toBeNull();
    kcInstance.tokenParsed = {
      sub: 'user-1',
      preferred_username: 'user.one',
      department: '',
      realm_access: { roles: ['Employee', 'offline_access', 'Manager'] },
    };
    expect(currentUser()).toEqual({
      id: 'user-1',
      name: 'user.one',
      department: null,
      roles: ['Employee', 'Manager'],
    });
  });

  it('returns refreshed token or falls back to login and throws if still unauthenticated', async () => {
    kcInstance.updateToken.mockResolvedValue(true);
    kcInstance.token = 'fresh-token';
    await expect(accessToken()).resolves.toBe('fresh-token');

    kcInstance.updateToken.mockRejectedValue(new Error('expired'));
    kcInstance.login.mockResolvedValue(undefined);
    kcInstance.token = undefined;
    await expect(accessToken()).rejects.toThrow('unauthenticated');
    expect(kcInstance.login).toHaveBeenCalledTimes(1);
  });
});
