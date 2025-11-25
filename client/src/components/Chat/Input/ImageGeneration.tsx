import React, { memo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';

function ImageGeneration() {
  const localize = useLocalize();
  const { imageGeneration } = useBadgeRowContext();
  const { toggleState, debouncedChange, isPinned } = imageGeneration;

  const isEnabled = Boolean(toggleState);
  const shouldShow = isEnabled || isPinned;

  if (!shouldShow) {
    return null;
  }

  return (
    <CheckboxButton
      className="max-w-fit"
      checked={isEnabled}
      setValue={debouncedChange}
      label={localize('com_ui_image_generation')}
      isCheckedClassName="border-purple-600/40 bg-purple-500/10 hover:bg-purple-700/10"
      icon={<ImageIcon className="icon-md" />}
    />
  );
}

export default memo(ImageGeneration);
