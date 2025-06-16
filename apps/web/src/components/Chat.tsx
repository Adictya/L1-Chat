import { ChatMessageList } from "./ui/chat/chat-message-list";
import { Store } from "@tanstack/react-store";
import { useSubscribeConversationMessages } from "@/integrations/tanstack-store/chats-store";
import ChatMessageRenderer from "./ChatMessageRenderer";
import ChatInputBox from "./ChatInputBox";
import { useRef } from "react";

interface ChatViewProps {
	conversationId?: string;
}

export default function ChatView({ conversationId }: ChatViewProps) {
	const chatMessages = useSubscribeConversationMessages(conversationId);
	const scrollRef = useRef<HTMLDivElement>(null);

	return (
		<div className="flex flex-col flex-1 h-screen w-full">
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
			<ChatInputBox
				conversationId={conversationId}
				scrollRef={scrollRef}
			/>
		</div>
	);
}
