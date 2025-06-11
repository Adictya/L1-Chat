// import { nanoid } from "nanoid/non-secure";

// Types for RPC communication
type RpcMethod = string;
type RpcArgs = any[];
type RpcResult = any;

type RpcCall = {
	type: "rpc-call";
	callId: string;
	method: RpcMethod;
	args: RpcArgs;
};

type RpcResponse = {
	type: "rpc-return";
	callId: string;
	result: RpcResult;
};

type RpcError = {
	type: "rpc-error";
	callId: string;
	error: { message: string };
};

type RpcMessage = RpcCall | RpcResponse | RpcError;

const LOGGING_ENABLED = true;

const logger = (...args: any[]) => {
	if (LOGGING_ENABLED) console.log(...args);
};

// Worker class that handles RPC and leader election
export class SyncWorker implements AsyncDisposable {
	#initPromise: Promise<void>;
	#ready = false;
	#closed = false;
	#isLeader = false;
	#eventTarget = new EventTarget();
	#tabId: string;
	#connected = false;
	#workerProcess: Worker;
	#workerID?: string;
	#workerHerePromise?: Promise<void>;
	#workerReadyPromise?: Promise<void>;
	#broadcastChannel?: BroadcastChannel;
	#tabChannel?: BroadcastChannel;
	#releaseTabCloseLock?: () => void;

	constructor(worker: Worker, id: string) {
		this.#workerProcess = worker;
		this.#tabId = crypto.randomUUID();
    console.log("Worker recieved")

		// Wait for worker to signal it's ready
		this.#workerHerePromise = new Promise<void>((resolve) => {
			this.#workerProcess.addEventListener(
				"message",
				(event) => {
					if (event.data.type === "here") {
						resolve();
					} else {
						throw new Error("Invalid message");
					}
				},
				{ once: true },
			);
		});

		// Wait for worker to be fully initialized
		this.#workerReadyPromise = new Promise<void>((resolve) => {
			const callback = (event: MessageEvent<any>) => {
				if (event.data.type === "ready") {
					this.#workerID = event.data.id;
					this.#workerProcess.removeEventListener("message", callback);
					resolve();
				}
			};
			this.#workerProcess.addEventListener("message", callback);
		});

		this.#initPromise = this.#init(id);
	}

	async #init(id: string) {
		// Wait for worker to signal it's here
		await this.#workerHerePromise;

		// Send initialization options to worker
		this.#workerProcess.postMessage({
			type: "init",
			options: {
				id,
			},
		});

		// Wait for worker to be ready
		await this.#workerReadyPromise;

		// Acquire tab close lock
		const tabCloseLockId = `l1-sync-tab-close:${this.#tabId}`;
		this.#releaseTabCloseLock = await acquireLock(tabCloseLockId);

		// Setup broadcast channels
		const broadcastChannelId = `l1-sync-broadcast:${this.#workerID}`;
		this.#broadcastChannel = new BroadcastChannel(broadcastChannelId);

		const tabChannelId = `l1-sync-tab:${this.#tabId}`;
		this.#tabChannel = new BroadcastChannel(tabChannelId);

		// Setup message handlers
		this.#broadcastChannel.addEventListener("message", async (event) => {
			if (event.data.type === "leader-here") {
				this.#connected = false;
				this.#eventTarget.dispatchEvent(new Event("leader-change"));
				this.#leaderNotifyLoop();
			}
		});

		this.#tabChannel.addEventListener("message", async (event) => {
			if (event.data.type === "connected") {
				this.#connected = true;
				this.#eventTarget.dispatchEvent(new Event("connected"));
				this.#ready = true;
			}
		});

		this.#workerProcess.addEventListener("message", async (event) => {
			if (event.data.type === "leader-now") {
				this.#isLeader = true;
				this.#eventTarget.dispatchEvent(new Event("leader-change"));
			}
		});

		this.#leaderNotifyLoop();
	}

	async #leaderNotifyLoop() {
		if (!this.#connected) {
			this.#broadcastChannel!.postMessage({
				type: "tab-here",
				id: this.#tabId,
			});
			setTimeout(() => this.#leaderNotifyLoop(), 16);
		}
	}

	async #rpc<Method extends RpcMethod>(
		method: Method,
		...args: RpcArgs
	): Promise<RpcResult> {
		const callId = crypto.randomUUID();
		const message: RpcCall = {
			type: "rpc-call",
			callId,
			method,
			args,
		};
		this.#tabChannel!.postMessage(message);
		return await new Promise<RpcResult>((resolve, reject) => {
			const listener = (event: MessageEvent) => {
				if (event.data.callId !== callId) return;
				cleanup();
				const message: RpcResponse | RpcError = event.data;
				if (message.type === "rpc-return") {
					resolve(message.result);
				} else if (message.type === "rpc-error") {
					const error = new Error(message.error.message);
					Object.assign(error, message.error);
					reject(error);
				} else {
					reject(new Error("Invalid message"));
				}
			};
			const leaderChangeListener = () => {
				cleanup();
				reject(new LeaderChangedError());
			};
			const cleanup = () => {
				this.#tabChannel!.removeEventListener("message", listener);
				this.#eventTarget.removeEventListener(
					"leader-change",
					leaderChangeListener,
				);
			};
			this.#eventTarget.addEventListener("leader-change", leaderChangeListener);
			this.#tabChannel!.addEventListener("message", listener);
		});
	}

	get waitReady() {
		return new Promise<void>((resolve) => {
			this.#initPromise.then(() => {
				if (!this.#connected) {
					resolve(
						new Promise<void>((resolve) => {
							this.#eventTarget.addEventListener("connected", () => {
								resolve();
							});
						}),
					);
				} else {
					resolve();
				}
			});
		});
	}

	get ready() {
		return this.#ready;
	}

	get closed() {
		return this.#closed;
	}

	get isLeader() {
		return this.#isLeader;
	}

	async close() {
		if (this.#closed) {
			return;
		}
		this.#closed = true;
		this.#broadcastChannel?.close();
		this.#tabChannel?.close();
		this.#releaseTabCloseLock?.();
		this.#workerProcess.terminate();
	}

	async [Symbol.asyncDispose]() {
		await this.close();
	}

	onLeaderChange(callback: () => void) {
		this.#eventTarget.addEventListener("leader-change", callback);
		return () => {
			this.#eventTarget.removeEventListener("leader-change", callback);
		};
	}

	offLeaderChange(callback: () => void) {
		this.#eventTarget.removeEventListener("leader-change", callback);
	}

	// Add your custom RPC methods here
	async customRpcMethod(...args: any[]) {
		return await this.#rpc("customRpcMethod", ...args);
	}
}

