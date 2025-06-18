import React, { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import {
	Form,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { syncEventManager } from "@/integrations/tanstack-store/chats-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { u } from "@/lib/utils";
import {
	updateOpenAIApiKey,
	updateGeminiApiKey,
	updateClaudeApiKey,
	updateOpenRouterApiKey,
} from "@/integrations/tanstack-store/settings-store";
import settingsStore from "@/integrations/tanstack-store/settings-store";

// 1. Define the Zod schema
const settingsSchema = z.object({
	openaiApiKey: z.string().optional(),
	geminiApiKey: z.string().optional(),
	claudeApiKey: z.string().optional(),
	openRouterApiKey: z.string().optional(),
});

// API key type to match server schema
type ApiKeys = {
	openai: string;
	google: string;
	anthropic: string;
	openrouter: string;
};

// API functions
const fetchApiKeys = async (): Promise<ApiKeys> => {
	const response = await fetch(u("/api/apiKeys"), {
		credentials: "include",
	});
	
	if (response.status === 404) {
		// No API keys saved yet, return empty keys
		return {
			openai: "",
			google: "",
			anthropic: "",
			openrouter: "",
		};
	}
	
	if (!response.ok) {
		throw new Error("Failed to fetch API keys");
	}
	
	return response.json();
};

const saveApiKeys = async (apiKeys: ApiKeys): Promise<void> => {
	const response = await fetch(u("/api/apiKeys"), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(apiKeys),
	});

	if (!response.ok) {
		throw new Error("Failed to save API keys");
	}
};

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const navigate = useNavigate();
	const [showKeys, setShowKeys] = useState(false);
	const queryClient = useQueryClient();

	// Fetch API keys using React Query
	const localSettings = settingsStore.state;
	const initialApiKeys = {
		openai: localSettings.openai?.apiKey || "",
		google: localSettings.google?.apiKey || "",
		anthropic: localSettings.anthropic?.apiKey || "",
		openrouter: localSettings.openrouter?.apiKey || "",
	};
	const { data: apiKeys, isLoading, error } = useQuery({
		queryKey: ["apiKeys"],
		queryFn: fetchApiKeys,
		initialData: initialApiKeys,
	});

	// Save API keys mutation
	const saveMutation = useMutation({
		mutationFn: saveApiKeys,
		onSuccess: (_, variables) => {
			// Update local settings store
			updateOpenAIApiKey(variables.openai);
			updateGeminiApiKey(variables.google);
			updateClaudeApiKey(variables.anthropic);
			updateOpenRouterApiKey(variables.openrouter);
			
			// Invalidate and refetch API keys
			queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
			
			// Emit sync event for other components
			syncEventManager.emit<"apiKeyChanged">({
				type: "apiKeyChanged",
				keys: Object.values(variables).join(","),
			});
		},
		onError: (error) => {
			console.error("Error saving API keys:", error);
		},
	});

	// 2. Use the schema with react-hook-form
	const form = useForm<z.infer<typeof settingsSchema>>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			openaiApiKey: apiKeys?.openai || "",
			geminiApiKey: apiKeys?.google || "",
			claudeApiKey: apiKeys?.anthropic || "",
			openRouterApiKey: apiKeys?.openrouter || "",
		},
		mode: "onChange",
	});

	// Update form when API keys are loaded
	React.useEffect(() => {
		if (apiKeys) {
			form.reset({
				openaiApiKey: apiKeys.openai || "",
				geminiApiKey: apiKeys.google || "",
				claudeApiKey: apiKeys.anthropic || "",
				openRouterApiKey: apiKeys.openrouter || "",
			});
		}
	}, [apiKeys, form]);

	const { isDirty } = form.formState;

	async function onSubmit(values: z.infer<typeof settingsSchema>) {
		const apiKeysData = {
			openai: values.openaiApiKey || "",
			google: values.geminiApiKey || "",
			anthropic: values.claudeApiKey || "",
			openrouter: values.openRouterApiKey || "",
		};

		saveMutation.mutate(apiKeysData);
	}

	if (isLoading) {
		return (
			<div className="min-h-screen flex-1 bg-background p-8">
				<div className="max-w-2xl mx-auto">
					<div className="flex items-center justify-center">
						<div className="text-foreground">Loading...</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex-1 bg-background p-8">
				<div className="max-w-2xl mx-auto">
					<div className="flex items-center justify-center">
						<div className="text-foreground text-red-500">
							Error loading API keys: {error.message}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex-1 bg-background p-8">
			<div className="max-w-2xl mx-auto">
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-2xl font-bold text-foreground">Settings</h1>
					<Button variant="outline" onClick={() => navigate({ to: "/" })}>
						Back to Chat
					</Button>
				</div>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>API Keys</CardTitle>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowKeys(!showKeys)}
								aria-label={showKeys ? "Hide API keys" : "Show API keys"}
							>
								{showKeys ? (
									<EyeOff className="h-5 w-5" />
								) : (
									<Eye className="h-5 w-5" />
								)}
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
								autoComplete="off"
							>
								<FormField
									control={form.control}
									name="openaiApiKey"
									render={({ field }) => (
										<FormItem>
											<FormLabel>OpenAI API Key</FormLabel>
											<FormControl>
												<Input
													{...field}
													id="openai-key"
													type={showKeys ? "text" : "password"}
													placeholder="sk-..."
													disabled={isLoading || saveMutation.isPending}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="geminiApiKey"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Gemini API Key</FormLabel>
											<FormControl>
												<Input
													{...field}
													id="gemini-key"
													type={showKeys ? "text" : "password"}
													placeholder="AIza..."
													disabled={isLoading || saveMutation.isPending}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="claudeApiKey"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Claude API Key</FormLabel>
											<FormControl>
												<Input
													{...field}
													id="claude-key"
													type={showKeys ? "text" : "password"}
													placeholder="sk-..."
													disabled={isLoading || saveMutation.isPending}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="openRouterApiKey"
									render={({ field }) => (
										<FormItem>
											<FormLabel>OpenRouter API Key</FormLabel>
											<FormControl>
												<Input
													{...field}
													id="openrouter-key"
													type={showKeys ? "text" : "password"}
													placeholder="sk-..."
													disabled={isLoading || saveMutation.isPending}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{isDirty && (
									<div className="flex justify-end mt-6">
										<Button 
											type="submit" 
											disabled={saveMutation.isPending}
										>
											<Save className="mr-2 h-4 w-4" />
											{saveMutation.isPending ? "Saving..." : "Save Changes"}
										</Button>
									</div>
								)}
							</form>
						</Form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
