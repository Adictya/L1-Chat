import { useRef, useState } from "react";
import {
	smoothStream,
	streamText,
	type CoreMessage,
	type FinishReason,
	type LanguageModel,
	type LanguageModelUsage,
	type Provider,
	type StreamTextOnChunkCallback,
	type Tool,
} from "ai";
import { useNavigate } from "@tanstack/react-router";
import {
	ModelsInfo,
	type ModelsEnum,
	type ProvidersEnum,
} from "@/integrations/tanstack-store/models-store";
import {
	useSubscribeConversationMessages,
	createConversation,
	addMessage,
	updateMessage,
	updateMessageStream,
	updateMessageStreamWithSources,
} from "@/integrations/tanstack-store/chats-store";
import type { ChatMessage, Source } from "l1-db";
import settingsStore, {
	getSettings,
} from "@/integrations/tanstack-store/settings-store";

type StreamStatus =
	| "ready"
	| "submitted"
	| "reasoning"
	| "generating"
	| "error";

interface UseStreamTextOptions {
	model: LanguageModel;
	messages: CoreMessage[];
	system?: string;
	maxSteps?: number;
	onChunk?: (
		chunk: Parameters<
			StreamTextOnChunkCallback<{ [key: string]: Tool }>
		>[0]["chunk"],
	) => void;
	onError?: (error: unknown) => void;
	onFinish?: (event: {
		usage: LanguageModelUsage;
		finishReason: FinishReason;
	}) => void;
}

export function useStreamText() {
	const [status, setStatus] = useState<StreamStatus>("ready");
	const abortController = useRef<AbortController | null>(null);

	const stream = async (options: UseStreamTextOptions) => {
		try {
			setStatus("submitted");

			abortController.current = new AbortController();
			console.log(
				"Abort controller ref",
				abortController.current,
				abortController.current.signal,
			);
			const result = streamText({
				...options,
				onChunk: (param) => {
					if (param.chunk.type === "reasoning") {
						setStatus("reasoning");
					} else if (param.chunk.type === "text-delta") {
						setStatus("generating");
					}
					options.onChunk?.(param.chunk);
				},
				onError: (error: { error: unknown }) => {
					console.log("Error", error);
					if (
						error.error instanceof Error &&
						error.error.name === "AbortError"
					) {
						setStatus("ready");
					}
					options.onError?.(error);
					setStatus("error");
					throw new Error("Generation failed");
				},
				onFinish: (event) => {
					options.onFinish?.(event);
				},
				abortSignal: abortController.current.signal,
				experimental_transform: [smoothStream()],
			});

			for await (const _ of result.textStream) {
				// Stream is being consumed
			}
			abortController.current = null;
			setStatus("ready");
			return result;
		} catch (error) {
			setStatus("error");
			throw error;
		}
	};

	const stop = () => {
		if (abortController.current) {
			abortController.current.abort();
			abortController.current = null;
		}
	};

	return {
		stream,
		status,
		stop,
	};
}

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

export function useGeneration() {
	const navigate = useNavigate();
	const { stream, stop } = useStreamText();

	const onSubmit = async (
		input: string,
		selectedModel: ModelsEnum,
		selectedProvider: ProvidersEnum,
		messageHistory: ChatMessage[],
		conversationId?: string,
	) => {
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
			const mappedMessages: CoreMessage[] = messageHistory.map((msg) => ({
				role: msg.role,
				content: msg.message,
			}));
			mappedMessages.push({
				role: "user",
				content: input,
			});

			const providerConfig =
				ModelsInfo[selectedModel].providers[selectedProvider];
			if (!providerConfig) {
				throw new Error(
					`No provider config found for model ${selectedModel} and provider ${selectedProvider}`,
				);
			}
			const generationConfig = settingsStore.state[selectedProvider].config;

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
				model: getProvider(selectedProvider).languageModel(
					providerConfig.model,
					generationConfig,
				),
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

	return onSubmit;
}
