import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Save } from "lucide-react";
import settingsStore, {
	updateOpenAIApiKey,
	updateGeminiApiKey,
	updateClaudeApiKey,
	updateOpenRouterApiKey,
} from "../integrations/tanstack-store/settings-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@tanstack/react-store";
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

// 1. Define the Zod schema
const settingsSchema = z.object({
	openaiApiKey: z.string().optional(),
	geminiApiKey: z.string().optional(),
	claudeApiKey: z.string().optional(),
	openRouterApiKey: z.string().optional(),
});

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const navigate = useNavigate();
	const [showKeys, setShowKeys] = useState(false);
	const settings = useStore(settingsStore);

	// 2. Use the schema with react-hook-form
	const form = useForm<z.infer<typeof settingsSchema>>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			openaiApiKey: settings.openai.apiKey,
			geminiApiKey: settings.google.apiKey,
			claudeApiKey: settings.anthropic.apiKey,
			openRouterApiKey: settings.openrouter.apiKey,
		},
		mode: "onChange",
	});

	const { isDirty } = form.formState;

	function onSubmit(values: z.infer<typeof settingsSchema>) {
		updateOpenAIApiKey(values.openaiApiKey || "");
		updateGeminiApiKey(values.geminiApiKey || "");
		updateClaudeApiKey(values.claudeApiKey || "");
		updateOpenRouterApiKey(values.openRouterApiKey || "");
		form.reset(values);
	}

	return (
		<div className="min-h-screen flex-1 bg-background p-8">
			<div className="max-w-2xl mx-auto">
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-2xl font-bold text-foreground">Settings</h1>
					<Button
						variant="outline"
						onClick={() => navigate({ to: "/" })}
					>
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
								{showKeys ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{isDirty && (
									<div className="flex justify-end mt-6">
										<Button type="submit">
											<Save className="mr-2 h-4 w-4" />
											Save Changes
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

