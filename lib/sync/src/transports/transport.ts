import type { SyncEvent } from "../sync-events";

export interface ITransport {
  id: string;
	send(event: SyncEvent): void | Promise<void>;
	onMessage(handler: (event: SyncEvent) => void): void;
	close(): void;
} 
