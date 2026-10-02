/** Floating docks open one at a time: opening one announces its id and the others close. */
export const PC_DOCK_OPEN_EVENT = 'pc:dock-open';

export function announceDockOpen(dockId: string): void {
  window.dispatchEvent(new CustomEvent<string>(PC_DOCK_OPEN_EVENT, { detail: dockId }));
}

export function onOtherDockOpen(dockId: string, close: () => void): () => void {
  const listener = (event: Event) => {
    if ((event as CustomEvent<string>).detail !== dockId) close();
  };
  window.addEventListener(PC_DOCK_OPEN_EVENT, listener);
  return () => window.removeEventListener(PC_DOCK_OPEN_EVENT, listener);
}
