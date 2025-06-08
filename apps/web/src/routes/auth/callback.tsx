import { client, redirect_uri } from "@/integrations/openauth/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { subject } from "l1-env";

const searchSchema = z.object({
	code: z.string(),
});

export const Route = createFileRoute("/auth/callback")({
	component: RouteComponent,
	validateSearch: (search) => searchSchema.parse(search),
	beforeLoad: ({ search }) => {
		return { search };
	},
	loader: async ({ context }) => {
		const tokens = await client.exchange(context.search.code, redirect_uri);

		if (!!tokens.err) {
			throw redirect({
				to: "/",
			});
		}

		const verified = await client.verify(subject, tokens.tokens.access);

		if (!!verified.err) {
			throw redirect({
				to: "/",
			});
		}

		return verified.subject;
	},
	pendingComponent: () => {
		return <div>Authenticating...</div>;
	},
});

function RouteComponent() {
	const user = Route.useLoaderData();

	return <div>User:{JSON.stringify(user?.properties)}</div>;
}
