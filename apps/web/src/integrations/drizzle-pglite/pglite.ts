import { PGliteWorker } from "@electric-sql/pglite/worker";
import Worker from "./worker?worker";
import { live } from "@electric-sql/pglite/live";

const pg = await PGliteWorker.create(new Worker(), {
	dataDir: "idb://l1-chat-db",
	meta: {
		// additional metadata passed to `init`
	},
	extensions: {
		live,
	},
});

export default pg;
