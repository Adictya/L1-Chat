import React from "react";
import type { Attachment } from "@/integrations/tanstack-store/attachments-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface AttachmentPreviewDialogProps {
  attachment: Attachment | null;
  previewUrl: string | null;
  onClose: () => void;
}

export function AttachmentPreviewDialog({
  attachment,
  previewUrl,
  onClose,
}: AttachmentPreviewDialogProps) {
  if (!attachment || !previewUrl) return null;

  const isImage = attachment.type.startsWith("image/");

  return (
    <Dialog open={!!attachment} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {attachment.name}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {isImage ? (
            <div className="relative aspect-auto max-h-[70vh] w-full overflow-hidden rounded-lg">
              <img
                src={previewUrl}
                alt={attachment.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-[70vh] w-full overflow-hidden rounded-lg border bg-muted">
              <object
                data={previewUrl}
                type="application/pdf"
                className="h-full w-full"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 text-4xl">📄</div>
                    <p className="text-sm text-muted-foreground">
                      Unable to display PDF. <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open in new tab</a>
                    </p>
                  </div>
                </div>
              </object>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 