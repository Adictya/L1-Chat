import { useEffect, useRef, useState } from "react";
import { ChatMessageList } from "./ui/chat/chat-message-list";
import { ChatBubble, ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { Button } from "./ui/button";
import { Send } from "lucide-react";
import { ChatInput } from "./ui/chat/chat-input";
import { useChat } from "@ai-sdk/react";
import type { ChatMessage } from "l1-db";
import { Route } from "@/routes";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type UIMessage } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import {
	createConversation,
	addMessage,
	updateMessage,
} from "@/integrations/drizzle-pglite/actions";

const google = createGoogleGenerativeAI({
	apiKey: "AIzaSyDPUk7hKxcASKxD9-phqeXb0lHaKmqExxg",
});

interface ChatViewProps {
	conversationId?: number;
	storedMessages: ChatMessage[];
}

export default function ChatView({
	conversationId,
	storedMessages,
}: ChatViewProps) {
	const messagesRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const navigate = useNavigate();

	const [pendingConversationId, setPendingConversationId] = useState<
		number | undefined
	>(conversationId);

	const [myMessages, setMyMessages] = useState<UIMessage[]>([]);

	const { status, setMessages, input, handleInputChange, handleSubmit } =
		useChat({
			streamProtocol: "data",
			fetch: async (_url, options) => {
				const { messages: currentMessages } = JSON.parse(
					options?.body as string,
				);

				// Persist user message before streaming AI response
				let convId = pendingConversationId;
				if (!convId) {
					// Create new conversation
					const title =
						currentMessages[currentMessages.length - 1]?.content?.slice(
							0,
							30,
						) || "New Chat";
					convId = await createConversation(title);
					if (convId) {
						setPendingConversationId(convId);
						// Redirect to new conversation URL
						navigate({
							to: "/chats/$conversationId",
							params: { conversationId: convId.toString() },
						});
					} else {
						throw new Error("Failed to create conversation");
					}
				}

				// Persist user message
				const userMsg = currentMessages[currentMessages.length - 1];
				if (userMsg && userMsg.role === "user") {
					// Non-blocking insert
					addMessage(convId, "user", userMsg.content);
				}

				// Stream AI response and persist as it comes in
				let assistantMsgId: number | null = null;
				let assistantContent = "";
				const stream = streamText({
					model: google("gemini-2.0-flash"),
					messages: currentMessages,
					system: "You are a helpful assistant",
					maxSteps: 10,
				});

				// Attach streaming handler for persistence using for-await-of
				(async () => {
					for await (const text of stream.textStream) {
						assistantContent += text;
						if (!assistantMsgId) {
							try {
								assistantMsgId = await addMessage(
									convId,
									"assistant",
									assistantContent,
								);
							} catch (e) {
								console.error("error while inserting", e);
							}
						} else {
							await updateMessage(assistantMsgId, assistantContent);
						}
					}
				})();

				return stream.toDataStreamResponse();
			},
		});

	useEffect(() => {
		setMyMessages([]);
	}, [conversationId]);

	useEffect(() => {
		if (storedMessages.length > 0) {
			const temp = storedMessages.map(
				(row) =>
					({
						id: `${row.id}`,
						role: row.role === "user" ? "user" : "assistant",
						content: row.content,
						createdAt: new Date(row.createdAt),
					}) as UIMessage,
			);
			setMessages(temp);
			setMyMessages(temp);
		}
	}, [storedMessages, setMessages]);

	return (
		<div className="flex flex-col flex-1 h-[calc(100vh-48px)]">
			<ChatMessageList ref={messagesRef}>
				{myMessages?.map((message) => (
					<ChatBubble
						key={message.id}
						variant={message.role === "user" ? "sent" : "received"}
					>
						<ChatBubbleMessage
							variant={message.role === "user" ? "sent" : "received"}
						>
							{message.content.split("```").map((part: string, i: number) => {
								if (i % 2 === 0) {
									return (
										<Markdown
											key={`${message.id}-${i}`}
											remarkPlugins={[remarkGfm]}
										>
											{part}
										</Markdown>
									);
								}
								return (
									<pre className="pt-2" key={`${message.id}-${i}`}>
										{part}
									</pre>
								);
							})}
						</ChatBubbleMessage>
					</ChatBubble>
				))}
				{status === "submitted" && (
					<ChatBubble variant="received">
						<ChatBubbleMessage isLoading />
					</ChatBubble>
				)}
			</ChatMessageList>
			<form
				ref={formRef}
				className="flex items-center p-4 border-t gap-2"
				onSubmit={handleSubmit}
			>
				<ChatInput
					value={input}
					onChange={handleInputChange}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							if (formRef.current)
								handleSubmit(
									new Event("submit", {
										cancelable: true,
										bubbles: true,
									}) as unknown as React.FormEvent<HTMLFormElement>,
								);
						}
					}}
					className="flex-1 min-h-12 bg-background"
				/>
				<Button
					type="submit"
					size="icon"
					disabled={(status !== "ready" && status !== "error") || !input}
				>
					<Send className="size-4" />
				</Button>
			</form>
		</div>
	);
}
