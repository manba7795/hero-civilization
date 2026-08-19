type Listener<T = unknown> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on<T>(event: string, listener: Listener<T>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener);
    this.listeners.set(event, set);
    return () => set.delete(listener as Listener);
  }

  emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
