import { SyncWorker } from "../../sync/worker";
import Worker from "../../sync/workering?worker";

const worker_id = "abcdefghijklmnopqrstuvwxyz";

/**
 * Spawns a new SyncWorker instance with a dedicated worker thread.
 * @returns A promise that resolves to a SyncWorker instance
 */
export async function spawnSyncWorker(): Promise<SyncWorker> {
	// Create a new worker from the worker.ts file
	console.log("Starting worker");
	const worker = new Worker();
	console.log("Started worker");

	// Create and return the SyncWorker instance
	const syncWorker = new SyncWorker(worker, worker_id);
	console.log("Started worker instance");

	// Wait for the worker to be ready before returning
	await syncWorker.waitReady;
	console.log("Worker ready");

	return syncWorker;
}
