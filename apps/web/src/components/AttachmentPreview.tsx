import { useEffect, useState } from "react";
import { getFile } from "@/lib/indexed-db";
import type { Attachment } from "@/integrations/tanstack-store/attachments-store";
import { FileText, X } from "lucide-react";
import { Button } from "./ui/button";
import { AttachmentPreviewDialog } from "./AttachmentPreviewDialog";
import { cn } from "@/lib/utils";

export interface AttachmentPreviewProps {
	attachment: Attachment;
	onRemove?: (id: string) => void;
}

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
			const file = await getFile(attachment.id);
			if (file) {
				const blob = new Blob([file.data], { type: file.type });
				const url = URL.createObjectURL(blob);
				setPreviewUrl(url);
			}
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

