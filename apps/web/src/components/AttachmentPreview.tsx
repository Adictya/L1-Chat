import { useEffect, useState } from "react";
import { getFile, storeFile } from "@/lib/indexed-db";
import type { Attachment } from "@/integrations/tanstack-store/attachments-store";
import { FileText, X } from "lucide-react";
import { Button } from "./ui/button";
import { AttachmentPreviewDialog } from "./AttachmentPreviewDialog";
import { cn } from "@/lib/utils";

export interface AttachmentPreviewProps {
	attachment: Attachment;
	onRemove?: (id: string) => void;
}

const chars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Use a lookup table to find the index.
const lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
	lookup[chars.charCodeAt(i)] = i;
}

export const decode = (base64: string): ArrayBuffer => {
	let bufferLength = base64.length * 0.75,
		len = base64.length,
		i,
		p = 0,
		encoded1,
		encoded2,
		encoded3,
		encoded4;

	if (base64[base64.length - 1] === "=") {
		bufferLength--;
		if (base64[base64.length - 2] === "=") {
			bufferLength--;
		}
	}

	const arraybuffer = new ArrayBuffer(bufferLength),
		bytes = new Uint8Array(arraybuffer);

	for (i = 0; i < len; i += 4) {
		encoded1 = lookup[base64.charCodeAt(i)];
		encoded2 = lookup[base64.charCodeAt(i + 1)];
		encoded3 = lookup[base64.charCodeAt(i + 2)];
		encoded4 = lookup[base64.charCodeAt(i + 3)];

		bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
		bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
		bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
	}

	return arraybuffer;
};

export function AttachmentPreview({
	attachment,
	onRemove,
}: AttachmentPreviewProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [showPreview, setShowPreview] = useState(false);
	const isImage = attachment.type.startsWith("image/");

	useEffect(() => {
		const loadFile = async () => {
			if (previewUrl) {
				return;
			}
			let file = await getFile(attachment.id);
			if (!file) {
				// todo: env
				const res = await fetch(`/api/download?attachmentId=${attachment.id}`, {
					credentials: "include",
				});

				const data = await res.json();

				if (!data.length) {
					console.warn("No data found for attachment", attachment.id);
					return;
				}

				const fileData = data[0];
				file = {
					data: decode(fileData.fileData),
					type: fileData.attachmentInfo.type,
					id: fileData.attachmentInfo.id,
					name: fileData.attachmentInfo.name,
					timestamp: fileData.attachmentInfo.timestamp,
				};

				storeFile(new File([file.data], file.name, { type: file.type }));
			}
			const blob = new Blob([file.data], { type: file.type });

			const url = URL.createObjectURL(blob);
			setPreviewUrl(url);
		};

		loadFile();

		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [attachment.id, previewUrl]);

	const handlePreview = () => {
		setShowPreview(true);
	};

	return (
		<>
			<div
				tabIndex={0}
				className={cn(
					"h-12 relative flex items-center gap-2 rounded-lg border bg-card p-2 text-card-foreground shadow-sm",
					"max-w-[200px] hover:bg-accent cursor-pointer",
				)}
				onClick={handlePreview}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handlePreview();
					}
				}}
				role="tab"
			>
				{isImage && previewUrl ? (
					<img
						src={previewUrl}
						alt={attachment.name}
						className="h-8 w-8 object-cover rounded-sm"
					/>
				) : (
					<div className="flex h-12 w-12 items-center justify-center">
						<FileText className="h-6 w-6" />
					</div>
				)}
				<div className="flex-1 min-w-0">
					<p className="truncate text-sm font-medium">{attachment.name}</p>
					<p className="text-xs text-muted-foreground">
						{attachment.type.split("/")[1].toUpperCase()}
					</p>
				</div>
				{onRemove && (
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={(e) => {
							e.stopPropagation();
							onRemove(attachment.id);
						}}
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>
			{showPreview && previewUrl && (
				<AttachmentPreviewDialog
					attachment={attachment}
					previewUrl={previewUrl}
					onClose={() => setShowPreview(false)}
				/>
			)}
		</>
	);
}
