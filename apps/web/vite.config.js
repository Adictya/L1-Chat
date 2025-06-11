import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";
import { warn } from "node:console";

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		port: 3001,
	},
	plugins: [
		TanStackRouterVite({ autoCodeSplitting: true }),
		viteReact(),
		tailwindcss(),
	],
	optimizeDeps: {
		exclude: ["@electric-sql/pglite"],
	},
	test: {
		globals: true,
		environment: "jsdom",
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	worker: {
		format: "es",
		plugins: [viteReact()],
	},
});
