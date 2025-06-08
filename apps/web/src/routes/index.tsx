import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { client, redirect_uri } from "@/integrations/openauth/auth";
import { Button } from "@/components/ui/button";
import Chat from "@/components/Chat";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	return (
		<div className="flex-1 flex">
			<Chat />
		</div>
	);
}

// {/* <Button */}
// {/* 	onClick={async () => { */}
// {/* 		const { url } = await client.authorize(redirect_uri, "code"); */}
// {/* 		window.open(url); */}
// {/* 	}} */}
// {/* > */}
// {/* 	Authenticate */}
// {/* </Button> */}
