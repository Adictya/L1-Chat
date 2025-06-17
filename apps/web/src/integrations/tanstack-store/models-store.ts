import type { ProvidersEnum, ModelsEnum } from "l1-sync/types";
import { Providers, Models } from "l1-sync/types";

export interface ProviderInfo {
	id: ProvidersEnum;
	name: string;
	baseUrl: string;
}

export const ProvidersInfo = {
	[Providers.google]: {
		id: Providers.google,
		name: "Google",
		baseUrl: "https://generativelanguage.googleapis.com",
	},
	[Providers.openai]: {
		id: Providers.openai,
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
	},
	[Providers.anthropic]: {
		id: Providers.anthropic,
		name: "Anthropic",
		baseUrl: "https://api.anthropic.com",
	},
	[Providers.openrouter]: {
		id: Providers.openrouter,
		name: "OpenRouter",
		baseUrl: "https://openrouter.ai/api/v1",
	},
} as const satisfies Record<ProvidersEnum, ProviderInfo>;

type Capabilities = {
	search?: boolean;
	reasoning?: boolean;
	disableableReasoning?: boolean;
};

export interface ModelProviderConfig {
	provider: ProvidersEnum;
	model: string;
	capabilities: Capabilities;
}

export interface ModelConfig {
	id: ModelsEnum;
	name: string;
	providers: Partial<Record<ProvidersEnum, ModelProviderConfig>>;
}

export const ModelsInfo: Record<ModelsEnum, ModelConfig> = {
	[Models.Gemini_2_0_Flash]: {
		id: Models.Gemini_2_0_Flash,
		name: "Gemini 2.0 Flash",
		providers: {
			[Providers.google]: {
				provider: Providers.google,
				model: "gemini-2.0-flash",
				capabilities: {
					search: true,
				},
			},
		},
	},
	[Models.Gemini_2_5_Flash]: {
		id: Models.Gemini_2_5_Flash,
		name: "Gemini 2.5 Flash",
		providers: {
			[Providers.google]: {
				provider: Providers.google,
				model: "gemini-2.5-flash-preview-05-20",
				capabilities: {
					search: true,
					reasoning: true,
					disableableReasoning: true,
				},
			},
		},
	},
	[Models.Gemini_2_5_Pro]: {
		id: Models.Gemini_2_5_Pro,
		name: "Gemini 2.5 Pro",
		providers: {
			[Providers.google]: {
				provider: Providers.google,
				model: "gemini-2.5-pro-preview-06-05",
				capabilities: {
					search: true,
					reasoning: true,
				},
			},
			[Providers.openrouter]: {
				provider: Providers.openrouter,
				model: "google/gemini-2.5-pro-preview",
				capabilities: {
					reasoning: true,
				},
			},
		},
	},
	[Models.Claude_3_5_Sonnet]: {
		id: Models.Claude_3_5_Sonnet,
		name: "Claude 3.5 Sonnet",
		providers: {
			[Providers.anthropic]: {
				provider: Providers.anthropic,
				model: "claude-3-5-sonnet-latest",
				capabilities: {
					reasoning: true,
				},
			},
		},
	},
} as const satisfies Record<ModelsEnum, ModelConfig>;

// Return a map of providers to models
export const PerProviderModels = Object.fromEntries(
	Object.values(ProvidersInfo).map((provider) => [
		provider.id,
		Object.values(ModelsInfo).filter((model) => provider.id in model.providers),
	]),
) as Record<ProvidersEnum, ModelConfig[]>;

export const PerAvailableModelProvidersList = Object.entries(
	PerProviderModels,
).filter(([_, models]) => models.length > 0) as [
	ProvidersEnum,
	ModelConfig[],
][];

export type { ModelsEnum, ProvidersEnum };
export { Models, Providers };

