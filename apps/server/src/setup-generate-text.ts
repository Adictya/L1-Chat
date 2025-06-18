import {
	apiKeysTable,
	attachmentTable,
	Attachment,
	Source,
	conversation,
	chatMessageTable,
} from "l1-db-sqlite/schema";
import type * as schema from "l1-db-sqlite/schema";
import { SyncEventManager } from "l1-sync";
import {
	ModelsEnum,
	ModelsInfo,
	Providers,
	ProvidersEnum,
} from "l1-sync/types";
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
import {
	createGoogleGenerativeAI,
	google,
	type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import {
	createOpenAI,
	openai,
	type OpenAIResponsesProviderOptions,
} from "@ai-sdk/openai";
import {
	createAnthropic,
	type AnthropicProviderOptions,
} from "@ai-sdk/anthropic";
import {
	createOpenRouter,
	type OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { ChatMessage } from "l1-db";

const getPrompt = (selectedModel: ModelsEnum) => {
	return `
You are L1 Chat, an AI assistant powered by the ${ModelsInfo[selectedModel].name} model. Your role is to assist and engage in conversation while being helpful, respectful, and engaging.

If you are specifically asked about the model you are using, you may mention that you use the ${ModelsInfo[selectedModel].name} model. If you are not asked specifically about the model you are using, you do not need to mention it.
The current date and time including timezone is ${new Date().toISOString()}.

Ensure code is properly formatted using Prettier with a print width of 80 characters
Present code in Markdown code blocks with the correct language extension indicated
  `;
};

const getFile = async (
	db: DrizzleD1Database<typeof schema>,
	attachment: Attachment,
	userId: string,
) => {
	const fileData = await db.query.attachmentTable.findFirst({
		where: and(
			eq(attachmentTable.id, attachment.id),
			eq(attachmentTable.userId, userId),
		),
	});

	if (!fileData) {
		console.warn("No file data found for attachment", attachment.id);
		return null;
	}

	return {
		data: decode(fileData.fileData),
		type: fileData.data.type,
		id: fileData.data.id,
		name: fileData.data.name,
		timestamp: fileData.data.timestamp,
	};
};

const getProvider = async (
	db: DrizzleD1Database<typeof schema>,
	userId: string,
	providerId: ProvidersEnum,
) => {
	const apiKeys = await db
		.select()
		.from(apiKeysTable)
		.where(eq(apiKeysTable.userId, userId));

	const apiKey = apiKeys[0].keys;

	const { google, openai, anthropic, openrouter } = apiKey;
	switch (providerId) {
		case Providers.google:
			return createGoogleGenerativeAI({ apiKey: google });
		case Providers.openai:
			return createOpenAI({ apiKey: openai });
		case Providers.anthropic:
			return createAnthropic({ apiKey: anthropic });
		case Providers.openrouter:
			return createOpenRouter({ apiKey: openrouter });
		default:
			throw new Error(`Provider ${providerId} not found`);
	}
};

const chars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Use a lookup table to find the index.
const lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
	lookup[chars.charCodeAt(i)] = i;
}

export const decode = (base64: string): ArrayBuffer => {
	let bufferLength = base64.length * 0.75,
		len = base64.length,
		i,
		p = 0,
		encoded1,
		encoded2,
		encoded3,
		encoded4;

	if (base64[base64.length - 1] === "=") {
		bufferLength--;
		if (base64[base64.length - 2] === "=") {
			bufferLength--;
		}
	}

	const arraybuffer = new ArrayBuffer(bufferLength),
		bytes = new Uint8Array(arraybuffer);

	for (i = 0; i < len; i += 4) {
		encoded1 = lookup[base64.charCodeAt(i)];
		encoded2 = lookup[base64.charCodeAt(i + 1)];
		encoded3 = lookup[base64.charCodeAt(i + 2)];
		encoded4 = lookup[base64.charCodeAt(i + 3)];

		bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
		bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
		bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
	}

	return arraybuffer;
};

export const attatchGenerateText = (
	db: DrizzleD1Database<typeof schema>,
	syncEventManager: SyncEventManager,
) => {
	async function updateConversation(
		conversationId: string,
		data: Partial<Omit<schema.Conversation, "id">>,
		noBroadcast?: boolean,
	) {
		const existingConversation = await db.query.conversation.findFirst({
			where: eq(conversation.id, conversationId),
		});

		if (existingConversation) {
			syncEventManager.emit<"updateConversation">({
				type: "updateConversation",
				conversationId,
				data: existingConversation.data,
			});
		}
	}

	function updateMessageStreamWithSources(
		messageId: string,
		messageIndex: number,
		conversationId: string,
		source: Source,
	) {
		syncEventManager.emit<"updateMessageStreamWithSources">({
			type: "updateMessageStreamWithSources",
			messageId,
			messageIndex,
			conversationId,
			source,
		});
	}

	function updateMessageStream(
		messageId: string,
		messageIndex: number,
		conversationId: string,
		part: string,
		streamType?: "text" | "reasoning",
	) {
		syncEventManager.emit<"updateMessageStream">({
			type: "updateMessageStream",
			messageId,
			messageIndex,
			conversationId,
			part,
			streamType,
		});
	}

	async function updateMessage(
		messageId: string,
		messageIndex: number,
		conversationId: string,
		message:
			| Partial<Omit<ChatMessage, "id" | "conversationId" | "role">>
			| ((prev: ChatMessage) => ChatMessage),
	) {
		const existingMessage = await db.query.chatMessageTable.findFirst({
			where: eq(chatMessageTable.id, messageId),
		});
		if (!existingMessage) {
			throw new Error("Message not found");
		}
		let newMessage: ChatMessage = existingMessage.data;

		newMessage =
			typeof message === "function"
				? message(existingMessage.data)
				: {
						...existingMessage.data,
						...message,
						id: prev.id,
						conversationId: existingMessage.conversationId,
						role: existingMessage.data.role,
						updatedAt: Date.now(),
					};

		syncEventManager.emit<"updateMessage">({
			type: "updateMessage",
			messageId,
			messageIndex,
			conversationId,
			message: newMessage,
		});
	}

	async function addMessage(
		conversationId: string,
		message: Omit<ChatMessage, "id" | "createdAt" | "updatedAt">,
	) {
		const id = crypto.randomUUID();

		const conversationMessage = await db.query.chatMessageTable.findMany({
			where: eq(chatMessageTable.conversationId, conversationId),
		});

		let index = 0;
		if (!conversationMessage) {
			index = 0;
		}

		index = conversationMessage.length;

		const fullMessage: ChatMessage = {
			...message,
			id,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		syncEventManager.emit<"addMessage">({
			type: "addMessage",
			messageIndex: index,
			conversationId,
			message: fullMessage,
		});

		return [id, index] as const;
	}

	const generateAnswer = async (
		db: DrizzleD1Database,
		userId: string,
		input: string,
		conversationId: string,
		selectedModel: ModelsEnum,
		selectedProvider: ProvidersEnum,
		messageHistory: ChatMessage[],
		generationConfig: Record<string, any>,
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
						const file = await getFile(db, attachment, userId);

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

			const [msgId, msgIndex] = await addMessage(conversationId, {
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
				model: getProvider(
					db,
					userId,
					selectedProvider,
					//@ts-expect-error
				).languageModel(providerConfig.model, generationConfig),

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
						updateMessageStream(
							msgId,
							msgIndex,
							conversationId,
							chunk.textDelta,
						);
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

	syncEventManager.on<"generateResponse">(
		"generateResponse",
		async (eventData) => {
			const {
				type,
				targetClientId,
				conversationId,
				selectedModel,
				selectedProvider,
				generationConfig,
			} = eventData;

			generateAnswer(
				db,
				userId,
				input,
				conversationId,
				selectedModel,
				selectedProvider,
				messageHistory,
				generationConfig,
				abortSignal,
			);
		},
	);
};
