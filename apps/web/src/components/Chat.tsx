import {
	ChatBubble,
	ChatBubbleAvatar,
	ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { Button } from "./ui/button";
import { Send } from "lucide-react";
import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLiveQuery, usePGlite } from "@electric-sql/pglite-react";
import { Route } from "@/routes";
import { chatMessage, conversation } from "l1-db";
import type { ChatMessage } from "l1-db";
// import CodeDisplayBlock from "./code-display-block";
//
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const SYSTEM_PROMPT = `You are a helpful assistant`;

const google = createGoogleGenerativeAI({
	apiKey: "",
});

export default function ChatSupport() {
	const db = Route.useRouteContext({ select: (ctx) => ctx.db });
	const [isGenerating, setIsGenerating] = useState(false);
	const msgs = useLiveQuery<ChatMessage>(
		db.select().from(chatMessage).toSQL().sql,
	);
	const {
		messages,
		setMessages,
		input,
		handleInputChange,
		handleSubmit,
		isLoading,
	} = useChat({
		fetch: async (_url, options) => {
			const { messages } = JSON.parse(options!.body! as string);
			console.log("Fetching");
			return streamText({
				model: google("gemini-2.0-flash"),
				messages,
				system: SYSTEM_PROMPT,
				maxSteps: 10,
			}).toDataStreamResponse();
		},
		initialMessages: msgs
			? msgs.rows.map((row) => ({
					id: `${row.id}`,
					role: "assistant",
					content: row.content,
					createdAt: row.createdAt,
				}))
			: [],
		onResponse(response) {
			if (response) {
        
			}
		},
		onError(error) {
			if (error) {
				setIsGenerating(false);
			}
		},
		async onFinish(message) {
			let conversations = await db
				.select()
				.from(conversation)
				.limit(1)
				.execute();
			if (conversations.length <= 0) {
				conversations = await db
					.insert(conversation)
					.values({
						title: message.content,
					})
					.returning()
					.execute();
			}
			await db
				.insert(chatMessage)
				.values({
					chatId: conversations[0].id,
					role: message.role,
					content: message.content,
				})
				.execute();
		},
	});

	useEffect(() => {
		if (msgs) {
			console.log("Updated via live query");
			setMessages(
				msgs.rows.map((row) => ({
					id: `${row.id}`,
					role: "assistant",
					content: row.content,
					createdAt: row.createdAt,
				})),
			);
		}
	}, [msgs?.rows]);

	const messagesRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (messagesRef.current) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [messages]);

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsGenerating(true);
		handleSubmit(e);
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (isGenerating || isLoading || !input) return;
			setIsGenerating(true);
			onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
		}
	};

	return (
		<div className="flex-1 flex flex-col p-4">
			<ChatMessageList className="flex-1" ref={messagesRef}>
				{/* Messages */}
				{messages &&
					messages.map((message, index) => (
						<ChatBubble
							key={index}
							variant={message.role == "user" ? "sent" : "received"}
						>
							<ChatBubbleMessage
								variant={message.role == "user" ? "sent" : "received"}
							>
								{message.content
									.split("```")
									.map((part: string, index: number) => {
										if (index % 2 === 0) {
											return (
												<Markdown key={index} remarkPlugins={[remarkGfm]}>
													{part}
												</Markdown>
											);
										} else {
											return (
												<Markdown key={index} remarkPlugins={[remarkGfm]}>
													{part}
												</Markdown>
												// <pre className=" pt-2" key={index}>
												// 	{/* <CodeDisplayBlock code={part} lang="" /> */}
												// </pre>
											);
										}
									})}
							</ChatBubbleMessage>
						</ChatBubble>
					))}

				{/* Loading */}
				{isGenerating && (
					<ChatBubble variant="received">
						<ChatBubbleMessage isLoading />
					</ChatBubble>
				)}
			</ChatMessageList>
			<form ref={formRef} className="flex relative gap-2" onSubmit={onSubmit}>
				<ChatInput
					value={input}
					onChange={handleInputChange}
					onKeyDown={onKeyDown}
					className="min-h-12 bg-background shadow-none "
				/>
				<Button
					className="absolute top-1/2 right-2 transform  -translate-y-1/2"
					type="submit"
					size="icon"
					disabled={isLoading || isGenerating || !input}
				>
					<Send className="size-4" />
				</Button>
			</form>
		</div>
	);
}
