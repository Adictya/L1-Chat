import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import getApp from "./src/app.ts";

const storage = CloudflareStorage({ namespace: "l1-auth" });

const App = getApp(storage);

// import { Hono } from 'hono'
// const App = new Hono()
//
// App.get('/', (c) => c.text('Hello Cloudflare Workers!'))

export default App;
