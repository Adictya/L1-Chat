import { ChatMessageList } from "./ui/chat/chat-message-list";
import { Store } from "@tanstack/react-store";
import { useSubscribeConversationMessages } from "@/integrations/tanstack-store/chats-store";
import ChatMessageRenderer from "./ChatMessageRenderer";
import ChatInputBox from "./ChatInputBox";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatViewProps {
	conversationId?: string;
}

export default function ChatView({ conversationId }: ChatViewProps) {
	const chatMessages = useSubscribeConversationMessages(conversationId);
	const scrollRef = useRef<HTMLDivElement>(null);
	const miniMapRef = useRef<HTMLDivElement>(null);

	const list = chatMessages.map((e) => e.state);

	return (
		<div className="relative flex flex-col flex-1 h-screen w-full">
			<ChatMessageList
				ref={scrollRef}
				messageStore={chatMessages.at(-1) || new Store<unknown>({})}
			>
				{chatMessages?.map((message, index) => (
					<ChatMessageRenderer
						key={message.state.id}
						chatMessageStore={message}
						messageIndex={index}
						scrollRef={
							index === chatMessages.length - 1 ? scrollRef : undefined
						}
					/>
				))}
			</ChatMessageList>
			<div
				ref={miniMapRef}
				className="prose absolute top-0 right-0 w-20 h-full overflow-auto bg-card/20"
			>
				<div className="relative prose max-w-none text-[2px] dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-blockquote:ml-auto prose-blockquote:bg-muted prose-blockquote:p-0.2 prose-blockquote:max-w-[40%] prose-pre:p-0">
					<Markdown remarkPlugins={[remarkGfm]}>
						{list
							.map((e) =>
								e.role === "assistant" ? e.message : `> ${e.message}`,
							)
							.join("\n\n\n\n")}
					</Markdown>
          <div></div>
				</div>
			</div>
			<ChatInputBox conversationId={conversationId} scrollRef={scrollRef} />
		</div>
	);
}
