import { useRef, useState } from "react";
import {
	smoothStream,
	streamText,
	type CoreMessage,
	type FinishReason,
	type LanguageModel,
	type LanguageModelUsage,
	type StreamTextOnChunkCallback,
	type Tool,
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
	onChunk?: (
		chunk: Parameters<
			StreamTextOnChunkCallback<{ [key: string]: Tool }>
		>[0]["chunk"],
	) => void;
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
			console.log(
				"Abort controller ref",
				abortController.current,
				abortController.current.signal,
			);
			const result = streamText({
				...options,
				onChunk: (param) => {
					if (param.chunk.type === "reasoning") {
						setStatus("reasoning");
					} else if (param.chunk.type === "text-delta") {
						setStatus("generating");
					}
					options.onChunk?.(param.chunk);
				},
				onError: (error: { error: unknown }) => {
					console.log("Error", error);
					if (
						error.error instanceof Error &&
						error.error.name === "AbortError"
					) {
						setStatus("ready");
					}
					options.onError?.(error);
					setStatus("error");
					throw new Error("Generation failed");
				},
				onFinish: (event) => {
					options.onFinish?.(event);
				},
				abortSignal: abortController.current.signal,
				experimental_transform: [smoothStream()],
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
