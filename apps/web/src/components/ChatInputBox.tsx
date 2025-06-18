import React, { useEffect, useRef, useState } from "react";
import { ChatInput } from "./ui/chat/chat-input";
import { Button } from "./ui/button";
import {
	ArrowBigUpDash,
	ArrowDown,
	Brain,
	Command,
	CornerDownLeft,
	Globe,
	Paperclip,
	Send,
	Square,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
	ModelsInfo,
	PerAvailableModelProvidersList,
	ProvidersInfo,
	type ModelsEnum,
	type ProvidersEnum,
} from "@/integrations/tanstack-store/models-store";
import {
	selectedModelPreferencesStore,
	updateSelectedModelPreferences,
} from "@/integrations/tanstack-store/settings-store";
import { Store, useStore } from "@tanstack/react-store";
import settingsStore from "@/integrations/tanstack-store/settings-store";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
	addMessage,
	createConversation,
	generateResponse,
	type ChatMessageStore,
} from "@/integrations/tanstack-store/chats-store";
import { scrollToBottom } from "./ui/chat/hooks/useAutoScroll";
import { useNavigate } from "@tanstack/react-router";
import {
	attachmentsStore,
	addAttachment,
	removeAttachment,
	markAttachmentsAsSent,
	type Attachment,
} from "@/integrations/tanstack-store/attachments-store";
import { AttachmentPreview } from "./AttachmentPreview";
import { useMutation } from "@tanstack/react-query";
import { getFile, storeFile, type StoredFile } from "@/lib/indexed-db";
import { Textarea } from "./ui/textarea";

export const isAutoScrollEnabled = new Store<boolean>(true);

const IsAtBottomButton = ({
	scrollRef,
}: {
	scrollRef: React.RefObject<HTMLDivElement | null>;
}) => {
	// const autoScrollEnabled = useStore(isAutoScrollEnabled);
	const [isAtBottom, setIsAtBottom] = useState(true);

	useEffect(() => {
		const checkIsAtBottom = (element: Element) => {
			const { scrollTop, scrollHeight, clientHeight } = element;
			const distanceToBottom = Math.abs(
				scrollHeight - scrollTop - clientHeight,
			);
			return distanceToBottom <= 60;
		};
		scrollRef?.current?.addEventListener("scrollend", (e) => {
			if (!scrollRef?.current) return;
			if (checkIsAtBottom(scrollRef.current)) {
				isAutoScrollEnabled.setState(true);
				setIsAtBottom(true);
			} else {
				isAutoScrollEnabled.setState(false);
				setIsAtBottom(false);
			}
		});
		if (scrollRef?.current) {
			setIsAtBottom(checkIsAtBottom(scrollRef.current));
		}
	}, [setIsAtBottom, scrollRef]);

	if (isAtBottom) {
		return null;
	}

	return (
		<Button
			onClick={() => {
				scrollRef?.current && scrollToBottom(scrollRef.current);
			}}
			variant="outline"
			className="absolute top-[-50px] left-[50%] transform -translate-x-1/2 inline-flex rounded-full shadow-md !bg-card"
			aria-label="Scroll to bottom"
		>
			Scroll to bottom <ArrowDown className="h-4 w-4" />
		</Button>
	);
};

