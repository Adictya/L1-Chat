import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	Link,
	useLocation,
	useMatchRoute,
} from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useSubscribeConversations } from "@/integrations/drizzle-pglite/actions";

export function AppSidebar() {
	const conversations = useSubscribeConversations();

	const matchRoute = useMatchRoute();

	const isPathActive = (itemUrl: string, exactMatch = false): boolean => {
		return !!matchRoute({ to: itemUrl, fuzzy: !exactMatch });
	};

	return (
		<Sidebar>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Chats</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{conversations.map((conv) => {
								const isActive = isPathActive(`/chats/${conv.id}`);
								return (
									<SidebarMenuItem key={conv.id}>
										<SidebarMenuButton asChild isActive={isActive}>
											<Link
												to="/chats/$conversationId"
												params={{ conversationId: conv.id.toString() }}
											>
												<MessageSquare className="h-4 w-4" />
												<span>{conv.title || "Untitled Chat"}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
