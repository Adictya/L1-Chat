import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { SiteHeader } from "../components/Header";

import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

import type { QueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/AppSidebar.tsx";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar.tsx";
// import type { SyncWorker } from "@/sync/worker.ts";
// import type { PGliteWorker } from "@electric-sql/pglite/worker";
import type { PGliteWithLive } from "@electric-sql/pglite/live";

interface MyRouterContext {
	queryClient: QueryClient;
	// syncWorker: SyncWorker;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => (
		<>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<SiteHeader />
					<div className="flex-1 flex">
						<Outlet />
					</div>
				</SidebarInset>
			</SidebarProvider>
			<TanStackRouterDevtools position="top-right" />
			<TanStackQueryLayout />
		</>
	),
});
