import { z } from "zod";
import { issuer } from "@openauthjs/openauth";
// import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { nanoid } from "nanoid";

import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { subject, type User } from "l1-env";

const storage = MemoryStorage({
	persist: "./auth.json",
});

export const GithubUser = z.object({
	login: z.string(),
	id: z.number(),
	// node_id: z.string(),
	// url: z.string(),
	// type: z.string(),
	name: z.string().nullable(),
	email: z.string().nullable(),
});
// https://avatars.githubusercontent.com/u/14136384?v=4

export type GithubUser = z.infer<typeof GithubUser>;

const getGithubUser = async (access_token: string) => {
	const userInfoResponse = await fetch("https://api.github.com/user", {
		method: "GET",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${access_token}`,
		},
	}).then((res) => res.json());

	const parsedUserResponse = GithubUser.parse(userInfoResponse);

	return parsedUserResponse;
};

const app = issuer({
	storage,
	providers: {
		github: GithubProvider({
			clientID: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
			scopes: ["user:email"],
		}),
	},
	subjects: subject,
	async success(ctx, value) {
		let user: User;
		if (value.provider === "github") {
			console.log(value.tokenset.access);
			const ghUser = await getGithubUser(value.tokenset.access);
			user = {
				userId: ghUser.login,
				username: ghUser.login,
				name: ghUser.name,
				email: ghUser.email,
			};
		} else {
			throw new Error("Provider not supported");
		}
		return ctx.subject("user", user);
	},
});

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

export default {
	fetch: app.fetch,
	port: 3002,
};
