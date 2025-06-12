import { createPGLite } from "l1-db";
import Worker from "l1-db/worker?worker";
import settingsStore from "../tanstack-store/settings-store";

const pg = await createPGLite(new Worker(), settingsStore.state.google.apiKey);
export default pg;
