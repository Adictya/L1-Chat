import type { Config } from "drizzle-kit";

export default {
	schema: "../../lib/db-sqlite/src/schema.ts",
	out: "./migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: "",
	},
} satisfies Config;
