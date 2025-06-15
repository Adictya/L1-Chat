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
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router";
import { GitBranch, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	useSubscribeConversations,
	type ConversationStore,
} from "@/integrations/tanstack-store/chats-store";
import { useStore } from "@tanstack/react-store";

function ConversationItem({
	conversationStore,
}: { conversationStore: ConversationStore }) {
	const conversation = useStore(conversationStore);
	const matchRoute = useMatchRoute();
	const isPathActive = (itemUrl: string, exactMatch = false): boolean => {
		return !!matchRoute({ to: itemUrl, fuzzy: !exactMatch });
	};
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={isPathActive(`/chats/${conversation.id}`)}
			>
				<Link
					to="/chats/$conversationId"
					params={{ conversationId: conversation.id.toString() }}
				>
					{ conversation.branch ? <GitBranch className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
					<span>{conversation.title || "Untitled Chat"}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

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
							<Link to="/">Create chat</Link>
						</Button>
					</div>
					<SidebarGroup>
						<SidebarGroupLabel>Chats</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{conversations.map((conversationStore) => (
									<ConversationItem
										key={conversationStore.state.id}
										conversationStore={conversationStore}
									/>
								))}
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
									<SidebarMenuButton
										asChild
										isActive={isPathActive("/settings")}
									>
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
