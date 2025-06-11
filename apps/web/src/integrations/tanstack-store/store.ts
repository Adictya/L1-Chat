import { Store } from '@tanstack/store';


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

const store = new Store<{
	conversations: Conversation[];
	messages: ChatMessage[];
}>({
	conversations: [],
	messages: [],
});

export const addConversation = (title: string) => {
	store.setState((state) => ({
		conversations: [...state.conversations, { id: crypto.randomUUID(), title, createdAt: new Date(), updatedAt: new Date() }],
	}));
};

export const addMessage = (message: ChatMessage) => {
	store.setState((state) => ({
		messages: [...state.messages, message],
	}));
};

export const updateMessage = (message: ChatMessage) => {
	store.setState((state) => ({
		messages: state.messages.map((m) => m.id === message.id ? message : m),
	}));
};

export const deleteMessage = (message: ChatMessage) => {
	store.setState((state) => ({
		messages: state.messages.filter((m) => m.id !== message.id),
	}));
};

export const getMessagesByConversationId = (conversationId: string) => {
	return store.get().messages.filter((m) => m.conversationId === conversationId);
};

export const getConversations = () => {
	return store.get().conversations;
};

export const getMessages = () => {
	return store.get().messages;
};

export const getConversationById = (id: string) => {
	return store.get().conversations.find((c) => c.id === id);
};

export const getMessageById = (id: string) => {
	return store.get().messages.find((m) => m.id === id);
};

export default store;