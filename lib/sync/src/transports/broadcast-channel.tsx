import type { SyncEvent } from "../sync-events";
import type { ITransport } from "./transport";

export class BroadcastChannelTransport implements ITransport {
	id: string;
	private channel: BroadcastChannel;

	constructor(id: string, channelName: string) {
		this.id = id;
		this.channel = new BroadcastChannel(channelName);
	}

	send(event: SyncEvent): void {
		console.log("[BroadcastChannelTransport] Sending message", event);
		event.transportId = this.id;
		this.channel.postMessage(event);
	}

	onMessage(handler: (event: SyncEvent) => void): void {
		this.channel.onmessage = (msgEvent: MessageEvent<SyncEvent>) => {
			msgEvent.data.transportId = this.id;
			handler(msgEvent.data);
		};
	}

	close(): void {
		this.channel.close();
	}
}

