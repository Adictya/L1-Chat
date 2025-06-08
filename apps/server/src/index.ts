import { z } from "zod";
import { issuer } from "@openauthjs/openauth";
// import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { nanoid } from "nanoid";

import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { subject, User } from "l1-env";

const storage = MemoryStorage({});

export const GithubUser = z.object({
	login: z.string(),
});

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
			const ghuser = await getGithubUser(value.tokenset.access);
			user = {
				userID: nanoid(4),
				username: ghuser.login,
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

export default app;
