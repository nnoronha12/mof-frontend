import React from "react";
import { ArrowDownTrayIcon, DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ThemeColors } from "./WeaveAiChat";
import { StoredChatAttachment } from "../models/startup";

export type AttachmentPreviewFile = File | StoredChatAttachment;

const isStoredAttachment = (file: AttachmentPreviewFile): file is StoredChatAttachment =>
  "id" in file && typeof file.id === "number" && "fileName" in file;

const attachmentName = (file: AttachmentPreviewFile): string =>
  isStoredAttachment(file) ? file.fileName : file.name;

type AttachedFilesPreviewProps = {
  files: AttachmentPreviewFile[];
  removeFile?: (file: File) => void;
  onDownload?: (file: StoredChatAttachment) => void;
  themeColor?: ThemeColors;
  DeleteIcontoshow?: boolean;
  classname?: string;
};

const AttachedFilesPreview: React.FC<AttachedFilesPreviewProps> = ({
  files,
  removeFile,
  onDownload,
  themeColor,
  DeleteIcontoshow = true,
  classname = "",
}) => {
  return (
    <div
      className={` overflow-x-auto  gap-2  w-full ${classname}`}
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {files.map((file, index) => {
        const storedAttachment = isStoredAttachment(file);
        const name = attachmentName(file);
        return (
        <div
          key={`${storedAttachment ? file.id : name}-${index}`}
          className={`border border-1 overflow-hidden rounded-2xl shadow-md p-2 text-base min-w-[150px] ${
            storedAttachment ? "cursor-pointer hover:bg-gray-50" : ""
          }`}
          style={{ borderColor: themeColor?.primary }}
          role={storedAttachment ? "button" : undefined}
          tabIndex={storedAttachment ? 0 : undefined}
          onClick={() => storedAttachment && onDownload?.(file)}
          onKeyDown={(event) => {
            if (storedAttachment && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onDownload?.(file);
            }
          }}
          title={storedAttachment ? `Download ${name}` : name}
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex-shrink-0">
              <DocumentTextIcon stroke={themeColor?.primary} />
            </div>
            <div className="text-[13px] text-gray-800 whitespace-nowrap overflow-hidden w-full">
              {name}
            </div>
            {storedAttachment && (
              <div className="flex items-center gap-1 text-[11px] font-medium flex-shrink-0" style={{ color: themeColor?.primary }}>
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span>Download</span>
              </div>
            )}
            {DeleteIcontoshow && (
              <div
                className="h-4 w-4 cursor-pointer flex-shrink-0"
              onClick={(event) => {
                event.stopPropagation();
                if (!storedAttachment) removeFile?.(file);
              }}
              >
                <XMarkIcon />
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default AttachedFilesPreview;
