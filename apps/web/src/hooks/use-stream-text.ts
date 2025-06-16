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

export const generateAnswerWithPreferredModel = async (
	input: string,
	messageHistory: ChatMessage[],
	convId: string,
) => {
	const selectedModelPreferences = selectedModelPreferencesStore.state;

	return await generateAnswer(
		input,
		selectedModelPreferences.model,
		selectedModelPreferences.provider,
		messageHistory,
		convId,
	);
};

export const generateAnswer = async (
	input: string,
	selectedModel: ModelsEnum,
	selectedProvider: ProvidersEnum,
	messageHistory: ChatMessage[],
	convId: string,
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

		const [msgId, msgIndex] = addMessage(convId, {
			role: "assistant",
			message: content,
			conversationId: convId,
			meta_tokens: 0,
			status: "submitted",
			meta_model: selectedModel,
		});

		updateConversation(convId, {
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
				updateConversation(convId, {
					generating: false,
				});
				updateMessage(msgId, msgIndex, convId, {
					status: "errored",
				});
			},
			onFinish({ usage, finishReason }) {
				updateConversation(convId, {
					generating: false,
					meta: {
						tokens: usage.totalTokens,
						activeTokens: usage.totalTokens,
					},
				});
				updateMessage(msgId, msgIndex, convId, {
					status: "done",
					message: content,
					meta_tokens: usage.completionTokens,
				});
			},
			experimental_transform: [smoothStream()],
		});

		for await (const _ of result.textStream) {
			// Stream is being consumed
		}
	} catch (e) {
		console.log("Worker error", e);
	}
};
