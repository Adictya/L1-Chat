import * as React from "react";
import type { Store } from "@tanstack/store";

interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
	smooth?: boolean;
	messageStore: Store<any>;
}

const ChatMessageList = React.forwardRef<HTMLDivElement, ChatMessageListProps>(
	({ className, children, messageStore, smooth = false, ...props }, _ref) => {
		return (
			<div
				className={`flex flex-col items-center basis-0 flex-1 p-4 h-full overflow-y-auto scroll-auto ${className}`}
				ref={_ref}
        id="message-list"
				style={{
					flexFlow: "column",
					WebkitFlexFlow: "column",
				}}
				{...props}
			>
				<div className="flex w-full flex-col gap-6 max-w-3xl h-full">{children}</div>
			</div>
		);
	},
);

ChatMessageList.displayName = "ChatMessageList";

export { ChatMessageList };
