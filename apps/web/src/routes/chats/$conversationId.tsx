import ChatView from "@/components/Chat";
import { createFileRoute } from "@tanstack/react-router";
import { chatMessage, type ChatMessage } from "l1-db";
import { useSubscription } from "@/hooks/use-subscriptions";
import { eq } from "drizzle-orm";

export const Route = createFileRoute("/chats/$conversationId")({
	component: ChatPage,
	beforeLoad({ params }) {
		return {
			conversationId: parseInt(params.conversationId),
		};
	},
});

function ChatPage() {
	const { db, conversationId } = Route.useRouteContext();

	const { data: msgs } = useSubscription<ChatMessage>(
		db
			.select()
			.from(chatMessage)
			.where(eq(chatMessage.conversationId, conversationId))
			.toSQL(),
	);

	return (
		<div className="flex-1 flex">
			<ChatView conversationId={conversationId} storedMessages={msgs || []} />
		</div>
	);
}
