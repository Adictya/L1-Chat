import { Store } from "@tanstack/store";

export type Attachment = {
  id: string;
  name: string;
  type: string;
  timestamp: number;
  sent?: boolean;
};

export const attachmentsStore = new Store<Attachment[]>([]);

export const addAttachment = (attachment: Attachment) => {
  attachmentsStore.setState((state) => [...state, attachment]);
};

export const removeAttachment = (id: string) => {
  attachmentsStore.setState((state) => state.filter((a) => a.id !== id));
};

export const markAttachmentsAsSent = (ids: string[]) => {
  attachmentsStore.setState((state) =>
    state.map((attachment) =>
      ids.includes(attachment.id) ? { ...attachment, sent: true } : attachment
    )
  );
};

export const clearAttachments = () => {
  attachmentsStore.setState([]);
}; 