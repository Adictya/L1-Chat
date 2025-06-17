import { Store } from "@tanstack/store";
import { syncEventManager } from "./chats-store";

export type Attachment = {
	id: string;
	name: string;
	type: string;
	timestamp: number;
	sent?: boolean;
};

export const attachmentsStore = new Store<Attachment[]>([]);

export const addAttachment = (attachment: Attachment) => {
  console.log("Adding attachment", attachment);
	attachmentsStore.setState((state) => [...state, attachment]);
};

export const removeAttachment = (id: string, noBroadcast?: boolean) => {
	attachmentsStore.setState((state) => state.filter((a) => a.id !== id));
	if (!noBroadcast) {
		syncEventManager.emit<"removeAttachment">({
			type: "removeAttachment",
			id,
		});
	}
};

export const markAttachmentsAsSent = (ids: string[]) => {
	attachmentsStore.setState((state) =>
		state.map((attachment) =>
			ids.includes(attachment.id) ? { ...attachment, sent: true } : attachment,
		),
	);

	const attachments: Attachment[] = attachmentsStore.state.filter(
		(attachment) => ids.includes(attachment.id),
	);

	for (const attachment of attachments) {
		syncEventManager.emit<"addAttachment">({
			type: "addAttachment",
			attachment,
		});
	}
};

export const clearAttachments = () => {
	attachmentsStore.setState([]);
};