export class LeaderChangedError extends Error {
	constructor() {
		super("Leader changed, pending operation in indeterminate state");
	}
}

async function acquireLock(lockId: string) {
	let release;
	await new Promise<void>((resolve) => {
		navigator.locks.request(lockId, () => {
			return new Promise<void>((releaseCallback) => {
				release = releaseCallback;
				resolve();
			});
		});
	});
	return release;
}

// Worker initialization function
export async function worker() {
	logger("[Worker] Initializing...");
	console.log("[Worker] Initializing...");
	// Signal that worker is ready
	postMessage({ type: "here" });

	// Wait for initialization options
	logger("[Worker] Waiting for initialization options...");
	const options = await new Promise<any>((resolve) => {
		addEventListener(
			"message",
			(event) => {
				if (event.data.type === "init") {
					resolve(event.data.options);
				}
			},
			{ once: true },
		);
	});

	logger("[Worker] Received options:", options);

	// Generate worker ID
	const id = options.id ?? `${import.meta.url}`;
	logger(`[Worker] Generated ID: ${id}`);

	// Signal ready state
	postMessage({ type: "ready", id });
	logger("[Worker] Signaled ready state.");
	// Setup leader election
	const electionLockId = `l1-sync-election-lock:${id}`;
	const broadcastChannelId = `l1-sync-broadcast:${id}`;
	const broadcastChannel = new BroadcastChannel(broadcastChannelId);
	const connectedTabs = new Set<string>();

	// Acquire leader lock
	logger(`[Worker] Attempting to acquire leader lock: ${electionLockId}`);
	await acquireLock(electionLockId);
	logger(`[Worker] Acquired leader lock: ${electionLockId}`);

	// Handle tab connections
	broadcastChannel.onmessage = async (event) => {
		const msg = event.data;
		if (msg.type === "tab-here") {
			logger(`[Worker] Received tab-here from: ${msg.id}`);
			connectTab(msg.id, connectedTabs);
		}
	};

	// Announce leadership
	logger("[Worker] Announcing leadership...");
	broadcastChannel.postMessage({ type: "leader-here", id });
	postMessage({ type: "leader-now" });
	logger("[Worker] Announced leadership and sent leader-now.");

	// Handle RPC calls
	function handleRpcCall(tabId: string, msg: RpcCall) {
		logger(`[Worker] Handling RPC call for tab ${tabId}:`, msg.method, msg.args);
		const tabChannel = new BroadcastChannel(`l1-sync-tab:${tabId}`);

		// Process RPC call and send response
		// Add your custom RPC method handlers here
		if (msg.method === "customRpcMethod") {
			// Handle custom RPC method
			logger(`[Worker] Executing customRpcMethod for callId: ${msg.callId}`);
			tabChannel.postMessage({
				type: "rpc-return",
				callId: msg.callId,
				result: "Custom RPC result",
			});
		} else {
			logger(`[Worker] Method not found for callId: ${msg.callId}`, msg.method);
			tabChannel.postMessage({
				type: "rpc-error",
				callId: msg.callId,
				error: { message: "Method not found" },
			});
		}
	}

	function connectTab(tabId: string, connectedTabs: Set<string>) {
		logger(`[Worker] connectTab called for tabId: ${tabId}`);
		if (connectedTabs.has(tabId)) {
			logger(`[Worker] Tab ${tabId} already connected.`);
			return;
		}
		connectedTabs.add(tabId);
		logger(`[Worker] Added tab ${tabId} to connectedTabs.`);
		const tabChannelId = `l1-sync-tab:${tabId}`;
		const tabCloseLockId = `l1-sync-tab-close:${tabId}`;
		const tabChannel = new BroadcastChannel(tabChannelId);

		// Handle tab closure
		navigator.locks.request(tabCloseLockId, () => {
			logger(`[Worker] Lock acquired for tab closure: ${tabCloseLockId}. Cleaning up tab ${tabId}.`);
			return new Promise<void>((resolve) => {
				tabChannel.close();
				connectedTabs.delete(tabId);
				logger(`[Worker] Tab ${tabId} closed and removed from connectedTabs.`);
				resolve();
			});
		});

		// Handle RPC messages
		tabChannel.addEventListener("message", async (event) => {
			const msg = event.data;
			if (msg.type === "rpc-call") {
				logger(`[Worker] Received rpc-call from tab ${tabId}:`, msg.method);
				handleRpcCall(tabId, msg);
			}
		});

		// Signal connection
		tabChannel.postMessage({ type: "connected" });
		logger(`[Worker] Signaled 'connected' to tab ${tabId}.`);
	}
}
