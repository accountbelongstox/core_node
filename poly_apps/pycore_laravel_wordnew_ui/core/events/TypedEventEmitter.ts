export type EventListener<EventMap, EventName extends keyof EventMap> = (
  payload: EventMap[EventName],
) => void;

/** Small typed pub/sub primitive shared by UI stores and device capabilities. */
export class TypedEventEmitter<EventMap> {
  private readonly listeners = new Map<
    keyof EventMap,
    Set<EventListener<EventMap, keyof EventMap>>
  >();

  constructor(private readonly label: string) {}

  on<EventName extends keyof EventMap>(
    event: EventName,
    listener: EventListener<EventMap, EventName>,
  ): () => void {
    let eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      eventListeners = new Set();
      this.listeners.set(event, eventListeners);
    }
    eventListeners.add(listener as EventListener<EventMap, keyof EventMap>);
    return () => this.off(event, listener);
  }

  once<EventName extends keyof EventMap>(
    event: EventName,
    listener: EventListener<EventMap, EventName>,
  ): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<EventName extends keyof EventMap>(
    event: EventName,
    listener: EventListener<EventMap, EventName>,
  ): void {
    const eventListeners = this.listeners.get(event);
    eventListeners?.delete(listener as EventListener<EventMap, keyof EventMap>);
    if (eventListeners?.size === 0) this.listeners.delete(event);
  }

  emit<EventName extends keyof EventMap>(
    event: EventName,
    payload: EventMap[EventName],
  ): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    for (const listener of Array.from(eventListeners)) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[${this.label}] listener error`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  count(): number {
    let count = 0;
    this.listeners.forEach((eventListeners) => {
      count += eventListeners.size;
    });
    return count;
  }
}
