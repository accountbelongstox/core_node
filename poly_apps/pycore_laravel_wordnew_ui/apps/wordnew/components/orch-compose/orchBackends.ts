import { AlertCircle, Route, Server, Smartphone, Waypoints, type LucideIcon } from 'lucide-react';
import type { StatusTone } from '@/shared/ui/statusTone';

export type OrchBackendId = 'device' | 'pycore' | 'laravel' | 'relay' | 'missing';

interface OrchBackendView {
  icon: LucideIcon;
  tone: StatusTone;
}

/** The icon and tone every orchestration widget uses for a clip source / backend. */
export const ORCH_BACKEND_VIEW: Record<OrchBackendId, OrchBackendView> = {
  device: { icon: Smartphone, tone: 'emerald' },
  pycore: { icon: Waypoints, tone: 'indigo' },
  laravel: { icon: Server, tone: 'sky' },
  relay: { icon: Route, tone: 'violet' },
  missing: { icon: AlertCircle, tone: 'rose' },
};
