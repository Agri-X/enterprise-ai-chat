import { useCallback, useMemo, useState } from 'react';
import { Button, OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle, OGDialogDescription, useToastContext } from '@librechat/client';
import { Constants } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
import { useChatContext, useChatFormContext } from '~/Providers';

type BananaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MODEL_OPTIONS = [
  {
    value: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview (Nano Banana Pro Preview)',
    description: 'Designed for professional asset production with higher fidelity and 4K-friendly detail.',
  },
  {
    value: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image (Nano Banana)',
    description: 'Designed for speed and efficiency with balanced quality at 1024px.',
  },
];

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export default function BananaDialog({ open, onOpenChange }: BananaDialogProps) {
  const { getValues, setValue } = useChatFormContext();
  const { getMessages, setMessages, latestMessage, conversation, setLatestMessage } =
    useChatContext();
  const { token, isAuthenticated } = useAuthContext();
  const { showToast } = useToastContext();
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const conversationId = useMemo(
    () => conversation?.conversationId ?? Constants.NEW_CONVO,
    [conversation?.conversationId],
  );

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!isSubmitting) {
        onOpenChange(nextOpen);
      }
    },
    [isSubmitting, onOpenChange],
  );

  const handleGenerate = useCallback(async () => {
    const prompt = (getValues('text') ?? '').trim();
    if (!prompt) {
      showToast({ status: 'warning', message: 'Please enter a prompt in the chat input first.' });
      return;
    }

    if (!isAuthenticated && !token) {
      showToast({ status: 'warning', message: 'Please log in to generate images.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/images/generate', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ prompt, model: selectedModel }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Image generation failed.');
      }

      const imageData = payload?.image;
      const mimeType = payload?.mimeType || 'image/png';
      if (!imageData) {
        throw new Error('No image data returned from the server.');
      }

      const dataUrl = imageData.startsWith('data:')
        ? imageData
        : `data:${mimeType};base64,${imageData}`;

      const now = new Date().toISOString();
      const parentMessageId = latestMessage?.messageId ?? null;
      const userMessageId = createId();
      const assistantMessageId = createId();

      const userMessage: TMessage = {
        messageId: userMessageId,
        conversationId,
        parentMessageId,
        text: prompt,
        isCreatedByUser: true,
        sender: 'user',
        endpoint: 'banana',
        model: selectedModel,
        createdAt: now,
        updatedAt: now,
      };

      const assistantMessage: TMessage = {
        messageId: assistantMessageId,
        conversationId,
        parentMessageId: userMessageId,
        text: `![Banana Image](${dataUrl})`,
        isCreatedByUser: false,
        sender: 'Gemini Banana Pro',
        endpoint: 'banana',
        model: selectedModel,
        createdAt: now,
        updatedAt: now,
      };

      const existingMessages = getMessages() ?? [];
      setMessages([...existingMessages, userMessage, assistantMessage]);
      setLatestMessage(assistantMessage);
      setValue('text', '');
      showToast({ status: 'success', message: 'Banana image generated.' });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed.';
      showToast({ status: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    conversationId,
    getMessages,
    getValues,
    latestMessage?.messageId,
    selectedModel,
    setLatestMessage,
    setMessages,
    setValue,
    showToast,
    onOpenChange,
  ]);

  return (
    <OGDialog open={open} onOpenChange={handleClose}>
      <OGDialogContent className="w-full max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>Model Selection</OGDialogTitle>
          <OGDialogDescription>
            Choose a Gemini Banana Pro model to generate an image from your current prompt.
          </OGDialogDescription>
        </OGDialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-3">
            {MODEL_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded-lg border border-border-subtle p-3 hover:border-border-heavy"
              >
                <input
                  type="radio"
                  name="banana-model"
                  value={option.value}
                  checked={selectedModel === option.value}
                  onChange={() => setSelectedModel(option.value)}
                  className="mt-1"
                  disabled={isSubmitting}
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">{option.label}</span>
                  <span className="text-sm text-text-secondary">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="submit" onClick={handleGenerate} disabled={isSubmitting}>
              {isSubmitting ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
