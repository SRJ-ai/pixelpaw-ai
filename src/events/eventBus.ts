/**
 * Tiny typed event bus (§43). Every subsystem communicates through events rather
 * than calling each other directly, which keeps behaviors decoupled and makes the
 * priority/cooldown logic in the engine the single arbiter of what the pet does.
 */

export type PetEventMap = {
  "mouse.move": { x: number; y: number; fracX: number; fracY: number; speed: number };
  "mouse.enter": { fracX: number; fracY: number };
  "mouse.leave": Record<string, never>;
  "mouse.down": { fracX: number; fracY: number };
  "mouse.up": Record<string, never>;
  "mouse.shake": { intensity: number };
  "mouse.pet": { strokes: number };
  "mouse.hunt": { speed: number };
  "drag.start": Record<string, never>;
  "drag.end": Record<string, never>;
  "user.idle": Record<string, never>;
  "user.active": Record<string, never>;
  "pet.sleep": Record<string, never>;
  "pet.wake": Record<string, never>;
  "pet.stateChange": { state: string };
  "control.pause": Record<string, never>;
  "control.resume": Record<string, never>;
};

type Handler<T> = (payload: T) => void;

export class EventBus<M extends Record<string, unknown>> {
  private handlers = new Map<keyof M, Set<Handler<unknown>>>();

  on<K extends keyof M>(key: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(handler as Handler<unknown>);
    return () => set!.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof M>(key: K, payload: M[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const h of set) (h as Handler<M[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const bus = new EventBus<PetEventMap>();
