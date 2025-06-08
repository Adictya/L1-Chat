import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { SiteHeader } from "../components/Header";

import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

import type { QueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/AppSidebar.tsx";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar.tsx";

interface MyRouterContext {
	queryClient: QueryClient;
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
			<TanStackRouterDevtools />
			<TanStackQueryLayout />
		</>
	),
});
