import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { Attachment, ChatMessage, Conversation } from "l1-db";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

import type { QueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/AppSidebar.tsx";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar.tsx";
// import type { SyncWorker } from "@/sync/worker.ts";
// import type { PGliteWorker } from "@electric-sql/pglite/worker";
import type { Client } from "@openauthjs/openauth/client";
import {
	updateClaudeApiKey,
	updateGeminiApiKey,
	updateOpenAIApiKey,
	updateOpenRouterApiKey,
} from "@/integrations/tanstack-store/settings-store.ts";
import {
	addMessageDirect,
	createConversationDirect,
} from "@/integrations/tanstack-store/chats-store.ts";
import { addAttachment } from "@/integrations/tanstack-store/attachments-store.ts";
import { userDataStore } from "@/integrations/tanstack-store/user-data-store.ts";
import { u } from "@/lib/utils.ts";

interface MyRouterContext {
	queryClient: QueryClient;
	authClient: Client;
	// syncWorker: SyncWorker;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	loader: async () => {
		try {
			const data = await fetch(u("/api/get-user"), {
				credentials: "include",
			}).then((res) => res.json());
			console.log("Data", data);
			userDataStore.setState(data);

			const appData = await fetch(u("/api/getData"), {
				credentials: "include",
			}).then((res) => res.json());
			console.log("Data", data, appData);
			const { conversations, messages, attachments, apiKeys } = appData as {
				conversations: Conversation[];
				messages: ChatMessage[];
				attachments: Attachment[];
				apiKeys: string;
			};

			console.log("Conversations", conversations);
			console.log("Messages", messages);
			console.log("Attachments", attachments);
			console.log("Apikeys", apiKeys);

			for (const conversation of conversations.sort(
				(a, b) => b.updatedAt - a.updatedAt,
			)) {
				createConversationDirect(conversation);
			}
			for (const message of messages.sort(
				(a, b) => a.createdAt - b.createdAt,
			)) {
				addMessageDirect(message.conversationId, message);
			}
			for (const attachment of attachments) {
				if (attachment.sent) {
					addAttachment(attachment);
				}
			}
			if (apiKeys) {
				const [openai, google, anthropic, openrouter] = apiKeys.split(",");

				updateOpenAIApiKey(openai);
				updateGeminiApiKey(google);
				updateClaudeApiKey(anthropic);
				updateOpenRouterApiKey(openrouter);
			}

			// Fetch API keys from server and update settings store
			try {
				const apiKeysRes = await fetch(u("/api/apiKeys"), {
					credentials: "include",
				});
				if (apiKeysRes.ok) {
					const apiKeys = await apiKeysRes.json();
					updateOpenAIApiKey(apiKeys.openai || "");
					updateGeminiApiKey(apiKeys.google || "");
					updateClaudeApiKey(apiKeys.anthropic || "");
					updateOpenRouterApiKey(apiKeys.openrouter || "");
				}
			} catch (e) {
				console.log("Error fetching API keys", e);
			}
		} catch (e) {
			console.log("Error", e);
		}
	},
	component: () => (
		<>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<div className="flex-1 flex">
						<Outlet />
					</div>
				</SidebarInset>
			</SidebarProvider>
			{/* <TanStackRouterDevtools position="top-right" /> */}
			{/* <TanStackQueryLayout /> */}
		</>
	),
	preload: false,
});
