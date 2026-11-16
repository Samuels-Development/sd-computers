import type { ReactNode } from 'react';
import { AppWindow, Clock, Monitor, Paintbrush, ShieldCheck, UserRound } from 'lucide-react';

export type PageId = 'system' | 'about' | 'personalization' | 'themes' | 'lockscreen' | 'start' | 'taskbar' | 'accounts' | 'time' | 'privacy' | 'apps';
export type TopPage = 'system' | 'personalization' | 'accounts' | 'time' | 'privacy' | 'apps';

export interface NavDef {
  id: TopPage;

  color: string;
  icon: ReactNode;
}

export const NAV: NavDef[] = [
  { id: 'system', color: '#2f80e4', icon: <Monitor size={13} strokeWidth={2.2} /> },
  { id: 'personalization', color: '#d4489a', icon: <Paintbrush size={13} strokeWidth={2.2} /> },
  { id: 'apps', color: '#7a5af5', icon: <AppWindow size={13} strokeWidth={2.2} /> },
  { id: 'accounts', color: '#1f9e6e', icon: <UserRound size={13} strokeWidth={2.2} /> },
  { id: 'time', color: '#7a5af5', icon: <Clock size={13} strokeWidth={2.2} /> },
  { id: 'privacy', color: '#5f6b7a', icon: <ShieldCheck size={13} strokeWidth={2.2} /> },
];

export const PARENT: Record<PageId, TopPage> = {
  system: 'system',
  about: 'system',
  personalization: 'personalization',
  themes: 'personalization',
  lockscreen: 'personalization',
  start: 'personalization',
  taskbar: 'personalization',
  apps: 'apps',
  accounts: 'accounts',
  time: 'time',
  privacy: 'privacy',
};

export type Go = (page: PageId) => void;
