import { BroadcastChannelTransport, SimpleWebSocketTransport, SyncEventManager } from "l1-sync";
import { worker } from "./worker";

worker({
	init: async () => {

		const syncEventManager = new SyncEventManager();

		const broadcastChannelTransport = new BroadcastChannelTransport(
			"local-tab-sync",
			"l1-chat-sync-events",
		);
		syncEventManager.addTransport(broadcastChannelTransport);
    postMessage("Initiate websocket");
	},
});
