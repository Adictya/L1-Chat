import ChatView from "@/components/Chat";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	return (
		<div className="flex-1 flex">
			<ChatView storedMessages={[]} />
		</div>
	);
}
