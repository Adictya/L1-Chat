import ChatView from "@/components/Chat";
import { userDataStore } from "@/integrations/tanstack-store/user-data-store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		try {
			const data = await fetch(`http://localhost:3000/get-user`, {
				credentials: "include",
			}).then((res) => res.json());
			console.log("Data", data);
			userDataStore.setState(data);
		} catch (e) {
			console.log("Error", e);
		}

		// const { conversations, messages } = data;
		//
		// console.log("Conversations", conversations);
		// console.log("Messages", messages);
		//
		// for (const conversation of conversations) {
		// 	createConversationDirect(conversation.data);
		// }
		// for (const message of messages) {
		// 	addMessageDirect(message.conversationId, message.data);
		// }
	},
});

function App() {
	return (
		<div className="flex-1 flex">
			<ChatView storedMessages={[]} />
		</div>
	);
}
