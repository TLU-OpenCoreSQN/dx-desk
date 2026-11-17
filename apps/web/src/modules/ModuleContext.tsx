// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { preloadModulesConfig } from './config';
import { enabledModules, MODULES } from './registry';
import type { ModuleId, ModuleManifest } from './types';

interface ModuleState {
  /** `false` khi cấu hình module chưa đọc xong. */
  ready: boolean;
  modules: ModuleManifest[];
}

const ModuleContext = createContext<ModuleState | undefined>(undefined);

interface ModuleProviderProps {
  children: React.ReactNode;
  /** Bỏ qua việc đọc /config/modules.json (dùng trong kiểm thử). `null` = bật hết. */
  enabled?: ReadonlySet<ModuleId> | null;
  registry?: readonly ModuleManifest[];
}

export const ModuleProvider: React.FC<ModuleProviderProps> = ({ children, enabled, registry = MODULES }) => {
  const preset = enabled !== undefined;
  const [loaded, setLoaded] = useState<ReadonlySet<ModuleId> | null | undefined>(undefined);

  useEffect(() => {
    if (preset) return;
    let active = true;
    void preloadModulesConfig().then((result) => {
      if (active) setLoaded(result);
    });
    return () => {
      active = false;
    };
  }, [preset]);

  const effective = preset ? enabled : loaded;
  const value = useMemo<ModuleState>(
    () => ({ ready: effective !== undefined, modules: enabledModules(effective ?? null, registry) }),
    [effective, registry],
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
};

export function useModules(): ModuleState {
  const context = useContext(ModuleContext);
  if (!context) throw new Error('useModules phải dùng bên trong ModuleProvider');
  return context;
}

/** Module có đang bật không. Ngoài ModuleProvider (ví dụ kiểm thử một trang riêng) coi như bật. */
export function useModuleEnabled(id: ModuleId): boolean {
  const context = useContext(ModuleContext);
  return !context || context.modules.some((m) => m.id === id);
}
