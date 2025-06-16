import ChatView from "@/components/Chat";
import { getTokens } from "@/integrations/tanstack-store/auth-store";
import {
	addMessageDirect,
	createConversationDirect,
} from "@/integrations/tanstack-store/chats-store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		const token = getTokens();
		if (token.access_token) {
			const data = await fetch(
				`http://localhost:3000/getData?token=${token.access_token}`,
			).then((res) => res.json());

			const { conversations, messages } = data;

			console.log("Conversations", conversations);
			console.log("Messages", messages);

			for (const conversation of conversations) {
				createConversationDirect(conversation.data);
			}
			for (const message of messages) {
				addMessageDirect(message.conversationId, message.data);
			}
		}
	},
});

function App() {
	return (
		<div className="flex-1 flex">
			<ChatView storedMessages={[]} />
		</div>
	);
}
