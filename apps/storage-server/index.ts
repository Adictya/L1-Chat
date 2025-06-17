import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import getApp from "./src/app.ts";

const storage = MemoryStorage({
	persist: "./auth.json",
});

const app = getApp(storage);

export default {
	fetch: app.fetch,
	port: 3002,
};
