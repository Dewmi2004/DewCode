export type ThemeName = 'dark' | 'light' | 'solarized' | 'monokai' | 'dracula' | 'nord' | 'high-contrast';

export interface UserSettings {
  appearance: {
    theme: ThemeName;
    accentColor: string;
    compactMode: boolean;
    reduceMotion: boolean;
  };
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    wordWrap: 'on' | 'off';
    minimap: boolean;
    lineNumbers: boolean;
    autoSave: boolean;
    formatOnSave: boolean;
  };
  layout: {
    sidebarCollapsed: boolean;
    settingsNavCollapsed: boolean;
    editorExplorerCollapsed: boolean;
    terminalCollapsed: boolean;
  };
  github: {
    username: string;
    defaultBranch: string;
    autoSync: boolean;
    tokenConfigured: boolean;
    tokenLast4: string;
  };
  security: {
    twoFactorEnabled: boolean;
    loginAlerts: boolean;
  };
}

export type SettingsUpdate = {
  appearance?: Partial<UserSettings['appearance']>;
  editor?: Partial<UserSettings['editor']>;
  layout?: Partial<UserSettings['layout']>;
  github?: Partial<UserSettings['github']> & { personalAccessToken?: string };
  security?: Partial<UserSettings['security']>;
};

export const DEFAULT_SETTINGS: UserSettings = {
  appearance: {
    theme: 'dark',
    accentColor: '#00D4B8',
    compactMode: false,
    reduceMotion: false,
  },
  editor: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
    tabSize: 2,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: true,
    autoSave: false,
    formatOnSave: false,
  },
  layout: {
    sidebarCollapsed: false,
    settingsNavCollapsed: false,
    editorExplorerCollapsed: false,
    terminalCollapsed: false,
  },
  github: {
    username: '',
    defaultBranch: 'main',
    autoSync: false,
    tokenConfigured: false,
    tokenLast4: '',
  },
  security: {
    twoFactorEnabled: false,
    loginAlerts: true,
  },
};

export const mergeSettings = (
  base: UserSettings,
  update: SettingsUpdate | UserSettings
): UserSettings => ({
  ...base,
  ...update,
  appearance: {
    ...base.appearance,
    ...(update.appearance ?? {}),
  },
  editor: {
    ...base.editor,
    ...(update.editor ?? {}),
  },
  layout: {
    ...base.layout,
    ...(update.layout ?? {}),
  },
  github: {
    ...base.github,
    ...(update.github ?? {}),
  },
  security: {
    ...base.security,
    ...(update.security ?? {}),
  },
});
