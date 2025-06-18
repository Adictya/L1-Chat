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
import { GitBranch, LogIn, LogOut, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	useSubscribeConversations,
	type ConversationStore,
} from "@/integrations/tanstack-store/chats-store";
import { useStore } from "@tanstack/react-store";
import { client } from "@/integrations/openauth/auth";
import MessageLoading from "./ui/chat/message-loading";
import { userDataStore } from "@/integrations/tanstack-store/user-data-store";
import { u } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
				className={cn(
					"flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm transition-colors",
					isPathActive(`/chats/${conversation.id}`)
						? "bg-primary/80 text-primary-foreground"
						: "hover:bg-muted",
				)}
			>
				<Link
					to="/chats/$conversationId"
					preload={false}
					params={{ conversationId: conversation.id.toString() }}
					className="flex items-center gap-2 w-full"
				>
					{conversation.branch && <GitBranch className="h-4 w-4" />}
					<span className="truncate flex-1">
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

	const handleLogout = async () => {
		try {
			await fetch(u("/logout"), {
				credentials: "include",
			});
			window.location.href = u("/login");
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	return (
		<>
			<Sidebar>
				<SidebarContent className="flex flex-col h-full max-h-screen pt-14">
					<div className="px-2">
						<Button className="w-full mb-4 gap-2" variant="outline" asChild>
							<Link to="/" preload={false} className="flex items-center">
								<Plus className="h-4 w-4" />
								Create chat
							</Link>
						</Button>
					</div>
					<SidebarGroup className="flex-1">
						<SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground">
							Chats
						</SidebarGroupLabel>
						<SidebarGroupContent className="flex flex-1 basis-0 overflow-y-auto mt-2">
							<SidebarMenu className="flex-1 basis-0 px-1 space-y-1">
								{conversations.map((conversationStore) => (
									<ConversationItem
										key={conversationStore.state.id}
										conversationStore={conversationStore}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarSeparator className="my-2" />
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu className="px-2 pb-4">
								{!user.userId ? (
									<Button
										onClick={async () => {
											window.location.href = u("/login");
										}}
										variant="outline"
										className="w-full gap-2"
									>
										<LogIn className="h-4 w-4" />
										<span>Log In</span>
									</Button>
								) : (
									<div className="flex items-center gap-2">
										<Link
											to="/settings"
											preload={false}
											className={cn(
												"flex items-center gap-3 px-3 py-2 rounded-md flex-1",
												"hover:bg-muted transition-colors",
											)}
										>
											<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
												<User className="h-4 w-4" />
											</div>
											<div className="flex flex-col min-w-0">
												<span className="text-sm font-medium truncate">
													{user.username}
												</span>
											</div>
										</Link>
										<Button
											variant="ghost"
											size="icon"
											className="text-muted-foreground hover:text-foreground"
											onClick={handleLogout}
										>
											<LogOut className="h-4 w-4" />
										</Button>
									</div>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
			<div className="fixed top-4 left-4 z-50">
				<SidebarTrigger className="bg-background/80 backdrop-blur-sm shadow-lg hover:bg-accent rounded-md" />
			</div>
		</>
	);
}
