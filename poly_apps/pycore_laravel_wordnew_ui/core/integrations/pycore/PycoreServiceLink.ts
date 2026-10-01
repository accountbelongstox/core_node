/**
 * PycoreServiceLink - the connection to the selected pycore (pycoreTarget).
 * It never switches: while the selected backend is down requests wait on the
 * link, which re-probes `GET /api/status` until the backend answers again.
 * The relay entry has its own delivery and is never reconnected here.
 */
import { ServiceLink } from '../../network/ServiceLink';
import { probePycoreEndpoint } from './PycoreEndpointProbe';
import { PYCORE_HEALTH_DEFAULTS } from './PycoreNetwork';
import { getPycoreTarget } from './pycoreTarget';

export const pycoreLink = new ServiceLink({
  probe: async () => {
    const target = getPycoreTarget();
    if (target.kind === 'relay') return true;
    // A refusing or misrouted backend answered: the request reports that itself.
    return (await probePycoreEndpoint(target, PYCORE_HEALTH_DEFAULTS.pingTimeoutMs)).state !== 'down';
  },
});