export default function ChatInputBox({
	conversationId,
	scrollRef,
}: {
	conversationId?: string;
	scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const selectedModelPreferences = useStore(selectedModelPreferencesStore);
	const unsentAttachments = useStore(attachmentsStore, (state) =>
		state.filter((attachment) => !attachment.sent),
	);

	const capabilities =
		ModelsInfo[selectedModelPreferences.model]?.providers[
			selectedModelPreferences.provider
		]?.capabilities;

	useEffect(() => {
		scrollRef?.current && scrollToBottom(scrollRef.current, "instant");
	}, [conversationId, scrollRef]);

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
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
		e.target.value = "";
	};

	const handleRemoveAttachment = (id: string) => {
		removeAttachment(id);
	};

	const handleSend = async () => {
		const input = inputRef.current?.value || "";
		if (inputRef.current) {
			inputRef.current.value = "";
		}
		if (input.trim() === "") {
			return;
		}

		const title = input.slice(0, 30) || "New Chat";
		const convId = conversationId || createConversation(title);

		// Upload all attachments first
		const uploadedAttachments = await Promise.all(
			unsentAttachments.map(async (attachment: Attachment) => {
				const file = await getFile(attachment.id);
				if (!file) return null;

				const formData = new FormData();
				formData.append(
					"file",
					new File([file.data], file.name, { type: file.type }),
				);
				formData.append("conversationId", convId);
				formData.append("id", attachment.id);

				// TODO: env
				const response = await fetch(`/api/upload`, {
					method: "POST",
					body: formData,
					credentials: "include",
				});

				if (!response.ok) {
					throw new Error("Failed to upload attachment");
				}

				return attachment.id;
			}),
		);

		// Add the message with attachments
		addMessage(convId, {
			role: "user",
			message: input,
			conversationId: convId,
			meta_tokens: 0,
			attachments: uploadedAttachments.map((id) => id as string),
		});

		markAttachmentsAsSent(uploadedAttachments.map((id) => id as string));

		scrollRef?.current && scrollToBottom(scrollRef.current, "smooth");

		if (!conversationId) {
			navigate({ to: `/chats/${convId}` });
		}

		generateResponse(convId);
	};

	return (
		<div className="flex relative items-center justify-center pb-4">
			<IsAtBottomButton scrollRef={scrollRef} />
			<div className="flex flex-col flex-1 items-center border-1 border-t-6 pt-2 rounded-sm max-w-3xl mx-2">
				{unsentAttachments?.length > 0 && (
					<div className="flex gap-2 w-full px-2 py-1 overflow-x-auto">
						{unsentAttachments.map((attachment) => (
							<AttachmentPreview
								key={attachment.id}
								attachment={attachment}
								onRemove={handleRemoveAttachment}
							/>
						))}
					</div>
				)}
				<ChatInput
					placeholder="Type your message here..."
					ref={inputRef}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							handleSend();
						}
					}}
					onPaste={async (e) => {
						const items = e.clipboardData?.items;
						if (!items) return;

						const files: File[] = [];
						for (const item of items) {
							if (item.kind === "file") {
								const file = item.getAsFile();
								if (
									file &&
									(["image/png", "image/jpg"].includes(file.type) ||
										file.type === "application/pdf")
								) {
									files.push(file);
								}
							}
						}

						for (const file of files) {
							try {
								const fileId = await storeFile(file);
								console.log("Stored pasted file with ID:", fileId);

								addAttachment({
									id: fileId,
									name: file.name,
									type: file.type,
									timestamp: Date.now(),
								});
							} catch (error) {
								console.error("Error storing pasted file:", error);
							}
						}
					}}
					className="flex-1 p-2 text-lg! bg-background! border-0! focus:ring-ring/0!"
				/>
				<div className="flex w-full h-8 items-center text-sm border-t-border border-t-2 bg-muted">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex h-full items-center gap-2 px-2 border-r-2"
							>
								<div>{ModelsInfo[selectedModelPreferences.model].name}</div>
								<div className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
									<Command size={10} />
									<ArrowBigUpDash size={14} /> M
								</div>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{PerAvailableModelProvidersList.map(([providerId, models]) => (
								<React.Fragment key={providerId}>
									<DropdownMenuLabel>
										{ProvidersInfo[providerId as ProvidersEnum].name}
									</DropdownMenuLabel>
									{models.map((model) => (
										<DropdownMenuItem
											key={model.id}
											onClick={() =>
												updateSelectedModelPreferences(model.id, providerId)
											}
										>
											{model.name}
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
								</React.Fragment>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					{capabilities?.reasoning && (
						<Tooltip>
							<TooltipTrigger
								asChild
								className="bg-card flex h-full items-center gap-2 px-2 border-r-2 "
							>
								<button
									type="button"
									onClick={() =>
										updateSelectedModelPreferences(undefined, undefined, {
											reasoningEffort:
												selectedModelPreferences.settings.reasoningEffort ===
												"low"
													? "medium"
													: selectedModelPreferences.settings
																.reasoningEffort === "medium"
														? "high"
														: "low",
										})
									}
								>
									<Brain size={14} />
									{selectedModelPreferences.settings.reasoningEffort
										?.at(0)
										?.toLocaleUpperCase()}
									{selectedModelPreferences.settings.reasoningEffort
										?.slice(1)
										.toLowerCase()}
								</button>
							</TooltipTrigger>
							<TooltipContent className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
								<Command size={10} />
								<ArrowBigUpDash size={14} /> M
							</TooltipContent>
						</Tooltip>
					)}
					{capabilities?.search && (
						<Tooltip>
							<TooltipTrigger
								asChild
								className={`${selectedModelPreferences.settings.search ? "bg-primary/80" : "bg-card"} flex h-full items-center gap-2 px-2 border-r-2`}
							>
								<button
									type="button"
									onClick={() =>
										updateSelectedModelPreferences(undefined, undefined, {
											search:
												!selectedModelPreferencesStore.state.settings.search,
										})
									}
								>
									<Globe size={14} />
								</button>
							</TooltipTrigger>
							<TooltipContent className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
								<Command size={10} />
								<ArrowBigUpDash size={14} /> M
							</TooltipContent>
						</Tooltip>
					)}
					<div className="flex h-full items-center ml-auto">
						<Tooltip>
							<TooltipTrigger
								asChild
								className="flex h-full items-center gap-2 px-2 border-l-2"
							>
								<div>
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleFileSelect}
										accept="image/jpg,image/png,.pdf"
										multiple
										className="hidden"
									/>
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
									>
										<Paperclip size={14} />
									</button>
								</div>
							</TooltipTrigger>
							<TooltipContent className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
								Attach files
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger
								asChild
								className="flex h-full items-center gap-2 px-2 pl-3 border-l-2"
							>
								<button type="button" onClick={handleSend}>
									Send
									<div className="flex items-center gap-1 text-xs font-bold p-1">
										<CornerDownLeft size={10} />
									</div>
								</button>
							</TooltipTrigger>
							<TooltipContent className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
								Send the message
							</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</div>
		</div>
	);
}
