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
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { GitBranch, LogIn, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	useSubscribeConversations,
	type ConversationStore,
} from "@/integrations/tanstack-store/chats-store";
import { useStore } from "@tanstack/react-store";
import { client } from "@/integrations/openauth/auth";
import MessageLoading from "./ui/chat/message-loading";
import { userDataStore } from "@/integrations/tanstack-store/user-data-store";

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
					{conversation.branch && <GitBranch className="h-4 w-4" />}
					<span className="truncate">
						{conversation.title || "Untitled Chat"}
					</span>
					{conversation.generating && (
						<div className="ml-auto scale-75">
							<MessageLoading />
						</div>
					)}
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function AppSidebar() {
	const conversations = useSubscribeConversations();
	const matchRoute = useMatchRoute();

	const user = useStore(userDataStore);

	const isPathActive = (itemUrl: string, exactMatch = false): boolean => {
		return !!matchRoute({ to: itemUrl, fuzzy: !exactMatch });
	};

	return (
		<>
			<Sidebar>
				<SidebarContent className="flex flex-col h-full max-h-screen pt-14">
					<div className="px-2">
						<Button asChild className="w-full mb-2" variant="default">
							<Link to="/">Create chat</Link>
						</Button>
					</div>
					<SidebarGroup className="flex-1">
						<SidebarGroupLabel>Chats</SidebarGroupLabel>
						<SidebarGroupContent className="flex flex-1 basis-0 overflow-y-auto">
							<SidebarMenu className="flex-1 basis-0">
								{conversations.map((conversationStore) => (
									<ConversationItem
										key={conversationStore.state.id}
										conversationStore={conversationStore}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarSeparator className="max-w-[calc(100%-1rem)]" />
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu className="pb-2">
								{!user.userId ? (
									<SidebarMenuItem className="flex flex-row gap-2">
										<Button
											onClick={async () => {
												window.location.href = "/login";
											}}
											variant="outline"
											className="flex-1"
										>
											<LogIn className="h-4" />
											<span>Log In</span>
										</Button>
										<Button
											onClick={async () => {
												window.location.href = "/login";
											}}
											variant="outline"
											size="icon"
											asChild
										>
											<Link to="/settings" className="flex flex-row gap-2">
												<Settings className="h-4" />
											</Link>
										</Button>
									</SidebarMenuItem>
								) : (
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={isPathActive("/settings")}
										>
											<Link to="/settings" className="flex flex-row gap-2">
												<span className="text-lg">{user.username}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
			<div className="fixed top-4 left-4 z-50">
				<SidebarTrigger className="bg-background shadow-lg hover:bg-accent" />
			</div>
		</>
	);
}
