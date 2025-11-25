import { useState } from 'react';
import { TooltipAnchor } from '@librechat/client';
import BananaDialog from './BananaDialog';
import { cn } from '~/utils';

export default function BananaButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipAnchor
        id="banana-generator"
        disabled={disabled}
        description="Generate an image with Gemini Banana Pro"
        render={
          <button
            type="button"
            aria-label="Generate Banana Image"
            disabled={disabled}
            className={cn(
              'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50',
            )}
            onClick={() => setOpen(true)}
          >
            <img
              src="/assets/banana.svg"
              alt="Banana icon"
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        }
      />
      <BananaDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
