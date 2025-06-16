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
	updateConversation,
} from "@/integrations/tanstack-store/chats-store";
import type { ChatMessage, Source } from "l1-db";
import settingsStore, {
	getSettings,
	selectedModelPreferencesStore,
} from "@/integrations/tanstack-store/settings-store";

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

export const generateAnswer = async (
	input: string,
	conversationId: string,
	selectedModel: ModelsEnum,
	selectedProvider: ProvidersEnum,
	messageHistory: ChatMessage[],
	abortSignal?: AbortSignal,
) => {
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

		const [msgId, msgIndex] = addMessage(conversationId, {
			role: "assistant",
			message: content,
			conversationId: conversationId,
			meta_tokens: 0,
			status: "submitted",
			meta_model: ModelsInfo[selectedModel].name,
		});

		updateConversation(conversationId, {
			generating: true,
		});

		const result = streamText({
			model: getProvider(selectedProvider).languageModel(
				providerConfig.model,
				generationConfig,
			),
			messages: mappedMessages.filter(
				(msg) => msg.content !== "" && msg.role !== "system",
			),
			system: getPrompt(),
			maxSteps: 2,
			async onChunk({ chunk }) {
				console.log("Recieved chunk", chunk);
				if (chunk.type === "text-delta") {
					if (content.length === 0) {
						updateMessage(msgId, msgIndex, conversationId, {
							status: "generating",
						});
					}
					content += chunk.textDelta;
					updateMessageStream(msgId, msgIndex, conversationId, chunk.textDelta);
				} else if (chunk.type === "source") {
					if (msgIndex) {
						sources.push(chunk.source as Source);
						updateMessageStreamWithSources(
							msgId,
							msgIndex,
							conversationId,
							chunk.source,
						);
					}
				}
			},
			async onError() {
				updateConversation(conversationId, {
					generating: false,
				});
				updateMessage(msgId, msgIndex, conversationId, {
					status: "errored",
				});
			},
			onFinish({ usage, finishReason }) {
				updateConversation(conversationId, {
					generating: false,
					meta: {
						tokens: usage.totalTokens,
						activeTokens: usage.totalTokens,
					},
				});
				updateMessage(msgId, msgIndex, conversationId, {
					status: "done",
					message: content,
					meta_tokens: usage.completionTokens,
				});
			},
			abortSignal,
			experimental_transform: [smoothStream()],
		});

		for await (const _ of result.textStream) {
			// Stream is being consumed
		}
	} catch (e) {
		console.log("Worker error", e);
	}
};
