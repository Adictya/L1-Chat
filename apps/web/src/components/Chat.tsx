import { ChatMessageList } from "./ui/chat/chat-message-list";
import { Store } from "@tanstack/react-store";
import { useSubscribeConversationMessages } from "@/integrations/tanstack-store/chats-store";
import ChatMessageRenderer from "./ChatMessageRenderer";
import ChatInputBox from "./ChatInputBox";
import { useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Tab = "create" | "explore" | "code" | "learn";

const QUESTIONS: Record<Tab, string[]> = {
	create: [
		"Write a short story about a robot discovering emotions",
		"Help me outline a sci-fi novel set in a post-apocalyptic world",
		"Create a character profile for a complex villain with sympathetic motives",
		"Give me 5 creative writing prompts for flash fiction",
	],
	explore: [
		"Tell me about the latest advancements in AI",
		"Explain quantum computing in simple terms",
		"What are the most interesting space discoveries?",
		"How does human consciousness work?",
	],
	code: [
		"Help me learn React from scratch",
		"Explain TypeScript generics with examples",
		"Create a REST API with Node.js",
		"Debug my Python code",
	],
	learn: [
		"Teach me the basics of digital photography",
		"How can I improve my public speaking?",
		"Explain machine learning concepts",
		"Guide me through learning a new language",
	],
};

function WelcomeSection({
	onSelectQuestion,
}: { onSelectQuestion: (question: string) => void }) {
	const [activeTab, setActiveTab] = useState<Tab>("create");

	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="flex flex-col min-w-100 max-w-2xl w-full">
				<h1 className="text-3xl font-bold text-foreground mb-2">
					How can I help you today?
				</h1>
				<p className="text-lg text-muted-foreground mb-6">
					Choose a category below to get started
				</p>
				<div className="flex gap-2 mb-4">
					{(Object.keys(QUESTIONS) as Tab[]).map((tab) => (
						<button
							key={tab}
							type="button"
							className={`px-4 py-2 rounded-md capitalize ${
								activeTab === tab
									? "bg-primary/80 text-primary-foreground"
									: "hover:bg-muted"
							}`}
							onClick={() => setActiveTab(tab)}
						>
							{tab}
						</button>
					))}
				</div>
				<div className="flex flex-col gap-4">
					{QUESTIONS[activeTab].map((question) => (
						<button
							key={question}
							type="button"
							className="w-full text-left p-4 rounded-md hover:bg-card border border-border"
							onClick={() => onSelectQuestion(question)}
						>
							{question}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

interface ChatViewProps {
	conversationId?: string;
}

export default function ChatView({ conversationId }: ChatViewProps) {
	const chatMessages = useSubscribeConversationMessages(conversationId);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	// const miniMapRef = useRef<HTMLDivElement>(null);
	//
	// const list = chatMessages.map((e) => e.state);

	return (
		<div className="relative flex flex-col flex-1 h-screen w-full">
			<ChatMessageList
				ref={scrollRef}
				messageStore={chatMessages.at(-1) || new Store<unknown>({})}
			>
				{conversationId ? (
					chatMessages?.map((message, index) => (
						<ChatMessageRenderer
							key={message.state.id}
							chatMessageStore={message}
							messageIndex={index}
							scrollRef={
								index === chatMessages.length - 1 ? scrollRef : undefined
							}
						/>
					))
				) : (
					<WelcomeSection
						onSelectQuestion={(question) => {
							if (inputRef.current) {
								inputRef.current.value = question;
								inputRef.current.focus();
								inputRef.current.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
							}
						}}
					/>
				)}
			</ChatMessageList>
			{/* <div */}
			{/* 	ref={miniMapRef} */}
			{/* 	className="prose absolute top-0 right-0 w-20 h-full overflow-auto bg-card/20" */}
			{/* > */}
			{/* 	<div className="relative prose max-w-none text-[2px] dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-blockquote:ml-auto prose-blockquote:bg-muted prose-blockquote:p-0.2 prose-blockquote:max-w-[40%] prose-pre:p-0"> */}
			{/* 		<Markdown remarkPlugins={[remarkGfm]}> */}
			{/* 			{list */}
			{/* 				.map((e) => */}
			{/* 					e.role === "assistant" ? e.message : `> ${e.message}`, */}
			{/* 				) */}
			{/* 				.join("\n\n\n\n")} */}
			{/* 		</Markdown> */}
			{/*        <div></div> */}
			{/* 	</div> */}
			{/* </div> */}
			<ChatInputBox
				conversationId={conversationId}
				scrollRef={scrollRef}
				inputRef={inputRef}
			/>
		</div>
	);
}
