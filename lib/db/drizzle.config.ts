import type { Config } from "drizzle-kit";

export default {
	schema: "./src/schema.ts",
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: "",
	},
} satisfies Config;
