import ChatView from "@/components/Chat";
import { addAttachment } from "@/integrations/tanstack-store/attachments-store";
import { createFileRoute } from "@tanstack/react-router";
import { DragOverlay } from "@/components/DragOverlay";
import { storeFile } from "@/lib/indexed-db";
import { useState, useCallback } from "react";

export const Route = createFileRoute("/")({
	component: App,
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
