import { Calendar, Home, Inbox, Search, Settings } from "lucide-react";

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
import { Link, useRouter } from "@tanstack/react-router";
import { useLiveQuery } from "@electric-sql/pglite-react";
import { type Conversation, conversation } from "l1-db/schema";
import db from "l1-db/db";
import { MessageSquare } from "lucide-react";

export function AppSidebar() {
	const router = useRouter();
	const conversations = useLiveQuery<Conversation>(
		db.select().from(conversation).orderBy(conversation.createdAt).toSQL().sql,
	);

	return (
		<Sidebar>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Chats</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{conversations?.rows.map((conv) => {
								const isActive = router.state.location.pathname === `/chats/${conv.id}`;
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
