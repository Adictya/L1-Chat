import { useEffect, useRef, useState } from "react";
import { ChatMessageList } from "./ui/chat/chat-message-list";
import { ChatBubble, ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { Button } from "./ui/button";
import { Send, Square } from "lucide-react";
import { ChatInput } from "./ui/chat/chat-input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useChat } from "@ai-sdk/react";
import type { ChatMessage } from "l1-db";
import {
	smoothStream,
	streamText,
	type CoreMessage,
	type Provider,
	type UIMessage,
} from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import {
	createConversation,
	addMessage,
	updateMessage,
} from "@/integrations/drizzle-pglite/actions";
import { getSettings } from "@/integrations/tanstack-store/settings-store";
import {
	ModelsInfo,
	ProvidersInfo,
	type ModelsEnum,
	type ProvidersEnum,
	PerAvailableModelProvidersList,
} from "@/integrations/tanstack-store/models-store";
import { CodeHighlight } from "./CodeHighlighter";
import { useStreamText } from "@/hooks/use-stream-text";

const getPrompt = () => {
	return `
You are L1 Chat, an AI assistant powered by the Gemini 2.0 Flash model. Your role is to assist and engage in conversation while being helpful, respectful, and engaging.

If you are specifically asked about the model you are using, you may mention that you use the Gemini 2.5 Flash model. If you are not asked specifically about the model you are using, you do not need to mention it.
The current date and time including timezone is ${new Date().toISOString()}.

Ensure code is properly formatted using Prettier with a print width of 80 characters
Present code in Markdown code blocks with the correct language extension indicated
  `;
};

const getProvider = (providerId: ProvidersEnum) => {
	const provider = getSettings()[providerId];
	if (!provider) {
		throw new Error(`Provider ${providerId} not found`);
	}
	return provider.provider as Provider;
};

interface ChatViewProps {
	conversationId?: number;
	storedMessages: ChatMessage[];
}

const bc = new BroadcastChannel("ai-channel");

export default function ChatView({
	conversationId,
	storedMessages,
}: ChatViewProps) {
	const messageRef = useRef<HTMLTextAreaElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const navigate = useNavigate();
	const [selectedModel, setSelectedModelState] = useState<{
		model: ModelsEnum;
		provider: ProvidersEnum;
	}>({
		model: ModelsInfo.Gemini_2_5_Flash.id,
		provider: ProvidersInfo.google.id,
	});

	const { status, stream, stop } = useStreamText();

	const onSubmit = async (e: Event | undefined) => {
		e?.preventDefault();

		const input = messageRef.current?.value;
		if (!input || !messageRef.current) throw new Error("Empty message");
		messageRef.current.value = "";
		const title = storedMessages.at(-1)?.content?.slice(0, 30) || "New Chat";
		const convId = conversationId || (await createConversation(title));
		await addMessage(convId, "user", input);
		if (!conversationId) {
			navigate({
				to: "/chats/$conversationId",
				params: { conversationId: convId.toString() },
			});
		}
		try {
			let content = "";
			const mappedMessages: CoreMessage[] = storedMessages.map((msg) => ({
				role: msg.role === "user" ? "user" : "assistant",
				content: msg.content,
			}));
			mappedMessages.push({
				role: "user",
				content: input,
			});
			const msgId = await addMessage(convId, "assistant", content);

			console.log("addedMessage", msgId, mappedMessages);
			const providerConfig =
				ModelsInfo[selectedModel.model].providers[selectedModel.provider];
			if (!providerConfig) {
				throw new Error(
					`No provider config found for model ${selectedModel.model} and provider ${selectedModel.provider}`,
				);
			}
			await stream({
				model: getProvider(selectedModel.provider).languageModel(
					providerConfig.model,
				),
				// prompt: getPrompt(),
				messages: mappedMessages.filter((msg) => msg.content !== ""),
				system: getPrompt(),
				maxSteps: 2,
				onChunk(chunk) {
					if (chunk.type === "text-delta") {
						console.log("Recieved chunk");
						content += chunk.textDelta;
						updateMessage(msgId, content);
					} else if (chunk.type === "reasoning") {
					}
				},
			});
		} catch (e) {
			console.log("Worker error", e);
		}
	};

	const handleModelChange = (
		modelId: ModelsEnum,
		providerId: ProvidersEnum,
	) => {
		setSelectedModelState({ model: modelId, provider: providerId });
	};

	const handleStop = () => {
		console.log("Cancelling");
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
	};

	return (
		<div className="flex flex-col flex-1 h-[calc(100vh-48px)] w-full">
			<ChatMessageList>
				{storedMessages?.map((message) =>
					message.role === "user" ? (
						<ChatBubble
							key={message.id}
							variant={message.role === "user" ? "sent" : "received"}
						>
							<ChatBubbleMessage
								variant={message.role === "user" ? "sent" : "received"}
							>
								{message.content}
							</ChatBubbleMessage>
						</ChatBubble>
					) : (
						<div
							key={message.id}
							className="prose prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 "
						>
							<Markdown
								remarkPlugins={[remarkGfm]}
								components={{
									code: CodeHighlight,
								}}
							>
								{message.content}
							</Markdown>
						</div>
					),
				)}
				{status === "submitted" && (
					<ChatBubble variant="received">
						<ChatBubbleMessage isLoading />
					</ChatBubble>
				)}
			</ChatMessageList>
			<form
				ref={formRef}
				onSubmit={onSubmit}
				className="flex items-center p-4 border-t gap-2"
			>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="w-[180px]">
							{ModelsInfo[selectedModel.model].name}
						</Button>
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
											handleModelChange(model.id, providerId as ProvidersEnum)
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
				<ChatInput
					ref={messageRef}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							if (formRef.current) onSubmit(undefined);
						}
					}}
					className="flex-1 min-h-12 bg-background"
				/>
				{status}
				{status === "generating" || status === "reasoning" ? (
					<Button type="button" size="icon" onClick={handleStop}>
						<Square className="size-4" />
					</Button>
				) : (
					<Button
						type="submit"
						size="icon"
						disabled={status !== "ready" && status !== "error"}
					>
						<Send className="size-4" />
					</Button>
				)}
			</form>
		</div>
	);
}
