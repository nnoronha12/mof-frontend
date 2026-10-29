import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { N8nChatService } from '../services/n8nChat';
import { refreshAuthSession } from '../services/authSession';
import CompletedIcon from '../assets/icons/completed.svg';
import DeleteIcon from '../assets/icons/delete.svg';
import { ThemeColors } from './WeaveAiChat';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface FileUploadButtonProps {
  label: string;
  buttonId?: string;
  mimeType?: string;
  singleUpload?: boolean;
  chatService: N8nChatService | null;
  onUploadComplete: (response: any) => void;
  themecolors: ThemeColors;
  onFileSelect?: (loaderflag:boolean) => void;
}

interface UploadState {
  progress: number;
  completed: boolean;
  fileName: string;
  uploading: boolean;
 
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  label,
  buttonId,
  mimeType,
  singleUpload,
  chatService,
  onUploadComplete,
  themecolors,
  onFileSelect,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    progress: 0,
    completed: false,
    fileName: '',
    uploading: false,

  });
  const [uploadError, setUploadError] = useState('');

  const formatAttachmentSize = (bytes: number): string => {
    const megabytes = bytes / (1024 * 1024);
    if (megabytes >= 10) return `${Math.round(megabytes)} MB`;
    if (megabytes >= 0.1) return `${megabytes.toFixed(1)} MB`;
    return `${Math.max(bytes, 0)} B`;
  };

  const handleFileSelect = () => {
    // Create a temporary file input
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';

    // Set accept mime types if specified
    if (mimeType) {
      input.accept = mimeType;
    }

    // Set multiple attribute based on singleUpload flag
    if (!singleUpload) {
      input.multiple = true;
    }

    // Handle file selection
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files?.length) return;
      const fileArray = Array.from(files);
      (e.target as HTMLInputElement).value = '';

      const maxBytes = 30 * 1024 * 1024;
      const maxFiles = 5;
      const errors: string[] = [];

      if (!singleUpload && fileArray.length > maxFiles) {
        errors.push(
          `You selected ${fileArray.length} files. You can upload a maximum of ${maxFiles} files at once.`,
        );
      }

      const oversized = fileArray.filter((file) => file.size > maxBytes);
      if (oversized.length) {
        const names = oversized
          .map((file) => `${file.name} (${formatAttachmentSize(file.size)})`)
          .join(', ');
        errors.push(`Each file must be 30 MB or smaller. Too large: ${names}`);
      }

      if (errors.length) {
        setUploadError(errors.join(' '));
        onFileSelect?.(false);
        return;
      }
      setUploadError('');

      try {
        const clientMessageId = uuidv4();
        await refreshAuthSession(false);
        await chatService?.ensureSocketReady();
        // Convert FileList to Array
         onFileSelect?.(true);

        // Update state to show progress
        setUploadState({
          fileName: fileArray.length === 1 ? fileArray[0].name : `${fileArray.length} files`,
          progress: 0,
          completed: false,
          uploading: true
        });

        // Create a custom FormData
        const formData = new FormData();

        // Add session and metadata
        formData.append('action', 'sendMessage');
        formData.append('sessionId', chatService?.getSessionId() || '');
        formData.append('clientMessageId', clientMessageId);
        formData.append('requestId', clientMessageId);
        formData.append('socketId', chatService?.getSocketId() || '');
        formData.append('language', chatService?.getLanguage() || 'en');
        formData.append('metadata', JSON.stringify(chatService?.getUploadMetadata({ clientMessageId, requestId: clientMessageId }) ?? {}));

        // Add buttonId if available
        if (buttonId) {
          formData.append('buttonId', buttonId);
        } else {
          formData.append('chatInput', '');
        }

        // Add all files
        for (const file of fileArray) {
          formData.append('files', file);
        }

        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const uploadedBytes = event.loaded;
            const totalBytes = event.total;
            const percentComplete = Math.round((uploadedBytes / totalBytes) * 100);

            console.log(`Uploading: ${uploadedBytes} of ${totalBytes} bytes (${percentComplete}%)`);

            setUploadState(prev => ({
              ...prev,
              progress: percentComplete,
              fileName: `${fileArray[0].name} (${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)})`
            }));
          }
        });

        // Add helper function for formatting bytes
        const formatBytes = (bytes: number) => {
          if (bytes === 0) return '0 Bytes';

          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));

          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('Upload completed successfully');
            setUploadState(prev => ({
              ...prev,
              progress: 100,
              completed: true,
              fileName: fileArray[0].name // Reset to original filename
            }));

            // Handle response
            const response = JSON.parse(xhr.responseText);
            onUploadComplete(response);
          } else {
            console.error('Upload failed with status:', xhr.status);
            throw new Error('Upload failed');
          }
        });

        xhr.addEventListener('error', () => {
          setUploadState(prev => ({ ...prev, uploading: false }));
          throw new Error('Upload failed');
        });

        xhr.open('POST', chatService?.getWebhookUrl() || '');

        const authHeaders = chatService?.getCustomHeaders();
        const accessToken = authHeaders?.Token || authHeaders?.token;
        if (accessToken) {
          xhr.setRequestHeader('Token', accessToken);
        }

        // Add custom headers
        // const headers = chatService?.getCustomHeaders();
        // if (headers) {
        //   for (const [key, value] of Object.entries(headers)) {
        //     if(key === 'Token') {
        //       xhr.setRequestHeader('my-token', value as string);
        //     } else {
        //       xhr.setRequestHeader(key, value as string);
        //     }
        //   }
        // }

        xhr.send(formData);
      } catch (error) {
        console.error('Error uploading files:', error);
        setUploadState(prev => ({ ...prev, uploading: false }));
         onFileSelect?.(false);
      }
    };

    // Trigger file selection
    input.click();
  };

  return (
    <div className="flex flex-col">
      {uploadState.completed || uploadState.uploading ? (
        <div className="relative w-[250px]">
          <button
            className={`group px-2 py-2 text-[14px] font-medium text-white border rounded-[12px] flex items-center gap-2 w-full relative overflow-hidden `}
            disabled={true}
            style={{
              backgroundColor: uploadState.completed ? '#57B069E2' : themecolors.primary,
              borderColor: uploadState.completed ? '#57B069' : themecolors.primary,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
              {uploadState.completed ? (
                <CompletedIcon
                  className="w-7 h-7"
                  style={{
                    stroke: '#57B069',
                    fill: 'none'
                  }}
                />
              ) : (
                <div className="w-7 h-7 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M13 7L11.8845 4.76892C11.5634 4.1268 11.4029 3.80573 11.1634 3.57116C10.9516 3.36373 10.6963 3.20597 10.4161 3.10931C10.0992 3 9.74021 3 9.02229 3H5.2C4.0799 3 3.51984 3 3.09202 3.21799C2.71569 3.40973 2.40973 3.71569 2.21799 4.09202C2 4.51984 2 5.0799 2 6.2V7M2 7H17.2C18.8802 7 19.7202 7 20.362 7.32698C20.9265 7.6146 21.3854 8.07354 21.673 8.63803C22 9.27976 22 10.1198 22 11.8V16.2C22 17.8802 22 18.7202 21.673 19.362C21.3854 19.9265 20.9265 20.3854 20.362 20.673C19.7202 21 18.8802 21 17.2 21H6.8C5.11984 21 4.27976 21 3.63803 20.673C3.07354 20.3854 2.6146 19.9265 2.32698 19.362C2 18.7202 2 17.8802 2 16.2V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="block text-[14px] font-bold truncate" title={label}>{label}</span>
              <span className="block text-[14px] opacity-90 truncate" title={uploadState.fileName}>
                {uploadState.fileName}
              </span>
            </div>
            {uploadState.uploading && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                <div
                  className="h-full bg-[#57B069] transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            )}
          </button>
          {/* {uploadState.completed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploadState({
                  progress: 0,
                  completed: false,
                  fileName: '',
                  uploading: false
                });
              }}
              className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center"
            >
              <DeleteIcon
                className="w-7 h-7"
                style={{
                  stroke: 'white',
                  fill: 'none'
                }}
              />
            </button>
          )} */}
        </div>
      ) : (
        <button
          onClick={handleFileSelect}
          className="px-4 py-2 text-[14px] font-medium bg-transparent border-[1.5px] rounded-xl hover:bg-[rgba(198,167,93,0.08)] transition-colors action-button-prompt"
          disabled={uploadState.uploading}
          style={{ color: themecolors.primary, borderColor: themecolors.primary }}
        >
          {label}
        </button>
      )}
      {uploadError && (
        <div
          className="mt-2 flex items-start gap-3 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] px-3 py-2.5 text-sm font-medium text-[#B42318]"
          role="alert"
        >
          <p className="flex-1 leading-snug">{uploadError}</p>
          <button
            type="button"
            onClick={() => setUploadError('')}
            className="flex-shrink-0 rounded-md p-1 text-[#B42318] hover:bg-[#FEE4E2] transition-colors"
            aria-label="Dismiss upload error"
          >
            <XMarkIcon className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}; 
