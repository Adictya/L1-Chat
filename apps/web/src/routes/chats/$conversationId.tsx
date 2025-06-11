import ChatView from "@/components/Chat";
import { createFileRoute } from "@tanstack/react-router";
import {
	useSubscribeConversationMessages,
} from "@/integrations/drizzle-pglite/actions";

export const Route = createFileRoute("/chats/$conversationId")({
	component: ChatPage,
	beforeLoad({ params }) {
		return {
			conversationId: Number.parseInt(params.conversationId),
		};
	},
});

function ChatPage() {
	const { conversationId } = Route.useRouteContext();

	const msgs = useSubscribeConversationMessages(conversationId);

	return (
		<div className="flex-1 flex">
			<ChatView conversationId={conversationId} storedMessages={msgs || []} />
		</div>
	);
}
