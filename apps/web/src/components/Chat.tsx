import { useRef, useState } from "react";
import { ChatMessageList } from "./ui/chat/chat-message-list";
import { ChatBubble, ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { Button } from "./ui/button";
import { Globe, Send, Square } from "lucide-react";
import { ChatInput } from "./ui/chat/chat-input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { Source } from "l1-db";
import type { CoreMessage, Provider } from "ai";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import settingsStore, {
	getSettings,
	toggleSearch,
} from "@/integrations/tanstack-store/settings-store";
import {
	ModelsInfo,
	ProvidersInfo,
	type ModelsEnum,
	type ProvidersEnum,
	PerAvailableModelProvidersList,
	Providers,
} from "@/integrations/tanstack-store/models-store";
import { useStreamText } from "@/hooks/use-stream-text";
import { Store, useStore } from "@tanstack/react-store";
import {
	useSubscribeConversationMessages,
	createConversation,
	addMessage,
	updateMessage,
	updateMessageStream,
	updateMessageStreamWithSources,
} from "@/integrations/tanstack-store/chats-store";
import ChatMessageRenderer from "./ChatMessageRenderer";

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
	conversationId?: string;
}

const bc = new BroadcastChannel("ai-channel");

export default function ChatView({ conversationId }: ChatViewProps) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const navigate = useNavigate();
	const [selectedModel, setSelectedModelState] = useState<{
		model: ModelsEnum;
		provider: ProvidersEnum;
	}>({
		model: ModelsInfo.Gemini_2_5_Flash.id,
		provider: ProvidersInfo.google.id,
	});

	const [storedMessages, chatMessages] =
		useSubscribeConversationMessages(conversationId);

  console.log("Chat Messages", storedMessages);

	const searchEnabled = useStore(
		settingsStore,
		(store) => store.google.config.useSearchGrounding,
	);

	const { status, stream, stop } = useStreamText();

	const onSubmit = async () => {
		const input = inputRef.current?.value;
		if (!input || !inputRef.current) throw new Error("Empty message");
		inputRef.current.value = "";
		const title = input.slice(0, 30) || "New Chat";
		const convId = conversationId || createConversation(title);

		addMessage(convId, {
			role: "user",
			message: input,
			conversationId: convId,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			meta_tokens: 0,
		});

		if (!conversationId) {
			navigate({ to: `/chats/${convId}` });
		}

		try {
			let content = "";
			const sources: Source[] = [];
			const mappedMessages: CoreMessage[] = storedMessages.map((msg) => ({
				role: msg.role,
				content: msg.message,
			}));
			mappedMessages.push({
				role: "user",
				content: input,
			});

			console.log("chat history", storedMessages, mappedMessages);
			const providerConfig =
				ModelsInfo[selectedModel.model].providers[selectedModel.provider];
			if (!providerConfig) {
				throw new Error(
					`No provider config found for model ${selectedModel.model} and provider ${selectedModel.provider}`,
				);
			}
			const generationConfig =
				settingsStore.state[selectedModel.provider].config;

			const [msgId, msgIndex] = addMessage(convId, {
				role: "assistant",
				message: content,
				conversationId: convId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				meta_tokens: 0,
				status: "submitted",
			});
			await stream({
				model: getProvider(selectedModel.provider).languageModel(
					providerConfig.model,
					generationConfig,
				),
				// prompt: getPrompt(),
				messages: mappedMessages.filter(
					(msg) => msg.content !== "" && msg.role !== "system",
				),
				system: getPrompt(),
				maxSteps: 2,
				async onChunk(chunk) {
					console.log("Recieved chunk", chunk);
					if (chunk.type === "text-delta") {
						if (content.length === 0) {
							updateMessage(msgId, msgIndex, convId, {
								status: "generating",
							});
						}
						content += chunk.textDelta;
						updateMessageStream(msgId, msgIndex, convId, chunk.textDelta);
					} else if (chunk.type === "source") {
						if (msgIndex) {
							sources.push(chunk.source as Source);
							updateMessageStreamWithSources(
								msgId,
								msgIndex,
								convId,
								chunk.source,
							);
						}
					}
				},
				async onError() {
					updateMessage(msgId, msgIndex, convId, {
						status: "errored",
						updatedAt: new Date().toISOString(),
					});
				},
				onFinish({ usage, finishReason }) {
					updateMessage(msgId, msgIndex, convId, {
						status: "done",
						message: content,
						updatedAt: new Date().toISOString(),
						meta_tokens: usage.completionTokens,
					});
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
		stop();
	};

	return (
		<div className="flex flex-col flex-1 h-[calc(100vh-48px)] w-full">
			<ChatMessageList
				messageStore={chatMessages.at(-1) || new Store<unknown>({})}
			>
				{chatMessages?.map((message) => (
					<ChatMessageRenderer
						key={message.state.id + crypto.randomUUID()}
						chatMessageStore={message}
					/>
				))}
			</ChatMessageList>
			<div className="flex items-center p-4 border-t gap-2">
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
				{selectedModel.provider === Providers.google && (
					<Button
						type="button"
						size="icon"
						variant={searchEnabled ? "default" : "outline"}
						onClick={() => {
							toggleSearch();
						}}
						// className={searchEnabled ? "" : "opacity-50"}
					>
						<Globe className="size-4" />
					</Button>
				)}
				<ChatInput
					ref={inputRef}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							onSubmit();
						}
					}}
					className="flex-1 min-h-12 bg-background"
				/>
				{status !== "ready" && status !== "error" ? (
					<Button type="button" size="icon" onClick={handleStop}>
						<Square className="size-4" />
					</Button>
				) : (
					<Button type="button" onClick={() => onSubmit()} size="icon">
						<Send className="size-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
