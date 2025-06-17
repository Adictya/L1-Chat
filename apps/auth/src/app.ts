import { z } from "zod";
import { issuer } from "@openauthjs/openauth";

import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { subject, type User } from "l1-env";
import type { StorageAdapter } from "@openauthjs/openauth/storage/storage";

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
	const res = await fetch("https://api.github.com/user", {
		method: "GET",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${access_token}`,
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
		},
	});

	if (res.status !== 200) {
		throw new Error(`Bad response from github ${await res.text()}`);
	}

	const userInfoResponse = await res.json();

	const parsedUserResponse = GithubUser.parse(userInfoResponse);

	return parsedUserResponse;
};

const getApp = (storage: StorageAdapter, ghc: string, ghs: string) =>
	issuer({
		storage,
		providers: {
			github: GithubProvider({
				clientID: ghc,
				clientSecret: ghs,
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

export default getApp;
