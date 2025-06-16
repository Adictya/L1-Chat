export const Models = {
    Gemini_2_0_Flash: 'Gemini_2_0_Flash',
    Gemini_2_5_Flash: 'Gemini_2_5_Flash',
    Gemini_2_5_Pro: 'Gemini_2_5_Pro',
    Claude_3_5_Sonnet: 'Claude_3_5_Sonnet',
} as const satisfies Record<string, string>;

export type ModelsEnum = typeof Models[keyof typeof Models];


export const Providers = {
    google: "google",
    openai: "openai",
    anthropic: "anthropic",
    openrouter: "openrouter",
} as const;

export type ProvidersEnum = typeof Providers[keyof typeof Providers];
