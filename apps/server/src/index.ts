import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { SyncEventManager, WebSocketTransport } from "l1-sync";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const app = new Hono();

app.get("/", (c) => {
	return c.text("helo");
});

app.get(
	"/ws",
	upgradeWebSocket((c) => {
		return {
			onOpen(_event, ws) {},
			onClose() {},
			onMessage(event) {
				console.log("Received message:", event);
			},
		};
	}),
);

export default {
	fetch: app.fetch,
	websocket,
};
