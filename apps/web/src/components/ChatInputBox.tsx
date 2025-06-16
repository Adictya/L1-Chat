import React, { useEffect, useRef, useState } from "react";
import { ChatInput } from "./ui/chat/chat-input";
import { Button } from "./ui/button";
import {
	ArrowBigUpDash,
	ArrowDown,
	Command,
	CornerDownLeft,
	Globe,
	Send,
	Square,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
	ModelsInfo,
	PerAvailableModelProvidersList,
	ProvidersInfo,
	type ModelsEnum,
	type ProvidersEnum,
} from "@/integrations/tanstack-store/models-store";
import {
	selectedModelPreferencesStore,
	toggleSearch,
	updateSelectedModelPreferences,
} from "@/integrations/tanstack-store/settings-store";
import { Store, useStore } from "@tanstack/react-store";
import settingsStore from "@/integrations/tanstack-store/settings-store";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
	addMessage,
	createConversation,
	generateResponse,
	type ChatMessageStore,
} from "@/integrations/tanstack-store/chats-store";
import { scrollToBottom } from "./ui/chat/hooks/useAutoScroll";
import { useNavigate } from "@tanstack/react-router";

export const isAutoScrollEnabled = new Store<boolean>(true);

const IsAtBottomButton = ({
	scrollRef,
}: {
	scrollRef: React.RefObject<HTMLDivElement | null>;
}) => {
	const [isAtBottom, setIsAtBottom] = useState(true);

	useEffect(() => {
		const checkIsAtBottom = (element: Element) => {
			const { scrollTop, scrollHeight, clientHeight } = element;
			const distanceToBottom = Math.abs(
				scrollHeight - scrollTop - clientHeight,
			);
			return distanceToBottom <= 20;
		};
		scrollRef?.current?.addEventListener("scroll", (e) => {
			if (!scrollRef?.current) return;
			if (checkIsAtBottom(scrollRef.current)) {
				isAutoScrollEnabled.setState(true);
				setIsAtBottom(true);
			} else {
				isAutoScrollEnabled.setState(false);
				setIsAtBottom(false);
			}
		});
		if (scrollRef?.current) {
			setIsAtBottom(checkIsAtBottom(scrollRef.current));
		}
	}, [setIsAtBottom, scrollRef]);

	if (isAtBottom) {
		return null;
	}

	return (
		<Button
			onClick={() => {
				scrollRef?.current && scrollToBottom(scrollRef.current);
			}}
			variant="outline"
			className="absolute top-[-50px] left-[50%] transform -translate-x-1/2 inline-flex rounded-full shadow-md !bg-card"
			aria-label="Scroll to bottom"
		>
			Scroll to bottom <ArrowDown className="h-4 w-4" />
		</Button>
	);
};

export default function ChatInputBox({
	conversationId,
	scrollRef,
}: {
	conversationId?: string;
	scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const selectedModelPreferences = useStore(selectedModelPreferencesStore);

	const searchEnabled = useStore(
		settingsStore,
		(store) => store.google.config.useSearchGrounding,
	);

	useEffect(() => {
		scrollRef?.current && scrollToBottom(scrollRef.current, "instant");
	}, [conversationId, scrollRef]);

	const handleSend = () => {
		const input = inputRef.current?.value || "";
		if (inputRef.current) {
			inputRef.current.value = "";
		}
		if (input.trim() === "") {
			return;
		}

		const title = input.slice(0, 30) || "New Chat";
		const convId = conversationId || createConversation(title);

		addMessage(convId, {
			role: "user",
			message: input,
			conversationId: convId,
			meta_tokens: 0,
		});

		scrollRef?.current && scrollToBottom(scrollRef.current, "smooth");

		if (!conversationId) {
			navigate({ to: `/chats/${convId}` });
		}

		generateResponse(convId);
	};

	return (
		<div className="flex relative items-center justify-center pb-4">
			<IsAtBottomButton scrollRef={scrollRef} />
			<div className="flex flex-col flex-1 items-center border-1 border-t-6 pt-2 rounded-sm max-w-3xl mx-2">
				<ChatInput
					placeholder="Type your message here..."
					ref={inputRef}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							handleSend();
						}
					}}
					className="flex-1 p-2 text-lg! bg-background! border-0! focus:ring-ring/0!"
				/>
				<div className="flex w-full h-8 items-center text-sm border-t-border border-t-2 bg-muted">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex h-full items-center gap-2 px-2 border-r-2"
							>
								<div>{ModelsInfo[selectedModelPreferences.model].name}</div>
								<div className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
									<Command size={10} />
									<ArrowBigUpDash size={14} /> M
								</div>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{PerAvailableModelProvidersList.map(([providerId, models]) => (
								<React.Fragment key={providerId}>
									<DropdownMenuLabel>
										{ProvidersInfo[providerId as ProvidersEnum].name}
									</DropdownMenuLabel>
									{models.map((model) => (
										<DropdownMenuItem
											key={model.id}
											onClick={() =>
												updateSelectedModelPreferences(model.id, providerId)
											}
										>
											{model.name}
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
								</React.Fragment>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<Tooltip>
						<TooltipTrigger
							asChild
							className={`${searchEnabled ? "bg-primary" : "bg-card"} flex h-full items-center gap-2 px-2   border-r-2`}
						>
							<button type="button" onClick={() => toggleSearch()}>
								<Globe size={14} />
							</button>
						</TooltipTrigger>
						<TooltipContent className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
							<Command size={10} />
							<ArrowBigUpDash size={14} /> M
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							asChild
							className={`${searchEnabled ? "bg-primary" : "bg-card"} flex h-full items-center gap-2 px-2  ml-auto border-l-2`}
						>
							<button type="button" className="">
								Send
								<div className="flex items-center gap-1 text-xs font-bold p-1">
									<CornerDownLeft size={10} />
								</div>
							</button>
						</TooltipTrigger>
						<TooltipContent className="flex items-center gap-1 text-xs font-bold p-1 bg-muted">
							Send the message
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</div>
	);
}
