import {
	clearMessages,
	createConversationBranch,
	generateResponse,
	updateMessage,
	type ChatMessageStore,
} from "@/integrations/tanstack-store/chats-store";
import { useStore } from "@tanstack/react-store";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeHighlight } from "./CodeHighlighter";
import { useEffect, useRef, useState } from "react";
import { isAutoScrollEnabled } from "./ChatInputBox";
import { scrollToBottom } from "./ui/chat/hooks/useAutoScroll";
import MessageLoading from "./ui/chat/message-loading";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
	Check,
	Copy,
	Cross,
	Edit,
	GitBranch,
	RefreshCw,
	Split,
	X,
	FileText,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
	attachmentsStore,
	type Attachment,
} from "@/integrations/tanstack-store/attachments-store";
import { getFile } from "@/lib/indexed-db";
import { AttachmentPreview } from "./AttachmentPreview";

function ChatMessageRenderer({
	chatMessageStore,
	messageIndex,
	scrollRef,
}: {
	chatMessageStore: ChatMessageStore;
	messageIndex: number;
	scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
	const navigate = useNavigate();
	const message = useStore(chatMessageStore);
	const [editting, setEditting] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const allAttachments = useStore(attachmentsStore) as Attachment[];
	const messageAttachments = message.attachments
		? allAttachments.filter((a: Attachment) =>
				message.attachments?.includes(a.id),
			)
		: [];

	useEffect(() => {
		if (!scrollRef?.current) return;
		if (isAutoScrollEnabled.state) {
			scrollToBottom(scrollRef?.current);
		}
	}, [scrollRef?.current]);

	const handleEdit = () => {
		const input = inputRef.current?.value || "";
		if (input.trim() === "") {
			return;
		}

		updateMessage(message.id, messageIndex, message.conversationId, {
			message: input,
		});

		clearMessages(message.conversationId, messageIndex);

		setEditting(false);
		if (inputRef.current) {
			inputRef.current.value = "";
		}

		generateResponse(message.conversationId);
	};

	return (
		<div
			key={message.id}
			className={cn(
				"group",
				message.role === "user" &&
					(!editting ? "max-w-[60%] ml-auto" : "w-[60%] ml-auto"),
			)}
		>
			<div
				className={cn(
					message.role === "user" &&
						"max-w-full bg-muted text-primary-foreground rounded-l-lg rounded-tr-lg p-4",
					message.role === "user" && editting && "p-2 flex flex-col",
				)}
			>
				{messageAttachments.length > 0 && (
					<div className=" mb-2 flex flex-wrap gap-2">
						{messageAttachments.map((attachment: Attachment) => (
							<AttachmentPreview key={attachment.id} attachment={attachment} />
						))}
					</div>
				)}
				{editting ? (
					<textarea
						ref={inputRef}
						className={cn(
							"flex-1 min-h-[2.5em] p-2 ring-background focus-visible:outline-none",
							"bg-sidebar text-primary-foreground rounded-l-lg rounded-tr-lg",
							"font-sans text-lg leading-relaxed box-border",
						)}
						onInput={(e) => {
							const target = e.target as HTMLTextAreaElement;
							target.style.height = `${target.scrollHeight}px`;
						}}
						defaultValue={message.message}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleEdit();
							}
						}}
					/>
				) : (
					<div className="prose prose-lg prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0">
						<Markdown
							remarkPlugins={[remarkGfm]}
							components={{
								code: CodeHighlight,
							}}
						>
							{message.status === "generating"
								? message.parts?.join("")
								: message.message}
						</Markdown>
					</div>
				)}
			</div>
			{message.sources && message.sources.length > 0 && (
				<Accordion type="single" collapsible className="mt-4">
					<AccordionItem value="sources">
						<AccordionTrigger className="text-sm font-medium">
							Sources
						</AccordionTrigger>
						<AccordionContent>
							<div className="space-y-2">
								{message.sources.map((source, index) => (
									<div key={`${index}-${source.url}`} className="text-sm">
										<a
											href={source.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-primary hover:underline"
										>
											{source.title}
										</a>
									</div>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			)}
			{message.role === "assistant" &&
				(message.status === "submitted" ||
					(message.status === "generating" && message.parts?.length === 0)) && (
					<MessageLoading />
				)}
			{(message.status === "stopped" || message.status === "errored") && (
				<div
					key={`error-${message.id}`}
					className="bg-destructive/80 p-4 border-destructive-foreground rounded-lg"
				>
					{message.status === "stopped"
						? "Stopped by user"
						: `Error in generation ${message.error}`}
				</div>
			)}
			<div
				className={cn(
					"invisible group-hover:visible flex items-center gap-1 pt-2 text-xs",
					message.role === "user" && "justify-end",
				)}
			>
				{message.role === "assistant" ? (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => {
							const newConversation = createConversationBranch(
								message.conversationId,
								messageIndex,
							);
							navigate({ to: `/chats/${newConversation}` });
						}}
					>
						<Split className="rotate-180" />
					</Button>
				) : !editting ? (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => {
							setEditting(true);
						}}
					>
						<Edit />
					</Button>
				) : (
					<>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								if (inputRef.current) {
									handleEdit();
								}
							}}
						>
							<Check />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								setEditting(false);
							}}
						>
							<X />
						</Button>
					</>
				)}
				<Button
					variant="ghost"
					size="icon"
					onClick={() => {
						const index =
							message.role === "assistant" ? messageIndex - 1 : messageIndex;

						clearMessages(message.conversationId, index);

						generateResponse(message.conversationId);
					}}
				>
					<RefreshCw />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigator.clipboard.writeText(message.message)}
				>
					<Copy className="rotate-180" />
				</Button>
				{message.meta_model && (
					<span>{message.meta_model || "Gemini 2.0 Flash"}</span>
				)}
			</div>
		</div>
	);
}

export default ChatMessageRenderer;
