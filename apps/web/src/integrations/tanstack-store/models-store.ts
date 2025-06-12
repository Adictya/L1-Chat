export const Providers = {
    google: "google",
    openai: "openai",
    anthropic: "anthropic",
    openrouter: "openrouter",
} as const;

export type ProvidersEnum = typeof Providers[keyof typeof Providers];

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

export const Models = {
    Gemini_2_0_Flash: 'Gemini_2_0_Flash',
    Gemini_2_5_Flash: 'Gemini_2_5_Flash',
    Gemini_2_5_Pro: 'Gemini_2_5_Pro',
    Claude_3_5_Sonnet: 'Claude_3_5_Sonnet',
} as const satisfies Record<string, string>;

export type ModelsEnum = typeof Models[keyof typeof Models];


export interface ModelProviderConfig {
  provider: ProvidersEnum;
  model: string;
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
      },
      [Providers.openrouter]: {
        provider: Providers.openrouter,
        model: "google/gemini-2.5-pro-preview",
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
      },
    },
  },
} as const satisfies Record<ModelsEnum, ModelConfig>;

// Return a map of providers to models 
export const PerProviderModels = Object.fromEntries(
  Object.values(ProvidersInfo).map((provider) => [
    provider.id,
    Object.values(ModelsInfo)
      .filter((model) => provider.id in model.providers)
  ])
) as Record<ProvidersEnum, ModelConfig[]>;

export const PerAvailableModelProvidersList = Object.entries(PerProviderModels).filter(([_, models]) => models.length > 0) as [ProvidersEnum, ModelConfig[]][];