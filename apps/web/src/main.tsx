// import { scan } from "react-scan"; // must be imported before React and React DOM
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { PGliteProvider } from "@electric-sql/pglite-react";

import * as TanStackQueryProvider from "./integrations/tanstack-query/root-provider.tsx";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./styles.css";
import reportWebVitals from "./reportWebVitals.ts";
// import pg from "./integrations/drizzle-pglite/pglite.ts";
// import { PopulateConversations } from "./integrations/tanstack-store/chats-store.ts";
import { AuthProvider, client } from "./integrations/openauth/auth.tsx";

// Create a new router instance
const router = createRouter({
	routeTree,
	context: {
		...TanStackQueryProvider.getContext(),
		authClient: client,
	},
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
});

// await PopulateConversations(pg);

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<TanStackQueryProvider.Provider>
				<AuthProvider>
					<RouterProvider router={router} />
				</AuthProvider>
			</TanStackQueryProvider.Provider>
		</StrictMode>,
	);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
// scan({
//   enabled: true,
// });
