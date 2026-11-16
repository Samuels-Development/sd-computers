export type AppId =
  | 'mail'
  | 'logs'
  | 'cmd'
  | 'boss'
  | 'notepad'
  | 'calculator'
  | 'settings'
  | 'messages'
  | 'notes'
  | 'files'
  | 'cameras'
  | 'board'
  | 'bank'
  | 'photos'
  | 'contacts'
  | 'phonelink'
  | 'browser'
  | 'games'
  | ExtAppId;

export type ExtAppId = `ext:${string}`;

export const isExt = (app: string): app is ExtAppId => app.startsWith('ext:');

export interface ExtAppDef {

  id: string;

  resource: string;

  ui?: string | null;
  icon?: string | null;

  color?: string | null;
  description?: string | null;
  developer?: string | null;
  version?: string | null;

  mirror?: boolean;
}

export interface AppDef {
  id: AppId;
  label: string;
  w: number;
  h: number;

  resizable?: boolean;

  ext?: ExtAppDef;
}

export interface WallpaperDef {
  id: string;
  label: string;
}

export type Theme = 'dark' | 'light';

export type OsStyle = 'modern' | 'retro' | 'mac';

export interface DesktopPosition { col: number; row: number }

export interface UserSettings {
  desktopHidden?: Record<string, boolean>;
  desktopPositions?: Record<string, DesktopPosition>;
  taskbarPins?: Record<string, boolean>;
  theme?: Theme;
  wallpaper?: string;
  accent?: string;
}

export interface GameMeta {
  program: string;
  label: string;
}

export interface OpenPayload {

  view?: { x: number; y: number; w: number; h: number };
  computer: {
    id: string;
    label: string;
    hostname: string;
    ip: string;
    instance: string;
    style: OsStyle;
    requiresPin: boolean;
    lockedFor: number;
    apps: AppDef[];
    pinned: AppId[];
    desktopIcons: AppId[];

    badges?: Record<string, number>;
  };
  user: { name: string; initials: string; job: string };
  desktop: {
    style: OsStyle;
    osName: string;
    osBuild: string;
    boot: boolean;
    clock24: boolean;
    wallpapers: WallpaperDef[];
    accents: string[];
    defaultWallpaper: string;
    defaultTheme: Theme;

    monitor: boolean;

    sounds: boolean;

    printing?: boolean;
  };
  settings: UserSettings;
  hacks: {
    practice: boolean;
    defaultDifficulty: Difficulty;
    games: Record<string, GameMeta>;
  };
  mail: {
    domain: string;
    maxRecipients: number;
    maxSubject: number;
    maxBody: number;
    minPassword: number;
    maxDisplayName: number;

    phone?: boolean;
  };
}

export interface RpcResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface HackRun {
  token: number;
  game: string;
  difficulty: Difficulty;
  program: string;
  label: string;
  params: Record<string, number>;
  steps: number;
  minSeconds: number;
  challenge?: unknown;

  step?: number;
  total?: number;

  title?: string;
}
