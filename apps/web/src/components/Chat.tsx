import { useEffect, useRef, useState } from "react";
import { ChatMessageList } from "./ui/chat/chat-message-list";
import { ChatBubble, ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { Button } from "./ui/button";
import { Send } from "lucide-react";
import { ChatInput } from "./ui/chat/chat-input";
import { useChat } from "@ai-sdk/react";
import db, { chatMessage, type ChatMessage, conversation } from "l1-db";
import { Route } from "@/routes";
import { eq } from "drizzle-orm";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { usePGlite } from "@electric-sql/pglite-react";

const google = createGoogleGenerativeAI({
	apiKey: "",
});

interface ChatViewProps {
	conversationId?: number;
	storedMessages: ChatMessage[];
}
export default function ChatView({
	conversationId,
	storedMessages,
}: ChatViewProps) {
	// const db = Route.useRouteContext({ select: (ctx) => ctx.db });
	const pgLite = usePGlite();
	const messagesRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const navigate = useNavigate();

	const [pendingConversationId, setPendingConversationId] = useState<
		number | undefined
	>(conversationId);

	const {
		status,
		messages,
		setMessages,
		input,
		handleInputChange,
		handleSubmit,
	} = useChat({
		streamProtocol: "data",
		fetch: async (_url, options) => {
			const { messages: currentMessages } = JSON.parse(
				options!.body! as string,
			);

			// Persist user message before streaming AI response
			let convId = pendingConversationId;
			if (!convId) {
				// Create new conversation
				const title =
					currentMessages[currentMessages.length - 1]?.content?.slice(0, 30) ||
					"New Chat";
				const newConvs = await db
					.insert(conversation)
					.values({ title })
					.returning()
					.execute();
				if (newConvs.length > 0) {
					convId = newConvs[0].id;
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
				db.insert(chatMessage)
					.values({
						conversationId: convId,
						role: "user",
						content: userMsg.content,
					})
					.execute();
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
							const res = await pgLite.query<{ id: number }>(
								db
									.insert(chatMessage)
									.values({
										conversationId: convId!,
										role: "assistant",
										content: assistantContent,
									})
									.returning()
									.toSQL().sql,
								db
									.insert(chatMessage)
									.values({
										conversationId: convId!,
										role: "assistant",
										content: assistantContent,
									})
									.returning()
									.toSQL().params,
							);
							assistantMsgId = res.rows[0]?.id;
						} catch (e) {
							console.error("error while inserting", e);
						}
					} else {
						await db
							.update(chatMessage)
							.set({ content: assistantContent })
							.where(eq(chatMessage.id, assistantMsgId))
							.execute();
					}
				}
			})();

			return stream.toDataStreamResponse();
		},
	});

	useEffect(() => {
		if (storedMessages.length > 0) {
			setMessages(
				storedMessages.map((row) => ({
					id: `${row.id}`,
					role: row.role === "user" ? "user" : "assistant",
					content: row.content,
					createdAt: new Date(row.createdAt),
				})),
			);
		}
	}, [storedMessages]);

	return (
		<div className="flex flex-col flex-1 h-[calc(100vh-48px)]">
			<div className="flex-1 overflow-y-auto p-4">
				<ChatMessageList ref={messagesRef}>
					{messages &&
						messages.map((message, index) => (
							<ChatBubble
								key={index}
								variant={message.role == "user" ? "sent" : "received"}
							>
								<ChatBubbleMessage
									variant={message.role == "user" ? "sent" : "received"}
								>
									<Markdown key={index} remarkPlugins={[remarkGfm]}>
										{message.parts
											.filter((msg) => msg.type === "text")
											.map((msg) => msg.text)
											.join("")}
									</Markdown>
									{/* {message.content */}
									{/* 	.split("```") */}
									{/* 	.map((part: string, index: number) => { */}
									{/* 		if (index % 2 === 0) { */}
									{/* 			return ( */}
									{/* 				<Markdown key={index} remarkPlugins={[remarkGfm]}> */}
									{/* 					{part} */}
									{/* 				</Markdown> */}
									{/* 			); */}
									{/* 		} else { */}
									{/* 			return ( */}
									{/* 				<pre className=" pt-2" key={index}> */}
									{/* 					<CodeDisplayBlock code={part} lang="" /> */}
									{/* 				</pre> */}
									{/* 			); */}
									{/* 		} */}
									{/* 	})} */}
								</ChatBubbleMessage>
							</ChatBubble>
						))}

					{status === "submitted" && (
						<ChatBubble variant="received">
							<ChatBubbleMessage isLoading />
						</ChatBubble>
					)}
				</ChatMessageList>
			</div>
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
