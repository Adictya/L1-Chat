import ChatView from "@/components/Chat";
import { userDataStore } from "@/integrations/tanstack-store/user-data-store";
import {
	attachmentsStore,
	addAttachment,
} from "@/integrations/tanstack-store/attachments-store";
import { createFileRoute } from "@tanstack/react-router";
import { DragOverlay } from "@/components/DragOverlay";
import { storeFile } from "@/lib/indexed-db";
import { useState, useCallback } from "react";
import {
	addMessageDirect,
	createConversationDirect,
} from "@/integrations/tanstack-store/chats-store";
import type { Attachment, ChatMessage, Conversation } from "l1-db";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		try {
			const data = await fetch(`/api/get-user`, {
				credentials: "include",
			}).then((res) => res.json());
			console.log("Data", data);
			userDataStore.setState(data);

			const appData = await fetch(`/api/getData`, {
				credentials: "include",
			}).then((res) => res.json());
			console.log("Data", data);
			const { conversations, messages, attachments } = appData as {
				conversations: Conversation[];
				messages: ChatMessage[];
				attachments: Attachment[];
			};

			console.log("Conversations", conversations);
			console.log("Messages", messages);
			console.log("Attachments", attachments);

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
		} catch (e) {
			console.log("Error", e);
		}
	},
});

function App() {
	const [isDragging, setIsDragging] = useState(false);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(async (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = Array.from(e.dataTransfer.files);
		const validFiles = files.filter(
			(file) =>
				file.type.startsWith("image/") || file.type === "application/pdf",
		);

		for (const file of validFiles) {
			try {
				const fileId = await storeFile(file);
				console.log("Stored file with ID:", fileId);

				// Add the attachment to the store
				addAttachment({
					id: fileId,
					name: file.name,
					type: file.type,
					timestamp: Date.now(),
				});
			} catch (error) {
				console.error("Error storing file:", error);
			}
		}
	}, []);

	return (
		<div
			className="flex-1 flex"
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<ChatView />
			<DragOverlay isDragging={isDragging} />
		</div>
	);
}
