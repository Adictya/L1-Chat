import ChatView from "@/components/Chat";
import { userDataStore } from "@/integrations/tanstack-store/user-data-store";
import { attachmentsStore, addAttachment } from "@/integrations/tanstack-store/attachments-store";
import { createFileRoute } from "@tanstack/react-router";
import { DragOverlay } from "@/components/DragOverlay";
import { storeFile } from "@/lib/indexed-db";
import { useState, useCallback } from "react";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		try {
			const data = await fetch("http://localhost:3000/get-user", {
				credentials: "include",
			}).then((res) => res.json());
			console.log("Data", data);
			userDataStore.setState(data);
		} catch (e) {
			console.log("Error", e);
		}

		// const { conversations, messages } = data;
		//
		// console.log("Conversations", conversations);
		// console.log("Messages", messages);
		//
		// for (const conversation of conversations) {
		// 	createConversationDirect(conversation.data);
		// }
		// for (const message of messages) {
		// 	addMessageDirect(message.conversationId, message.data);
		// }
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
				file.type.startsWith("image/") || file.type === "application/pdf"
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
