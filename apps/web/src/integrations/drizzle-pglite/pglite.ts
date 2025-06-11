import { createPGLite } from "l1-db";
import Worker from "l1-db/worker?worker";

const pg = await createPGLite(new Worker());
export default pg;
