import type { ChatMessageStore } from "@/integrations/tanstack-store/chats-store";
import { useStore } from "@tanstack/react-store";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import { ChatBubble } from "./ui/chat/chat-bubble";
import { ChatBubbleMessage } from "./ui/chat/chat-bubble";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeHighlight } from "./CodeHighlighter";

function ChatMessageRenderer({
	chatMessageStore,
}: { chatMessageStore: ChatMessageStore }) {
	const message = useStore(chatMessageStore);

	return (
		<>
			{message.role === "user" ? (
				<ChatBubble
					key={message.id}
					variant={message.role === "user" ? "sent" : "received"}
				>
					<ChatBubbleMessage
						variant={message.role === "user" ? "sent" : "received"}
					>
						{message.message}
					</ChatBubbleMessage>
				</ChatBubble>
			) : (
				<div
					key={message.id}
					className="prose prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0"
				>
					<Markdown
						remarkPlugins={[remarkGfm]}
						components={{
							code: CodeHighlight,
						}}
					>
						{message.status === "generating"
							? message.parts?.join("")
							: message.message}
					</Markdown>
					{message.sources && message.sources.length > 0 && (
						<Accordion type="single" collapsible className="mt-4">
							<AccordionItem value="sources">
								<AccordionTrigger className="text-sm font-medium">
									Sources
								</AccordionTrigger>
								<AccordionContent>
									<div className="space-y-2">
										{message.sources.map((source, index) => (
											<div key={`${index}-${source.url}`} className="text-sm">
												<a
													href={source.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-primary hover:underline"
												>
													{source.title}
												</a>
											</div>
										))}
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					)}
				</div>
			)}
			{message.status === "submitted" || (message.status === "generating" && message.parts?.length === 0) && (
				<ChatBubble variant="received">
					<ChatBubbleMessage isLoading />
				</ChatBubble>
			)}
			{(message.status === "stopped" || message.status === "errored") && (
				<div
					key={'error' + message.id}
					className="bg-destructive/80 p-4 border-destructive-foreground rounded-lg"
				>
					{message.status === "stopped"
						? "Stopped by user"
						: `Error in generation ${message.error}`}
				</div>
			)}
		</>
	);
}

export default ChatMessageRenderer;
