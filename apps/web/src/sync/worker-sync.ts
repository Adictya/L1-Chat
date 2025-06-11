// Types for sync communication
type SyncData = {
  type: string;
  payload: unknown;
};

type SyncMessage = {
  type: "sync";
  data: SyncData;
  senderId: string;
};

type WorkerMessage = {
  type: "sync" | "here" | "ready" | "init" | "leader-now" | "leader-here" | "connected" | "tab-here";
  data?: SyncData;
  id?: string;
  options?: { id: string };
};

// Worker class that handles sync between tabs
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
      const callback = (event: MessageEvent<WorkerMessage>) => {
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
      const msg = event.data as WorkerMessage;
      if (msg.type === "leader-here") {
        this.#connected = false;
        this.#eventTarget.dispatchEvent(new Event("leader-change"));
        this.#leaderNotifyLoop();
      } else if (msg.type === "sync") {
        // Forward sync messages to the main thread
        this.#eventTarget.dispatchEvent(
          new CustomEvent("sync", { detail: msg.data })
        );
      }
    });

    this.#tabChannel.addEventListener("message", async (event) => {
      const msg = event.data as WorkerMessage;
      if (msg.type === "connected") {
        this.#connected = true;
        this.#eventTarget.dispatchEvent(new Event("connected"));
        this.#ready = true;
      }
    });

    this.#workerProcess.addEventListener("message", async (event) => {
      const msg = event.data as WorkerMessage;
      if (msg.type === "leader-now") {
        this.#isLeader = true;
        this.#eventTarget.dispatchEvent(new Event("leader-change"));
      }
    });

    this.#leaderNotifyLoop();
  }

  async #leaderNotifyLoop() {
    if (!this.#connected && this.#broadcastChannel) {
      this.#broadcastChannel.postMessage({
        type: "tab-here",
        id: this.#tabId,
      });
      setTimeout(() => this.#leaderNotifyLoop(), 16);
    }
  }

  // Send sync data to all connected tabs
  async sync(data: SyncData) {
    if (!this.#tabChannel) {
      throw new Error("Worker not initialized");
    }
    this.#tabChannel.postMessage({
      type: "sync",
      data,
      senderId: this.#tabId,
    });
  }

  // Listen for sync events
  onSync(callback: (data: SyncData) => void) {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<SyncData>;
      callback(customEvent.detail);
    };
    this.#eventTarget.addEventListener("sync", handler);
    return () => {
      this.#eventTarget.removeEventListener("sync", handler);
    };
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
}

export class LeaderChangedError extends Error {
  constructor() {
    super("Leader changed, pending operation in indeterminate state");
  }
}

async function acquireLock(lockId: string): Promise<() => void> {
  let release: (() => void) | undefined;
  await new Promise<void>((resolve) => {
    navigator.locks.request(lockId, () => {
      return new Promise<void>((releaseCallback) => {
        release = releaseCallback;
        resolve();
      });
    });
  });
  if (!release) {
    throw new Error("Failed to acquire lock");
  }
  return release;
}

// Worker initialization function
export async function worker() {
  console.log("[Worker] Initializing...");
  // Signal that worker is ready
  postMessage({ type: "here" });

  // Wait for initialization options
  console.log("[Worker] Waiting for initialization options...");
  const options = await new Promise<{ id: string }>((resolve) => {
    addEventListener(
      "message",
      (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === "init" && event.data.options) {
          resolve(event.data.options);
        }
      },
      { once: true },
    );
  });

  console.log("[Worker] Received options:", options);

  // Generate worker ID
  const id = options.id ?? `${import.meta.url}`;
  console.log(`[Worker] Generated ID: ${id}`);

  // Signal ready state
  postMessage({ type: "ready", id });
  console.log("[Worker] Signaled ready state.");

  // Setup leader election
  const electionLockId = `l1-sync-election-lock:${id}`;
  const broadcastChannelId = `l1-sync-broadcast:${id}`;
  const broadcastChannel = new BroadcastChannel(broadcastChannelId);
  const connectedTabs = new Set<string>();

  // Acquire leader lock
  console.log(`[Worker] Attempting to acquire leader lock: ${electionLockId}`);
  await acquireLock(electionLockId);
  console.log(`[Worker] Acquired leader lock: ${electionLockId}`);

  // Handle tab connections
  broadcastChannel.onmessage = async (event) => {
    const msg = event.data as WorkerMessage;
    if (msg.type === "tab-here" && msg.id) {
      console.log(`[Worker] Received tab-here from: ${msg.id}`);
      connectTab(msg.id, connectedTabs);
    }
  };

  // Announce leadership
  console.log("[Worker] Announcing leadership...");
  broadcastChannel.postMessage({ type: "leader-here", id });
  postMessage({ type: "leader-now" });
  console.log("[Worker] Announced leadership and sent leader-now.");

  // Handle sync messages
  function handleSyncMessage(tabId: string, msg: SyncMessage) {
    console.log(`[Worker] Handling sync message from tab ${tabId}:`, msg.data);
    
    // Broadcast the sync message to all connected tabs except the sender
    for (const connectedTabId of connectedTabs) {
      if (connectedTabId !== tabId) {
        const tabChannel = new BroadcastChannel(`l1-sync-tab:${connectedTabId}`);
        tabChannel.postMessage({
          type: "sync",
          data: msg.data,
          senderId: tabId,
        });
      }
    }
  }

  function connectTab(tabId: string, connectedTabs: Set<string>) {
    console.log(`[Worker] connectTab called for tabId: ${tabId}`);
    if (connectedTabs.has(tabId)) {
      console.log(`[Worker] Tab ${tabId} already connected.`);
      return;
    }
    connectedTabs.add(tabId);
    console.log(`[Worker] Added tab ${tabId} to connectedTabs.`);
    const tabChannelId = `l1-sync-tab:${tabId}`;
    const tabCloseLockId = `l1-sync-tab-close:${tabId}`;
    const tabChannel = new BroadcastChannel(tabChannelId);

    // Handle tab closure
    navigator.locks.request(tabCloseLockId, () => {
      console.log(`[Worker] Lock acquired for tab closure: ${tabCloseLockId}. Cleaning up tab ${tabId}.`);
      return new Promise<void>((resolve) => {
        tabChannel.close();
        connectedTabs.delete(tabId);
        console.log(`[Worker] Tab ${tabId} closed and removed from connectedTabs.`);
        resolve();
      });
    });

    // Handle sync messages
    tabChannel.addEventListener("message", async (event) => {
      const msg = event.data as WorkerMessage;
      if (msg.type === "sync") {
        console.log(`[Worker] Received sync message from tab ${tabId}:`, msg.data);
        handleSyncMessage(tabId, msg as SyncMessage);
      }
    });

    // Signal connection
    tabChannel.postMessage({ type: "connected" });
    console.log(`[Worker] Signaled 'connected' to tab ${tabId}.`);
  }
}
