import { createClient } from "@openauthjs/openauth/client";

export const client = createClient({
	clientID: "my-client",
	issuer: "http://localhost:3000",
});

export const redirect_uri = "http://localhost:3001/auth/callback";
