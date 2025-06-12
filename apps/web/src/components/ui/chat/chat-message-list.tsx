import * as React from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/components/ui/chat/hooks/useAutoScroll";

interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
	smooth?: boolean;
}

const ChatMessageList = React.forwardRef<HTMLDivElement, ChatMessageListProps>(
	({ className, children, smooth = false, ...props }, _ref) => {
		const { scrollRef, isAtBottom, scrollToBottom, disableAutoScroll } =
			useAutoScroll({
				content: children,
			});

		return (
			// <div className="relative h-[calc(100%-81px)] w-full">
			<>
				<div
					className={`flex flex-col items-center basis-0 flex-1 p-4 overflow-y-auto ${className}`}
					ref={scrollRef}
					onWheel={disableAutoScroll}
					onTouchMove={disableAutoScroll}
					style={{
						flexFlow: "column",
						WebkitFlexFlow: "column",
					}}
					{...props}
				>
					<div className="flex w-full flex-col gap-6 max-w-3xl">{children}</div>
				</div>

				{!isAtBottom && (
					<Button
						onClick={() => {
							scrollToBottom();
						}}
						size="icon"
						variant="outline"
						className="absolute bottom-25 right-10 transform -translate-x-1/2 inline-flex rounded-full shadow-md"
						aria-label="Scroll to bottom"
					>
						<ArrowDown className="h-4 w-4" />
					</Button>
				)}
			</>
		);
	},
);

ChatMessageList.displayName = "ChatMessageList";

export { ChatMessageList };
