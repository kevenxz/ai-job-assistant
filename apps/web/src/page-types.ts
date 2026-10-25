import type { Bootstrap } from '../../../src/shared/types';
import type { ToastState } from './ui';

export type PageKey = 'overview' | 'profile' | 'jobs' | 'settings';

export interface PageProps {
  bootstrap: Bootstrap;
  refreshKey: number;
  navigate: (page: PageKey) => void;
  refreshBootstrap: () => Promise<void>;
  notify: (type: ToastState['type'], message: string) => void;
}
