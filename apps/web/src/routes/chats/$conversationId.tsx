import ChatView from "@/components/Chat";
import { conversationMapStore } from "@/integrations/tanstack-store/chats-store";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/chats/$conversationId")({
	component: ChatPage,
	beforeLoad({ params }) {
		return {
			conversationId: params.conversationId,
		};
	},
	loader: async ({ context }) => {
		const conversation = conversationMapStore.state[context.conversationId];
		if (!conversation) {
			throw redirect({ to: "/" });
		}
	},
});

function ChatPage() {
	const { conversationId } = Route.useRouteContext();

	return (
		<div className="flex-1 flex">
			<ChatView conversationId={conversationId} />
		</div>
	);
}
