import { useEffect, useState } from 'react';
import { isNotebookRelayDevice } from '../../../core/contracts/RelayCapabilities';
import { laravelRelayRoster } from '../../../core/integrations/laravel/LaravelRelayRoster';
import { isPycoreRelayMode, subscribePycoreTarget } from '../../../core/integrations/pycore/pycoreTarget';
import { laravelRelayDeviceId, subscribeLaravelRelayDevice } from '../../../core/integrations/pycore/RelayPairing';

function headlessTarget(): boolean {
  if (!isPycoreRelayMode()) return false;
  const deviceId = laravelRelayDeviceId();
  const device = laravelRelayRoster.list().find((entry) => entry.device_id === deviceId);
  return isNotebookRelayDevice(device?.label);
}

/** False while the selected pycore is a headless notebook node (no windows, terminals or desktop to act on). */
export function usePcDesktopHost(): boolean {
  const [headless, setHeadless] = useState(headlessTarget);
  useEffect(() => {
    const update = () => setHeadless(headlessTarget());
    laravelRelayRoster.start();
    const offs = [laravelRelayRoster.onChange(update), subscribeLaravelRelayDevice(update), subscribePycoreTarget(update)];
    update();
    return () => {
      offs.forEach((off) => off());
      laravelRelayRoster.stop();
    };
  }, []);
  return !headless;
}
