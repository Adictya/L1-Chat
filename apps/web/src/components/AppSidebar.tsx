import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import {
	Link,
	useLocation,
	useMatchRoute,
} from "@tanstack/react-router";
import { MessageSquare, Settings } from "lucide-react";
import { useSubscribeConversations } from "@/integrations/drizzle-pglite/actions";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
	const conversations = useSubscribeConversations();

	const matchRoute = useMatchRoute();

	const isPathActive = (itemUrl: string, exactMatch = false): boolean => {
		return !!matchRoute({ to: itemUrl, fuzzy: !exactMatch });
	};

	return (
		<Sidebar>
			<SidebarContent className="flex flex-col h-full">
				<div className="flex-1 flex flex-col">
					<div className="p-2">
						<Button asChild className="w-full mb-2" variant="default">
							<Link to="/">
								Create chat
							</Link>
						</Button>
					</div>
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
				</div>

				<SidebarSeparator />

				<div>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild isActive={isPathActive("/settings")}> 
										<Link to="/settings">
											<Settings className="h-4 w-4" />
											<span>Settings</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</div>
			</SidebarContent>
		</Sidebar>
	);
}
