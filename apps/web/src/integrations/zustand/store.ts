import { createStore } from "zustand/vanilla";
import { create, useStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatStore {
  // Conversations state
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (title: string) => string;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;

  // Chat messages state
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (messageInfo: Pick<ChatMessage, "role" | "content" | "conversationId">) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  getMessagesByConversationId: (conversationId: string) => ChatMessage[];
}

const generateId = () => {
  return crypto.randomUUID();
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Conversations
      conversations: [],
      setConversations: (conversations: Conversation[]) =>
        set({ conversations }),
      addConversation: (title: string) => {
        const id = generateId();
        set((state) => ({
          conversations: [
            ...state.conversations,
            { id: id, title, createdAt: new Date(), updatedAt: new Date() },
          ],
        }));
        return id;
      },
      updateConversation: (id: string, updates: Partial<Conversation>) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id
              ? { ...conv, updatedAt: new Date(), ...updates }
              : conv
          ),
        })),
      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((conv) => conv.id !== id),
        })),

      // Chat messages
      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (messageInfo: Pick<ChatMessage, "role" | "content" | "conversationId">) =>
        {
          const id = generateId();
          set((state) => ({
            messages: [...state.messages, { id, ...messageInfo, createdAt: new Date(), updatedAt: new Date() }],
          }));
          return id;
        },
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        })),
      deleteMessage: (id) =>
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        })),
      getMessagesByConversationId: (conversationId) =>
        get()
          .messages.filter((msg) => msg.conversationId === conversationId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    }),
    {
      name: "chat-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// export const useBoundStore = <T>(
// 	selector: (state: ChatStore) => T,
// ) => useStore(ChatStore, selector);
