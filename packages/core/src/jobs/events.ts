// src/jobs/events.ts — EventBus for real-time crawl progress (SSE)

type Listener = (data: any) => void;

export class EventBus {
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(listener);
    }

    off(event: string, listener: Listener) {
        this.listeners.get(event)?.delete(listener);
    }

    emit(event: string, data: any) {
        this.listeners.get(event)?.forEach((fn) => fn(data));
    }
}
