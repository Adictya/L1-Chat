import { Store } from "@tanstack/store";
import {
	Models,
	Providers,
	type ModelsEnum,
	type ProvidersEnum,
} from "./models-store";
import {
	createGoogleGenerativeAI,
	google,
	type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import {
	createOpenAI,
	openai,
	type OpenAIResponsesProviderOptions,
} from "@ai-sdk/openai";
import {
	createAnthropic,
	type AnthropicProviderOptions,
} from "@ai-sdk/anthropic";
import {
	createOpenRouter,
	type OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";
import type { Provider } from "ai";

// Save the api keys in the browser's local storage
const settingsStore = new Store<
	Record<
		ProvidersEnum,
		{
			apiKey: string;
			provider: Provider | Omit<Provider, "imageModel" | "textEmbeddingModel">;
		}
	>
>({
	[Providers.openai]: {
		apiKey: "" as string,
		provider: createOpenAI({ apiKey: "" }),
	},
	[Providers.google]: {
		apiKey: "" as string,
		provider: createGoogleGenerativeAI({ apiKey: "" }),
		// config: {
		// 	useSearchGrounding: true,
		// 	reasoning: true,
		// },
	},
	[Providers.anthropic]: {
		apiKey: "" as string,
		provider: createAnthropic({ apiKey: "" }),
	},
	[Providers.openrouter]: {
		apiKey: "" as string,
		provider: createOpenRouter({ apiKey: "" }),
	},
} as const);

export const updateOpenAIApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.openai]: {
			apiKey,
			provider: createOpenAI({ apiKey }),
		},
	}));
};

export const updateGeminiApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.google]: {
			apiKey,
			provider: createGoogleGenerativeAI({ apiKey }),
		},
	}));
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
		},
	}));
};

export const updateOpenRouterApiKey = (apiKey: string) => {
	settingsStore.setState((state) => ({
		...state,
		[Providers.openrouter]: {
			apiKey,
			provider: createOpenRouter({ apiKey }),
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

type NonNullable<T> = Exclude<T, null | undefined>; // Remove null and undefined from T

type GoogleSettings = NonNullable<Parameters<typeof google>[1]>;
type OpenAiSettings = NonNullable<Parameters<typeof openai>[1]>;
type AnthropicSettings = undefined;
type OpenRouterSettings = undefined;

type ProviderConfig = {
	[Providers.google]: {
		config?: GoogleSettings;
		providerOptions?: GoogleGenerativeAIProviderOptions;
	};
	[Providers.openai]: {
		config?: OpenAiSettings;
		providerOptions?: OpenAIResponsesProviderOptions;
	};
	[Providers.anthropic]: {
		config?: AnthropicSettings;
		providerOptions?: AnthropicProviderOptions;
	};
	[Providers.openrouter]: {
		config?: OpenRouterSettings;
		providerOptions?: OpenRouterProviderOptions;
	};
};

export type ModelPreference = {
	reasoningEffort?: "low" | "medium" | "high";
	disableableReasoning?: boolean;
	search?: boolean;
};

export const selectedModelPreferencesStore = new Store<{
	model: ModelsEnum;
	provider: ProvidersEnum;
	settings: ModelPreference;
}>({
	model: Models.Gemini_2_0_Flash,
	provider: Providers.google,
	settings: {
		disableableReasoning: false,
		reasoningEffort: "low",
		search: true,
	},
});

export function getProviderConfig<T extends ProvidersEnum>(
	provider: ProvidersEnum,
	settings: ModelPreference,
): ProviderConfig[T] {
	const reasoningEffortToBudgetTokens: Record<string, number> = {
		low: 100,
		medium: 1000,
		high: 1000,
	};

	switch (provider) {
		case Providers.google:
			return {
				config: {
					useSearchGrounding: settings.search,
				},
				providerOptions: {
					thinkingConfig: {
						includeThoughts: settings.disableableReasoning,
						thinkingBudget:
							!settings.disableableReasoning && settings.reasoningEffort
								? reasoningEffortToBudgetTokens[settings.reasoningEffort]
								: 0,
					},
				},
			} satisfies ProviderConfig[typeof Providers.google] as ProviderConfig[T];
		case Providers.openai:
			return {
				config: {
					reasoningEffort: settings.reasoningEffort,
				},
			} satisfies ProviderConfig[typeof Providers.openai] as ProviderConfig[T];
		case Providers.anthropic:
			return {
				providerOptions: {
					thinking: {
						type: settings.disableableReasoning ? "disabled" : "enabled",
						budgetTokens:
							!settings.disableableReasoning && settings.reasoningEffort
								? reasoningEffortToBudgetTokens[settings.reasoningEffort]
								: 0,
					},
				},
			} satisfies ProviderConfig[typeof Providers.anthropic] as ProviderConfig[T];
		case Providers.openrouter:
			return {
				providerOptions: {
					reasoning:
						!settings.disableableReasoning && settings.reasoningEffort
							? {
									effort: settings.reasoningEffort,
								}
							: undefined,
				},
			} satisfies ProviderConfig[typeof Providers.openrouter] as ProviderConfig[T];
	}
}

export const updateSelectedModelPreferences = (
	model?: ModelsEnum,
	provider?: ProvidersEnum,
	settings?: Partial<ModelPreference>,
) => {
	selectedModelPreferencesStore.setState((prev) => ({
		...prev,
		model: model ?? prev.model,
		provider: provider ?? prev.provider,
		settings: settings ? { ...prev.settings, ...settings } : prev.settings,
	}));
};

export const modelSettingsStore = new Store<ModelPreference>({
	reasoningEffort: "low",
	disableableReasoning: false,
	search: true,
});

export default settingsStore;
