import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button, CheckboxButton } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';
import ImageGenerationDialog from './ImageGenerationDialog';

function ImageGeneration() {
  const localize = useLocalize();
  const { imageGeneration } = useBadgeRowContext();
  const { toggleState, debouncedChange, isPinned } = imageGeneration;
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isEnabled = Boolean(toggleState);
  const shouldShow = isEnabled || isPinned;

  useEffect(() => {
    if (!isEnabled) {
      setIsDialogOpen(false);
    }
  }, [isEnabled]);

  const handleToggle = useCallback(
    ({ value }: { value: boolean | string }) => {
      const nextValue = Boolean(value);
      debouncedChange({ value: nextValue });
      if (nextValue) {
        setIsDialogOpen(true);
      } else {
        setIsDialogOpen(false);
      }
    },
    [debouncedChange],
  );

  const handleGenerateClick = useCallback(() => {
    if (!isEnabled) {
      debouncedChange({ value: true });
    }
    setIsDialogOpen(true);
  }, [debouncedChange, isEnabled]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open && !isEnabled) {
        debouncedChange({ value: true });
      }
      setIsDialogOpen(open);
    },
    [debouncedChange, isEnabled],
  );

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <CheckboxButton
          className="max-w-fit"
          checked={isEnabled}
          setValue={({ value }) => handleToggle({ value })}
          label={localize('com_ui_image_generation')}
          isCheckedClassName="border-purple-600/40 bg-purple-500/10 hover:bg-purple-700/10"
          icon={<ImageIcon className="icon-md" />}
        />
        <Button variant="ghost" size="sm" onClick={handleGenerateClick}>
          <Sparkles className="icon-md" />
          {localize('com_ui_generate_image')}
        </Button>
      </div>
      <ImageGenerationDialog open={isDialogOpen} onOpenChange={handleDialogOpenChange} />
    </>
  );
}

export default memo(ImageGeneration);
