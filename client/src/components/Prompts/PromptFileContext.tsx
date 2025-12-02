import { useRef, useState } from 'react';
import { AttachmentIcon, Button } from '@librechat/client';
import { EToolResources } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import FileRow from '~/components/Chat/Input/Files/FileRow';
import { useFileHandling, useLocalize } from '~/hooks';

type PromptFileContextProps = {
  files: Map<string, ExtendedFile>;
  setFiles: React.Dispatch<React.SetStateAction<Map<string, ExtendedFile>>>;
  disabled?: boolean;
};

export default function PromptFileContext({ files, setFiles, disabled }: PromptFileContextProps) {
  const localize = useLocalize();
  const [filesLoading, setFilesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleFileChange } = useFileHandling({
    additionalMetadata: { tool_resource: EToolResources.context },
    fileSetter: setFiles,
    setFilesLoading,
  });

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="rounded-2xl border border-border-light bg-surface-secondary px-4 py-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-token-text-primary font-medium">
            {localize('com_agents_file_context_label')}
          </p>
          <p className="text-xs text-text-secondary">
            {localize('com_agents_file_context_description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3"
            disabled={disabled}
            onClick={handleUploadClick}
            aria-label={localize('com_ui_upload_file_context')}
          >
            <div className="flex items-center gap-2">
              <AttachmentIcon className="text-token-text-primary h-4 w-4" />
              <span className="text-sm">{localize('com_ui_upload_file_context')}</span>
            </div>
          </Button>
          <input
            multiple
            type="file"
            style={{ display: 'none' }}
            tabIndex={-1}
            ref={fileInputRef}
            disabled={disabled}
            onChange={handleFileChange}
          />
        </div>
      </div>
      <FileRow
        files={files}
        setFiles={setFiles}
        setFilesLoading={setFilesLoading}
        tool_resource={EToolResources.context}
        Wrapper={({ children }) => <div className="flex flex-wrap gap-2">{children}</div>}
      />
      {disabled ? (
        <p className="mt-2 text-xs text-text-secondary">
          {localize('com_agents_file_context_disabled')}
        </p>
      ) : null}
    </div>
  );
}
