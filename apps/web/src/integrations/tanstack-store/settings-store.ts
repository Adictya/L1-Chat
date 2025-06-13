import { Store } from "@tanstack/store";
import { Providers, type ProvidersEnum } from "./models-store";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Provider } from "ai";

// Save the api keys in the browser's local storage
const settingsStore = new Store<
	Record<
		ProvidersEnum,
		{
			apiKey: string;
			provider: Provider | Omit<Provider, "imageModel" | "textEmbeddingModel">;
			config: Record<string, string | boolean>;
		}
	>
>({
	[Providers.openai]: {
		apiKey: "" as string,
		provider: createOpenAI({ apiKey: "" }),
		config: {},
	},
	[Providers.google]: {
		apiKey: "" as string,
		provider: createGoogleGenerativeAI({ apiKey: "" }),
		config: {
			useSearchGrounding: true,
		},
	},
	[Providers.anthropic]: {
		apiKey: "" as string,
		provider: createAnthropic({ apiKey: "" }),
		config: {},
	},
	[Providers.openrouter]: {
		apiKey: "" as string,
		provider: createOpenRouter({ apiKey: "" }),
		config: {},
	},
} as const);

export const updateOpenAIApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.openai]: {
			apiKey,
			provider: createOpenAI({ apiKey }),
			config: state[Providers.openai].config,
		},
	}));
};

export const updateGeminiApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.google]: {
			apiKey,
			provider: createGoogleGenerativeAI({ apiKey }),
			config: state[Providers.google].config,
		},
	}));
};

export const toggleSearch = () => {
	settingsStore.setState((state) => {
		const newState = { ...state };
		newState.google.config.useSearchGrounding =
			!newState.google.config.useSearchGrounding;
		return newState;
	});
};

export const updateClaudeApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.anthropic]: {
			apiKey,
			provider: createAnthropic({
				apiKey,
				headers: { "anthropic-dangerous-direct-browser-access": "true" },
			}),
			config: state[Providers.anthropic].config,
		},
	}));
};

export const updateOpenRouterApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.openrouter]: {
			apiKey,
			provider: createOpenRouter({ apiKey }),
			config: state[Providers.openrouter].config,
		},
	}));
};

const updatersMap = {
	[Providers.openai]: updateOpenAIApiKey,
	[Providers.google]: updateGeminiApiKey,
	[Providers.anthropic]: updateClaudeApiKey,
	[Providers.openrouter]: updateOpenRouterApiKey,
};

const apiKeys = localStorage.getItem("settings");
if (apiKeys) {
	const parsedApiKeys = JSON.parse(apiKeys);
	for (const [provider, apiKey] of Object.entries(parsedApiKeys)) {
		updatersMap[provider as ProvidersEnum](apiKey as string);
	}
}

// Save the settings in the browser's local storage
settingsStore.subscribe((state) => {
	const apiKeys = {
		[Providers.openai]: state.currentVal[Providers.openai].apiKey,
		[Providers.google]: state.currentVal[Providers.google].apiKey,
		[Providers.anthropic]: state.currentVal[Providers.anthropic].apiKey,
		[Providers.openrouter]: state.currentVal[Providers.openrouter].apiKey,
	};
	localStorage.setItem("settings", JSON.stringify(apiKeys));
});

export const getSettings = () => {
	return settingsStore.state;
};

export default settingsStore;
