import { useRef, useState } from "react";
import {
	smoothStream,
	streamText,
	type CoreMessage,
	type FinishReason,
	type LanguageModel,
	type LanguageModelUsage,
} from "ai";

type StreamStatus =
	| "ready"
	| "submitted"
	| "reasoning"
	| "generating"
	| "error";

interface UseStreamTextOptions {
	model: LanguageModel;
	messages: CoreMessage[];
	system?: string;
	maxSteps?: number;
	onChunk?: (chunk: { type: string; textDelta?: string }) => void;
	onError?: (error: unknown) => void;
	onFinish?: (event: {
		usage: LanguageModelUsage;
		finishReason: FinishReason;
	}) => void;
}

export function useStreamText() {
	const [status, setStatus] = useState<StreamStatus>("ready");
	const abortController = useRef<AbortController | null>(null);

	const stream = async (options: UseStreamTextOptions) => {
		try {
			setStatus("submitted");

			abortController.current = new AbortController();
			const result = streamText({
				...options,
				onChunk: ({ chunk }) => {
					if (chunk.type === "reasoning") {
						setStatus("reasoning");
					} else if (chunk.type === "text-delta") {
						setStatus("generating");
					}
					options.onChunk?.(chunk);
				},
				onError: (error: { error: unknown }) => {
					if (
						error.error instanceof Error &&
						error.error.name === "AbortError"
					) {
						setStatus("ready");
					}
					options.onError?.(error);
				},
				onFinish: (event) => {
					options.onFinish?.(event);
				},
				abortSignal: abortController.current.signal,
				// experimental_transform: [smoothStream()],
			});

			for await (const _ of result.textStream) {
				// Stream is being consumed
			}
			abortController.current = null;
			setStatus("ready");
			return result;
		} catch (error) {
			setStatus("error");
			throw error;
		}
	};

	const stop = () => {
		if (abortController.current) {
			abortController.current.abort();
			abortController.current = null;
		}
	};

	return {
		stream,
		status,
		stop,
	};
}

