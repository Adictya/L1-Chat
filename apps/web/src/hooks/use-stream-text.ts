import { useRef, useState } from "react";
import {
	smoothStream,
	streamText,
	type CoreMessage,
	type CoreUserMessage,
	type FinishReason,
	type ImagePart,
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
	conversationMapStore,
} from "@/integrations/tanstack-store/chats-store";
import type { ChatMessage, Source } from "l1-db";
import {
	getProviderConfig,
	getSettings,
	type ModelPreference,
} from "@/integrations/tanstack-store/settings-store";
import { getFile } from "@/lib/indexed-db";
import { attachmentsStore } from "@/integrations/tanstack-store/attachments-store";
import { iN } from "@/lib/utils";

const getPrompt = (selectedModel: ModelsEnum) => {
	return `
You are L1 Chat, an AI assistant powered by the ${ModelsInfo[selectedModel].name} model. Your role is to assist and engage in conversation while being helpful, respectful, and engaging.

If you are specifically asked about the model you are using, you may mention that you use the ${ModelsInfo[selectedModel].name} model. If you are not asked specifically about the model you are using, you do not need to mention it.
The current date and time including timezone is ${new Date().toISOString()}.

Ensure code is properly formatted using Prettier with a print width of 80 characters
Present code in Markdown code blocks with the correct language extension indicated
  `;
};

const prompt_tokens = 158;

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
	settings: ModelPreference,
	messageHistory: ChatMessage[],
	abortSignal?: AbortSignal,
) => {
	try {
		let content = "";
		let reasoning = "";
		const sources: Source[] = [];
		const mappedMessages: (CoreMessage | CoreUserMessage)[] = [];
		for (const message of messageHistory) {
			if (message.attachments) {
				for (const attachment of message.attachments) {
					const file = await getFile(attachment);

					if (file) {
						mappedMessages.push({
							role: "user",
							content: [
								file?.type.startsWith("image/")
									? {
											type: "image",
											image: file.data,
										}
									: {
											type: "file",
											data: file.data,
											mimeType: file.type,
										},
							],
						});
					}
				}
			}
			mappedMessages.push({
				role: message.role,
				content: message.message,
			});
		}

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

		const generationConfig = getProviderConfig(selectedProvider, settings);

		const [msgId, msgIndex] = addMessage(conversationId, {
			role: "assistant",
			message: content,
			conversationId: conversationId,
			meta_tokens: 0,
			status: "submitted",
			meta_model: selectedModel,
			meta_provider: selectedProvider,
		});

		updateConversation(conversationId, {
			generating: true,
		});

		const result = streamText({
			model: getProvider(selectedProvider).languageModel(
				providerConfig.model,
				// @ts-expect-error
				generationConfig,
			),
			messages: mappedMessages.filter(
				(msg) => msg.content !== "" && msg.role !== "system",
			),
			system: getPrompt(selectedModel),
			maxSteps: 2,
			async onChunk({ chunk }) {
				console.log("Recieved chunk", chunk);
				if (chunk.type === "text-delta") {
					if (content.length === 0) {
						updateMessage(msgId, msgIndex, conversationId, {
							status: "generating",
							reasoning: reasoning !== "" ? reasoning : undefined,
						});
					}
					content += chunk.textDelta;
					updateMessageStream(msgId, msgIndex, conversationId, chunk.textDelta);
				} else if (chunk.type === "reasoning") {
					if (reasoning.length === 0) {
						updateMessage(msgId, msgIndex, conversationId, {
							status: "reasoning",
						});
					}
					reasoning += chunk.textDelta;
					updateMessageStream(
						msgId,
						msgIndex,
						conversationId,
						chunk.textDelta,
						"reasoning",
					);
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
				const convActiveTokens =
					conversationMapStore.state[conversationId].state.meta.activeTokens;
				console.log(
					"==ON--FINISH==",
					{
						promptTokens: usage.promptTokens,
						totalTokens: usage.totalTokens,
						convActiveTokens,
						prompt_tokens,
						completionTokens: usage.completionTokens,
					},
					["promptTokens", "totalTokens", "convActiveTokens", "prompt_tokens"],
				);
				updateMessage(msgId, msgIndex - 1, conversationId, {
					meta_tokens: Math.max(
						iN(usage.promptTokens) -
							convActiveTokens -
							(msgIndex - 1 === 0 ? prompt_tokens : 0),
						input.includes(" ") ? 2 : 1,
					),
				});
				updateConversation(conversationId, {
					generating: false,
					meta: {
						tokens: iN(usage.totalTokens),
						activeTokens: iN(usage.totalTokens),
					},
				});
				updateMessage(msgId, msgIndex, conversationId, {
					status: "done",
					message: content,
					meta_tokens: iN(usage.completionTokens),
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
