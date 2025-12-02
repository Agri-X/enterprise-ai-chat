import { v4 } from 'uuid';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Constants, FileSources, replaceSpecialVars } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import type { ExtendedFile } from '~/common';
import { useAuthContext } from '~/hooks/AuthContext';
import store from '~/store';

const appendIndex = (index: number, value?: string) => {
  if (!value) {
    return value;
  }
  return `${value}${Constants.COMMON_DIVIDER}${index}`;
};

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { ask, index, getMessages, setMessages, latestMessage, setFiles } = useChatContext();
  const { addedIndex, ask: askAdditional, conversation: addedConvo } = useAddedChatContext();

  const autoSendPrompts = useRecoilValue(store.autoSendPrompts);
  const activeConvos = useRecoilValue(store.allConversationsSelector);
  const setActivePrompt = useSetRecoilState(store.activePromptByIndex(index));

  const mapFilesToExtended = useCallback((fileList: TFile[] = []) => {
    const mapped = new Map<string, ExtendedFile>();
    fileList.forEach((file) => {
      const fileId = file.file_id ?? file.temp_file_id;
      if (!fileId) {
        return;
      }
      mapped.set(fileId, {
        file_id: file.file_id ?? fileId,
        temp_file_id: file.temp_file_id,
        type: file.type,
        filepath: file.filepath,
        filename: file.filename,
        width: file.width,
        height: file.height,
        size: file.bytes,
        preview: file.filepath,
        progress: 1,
        source: file.source ?? FileSources.local,
        embedded: file.embedded,
        metadata: file.metadata,
      });
    });
    return mapped;
  }, []);

  const submitMessage = useCallback(
    (data?: { text: string; files?: TFile[] }) => {
      if (!data) {
        return console.warn('No data provided to submitMessage');
      }
      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      const hasAdded = addedIndex && activeConvos[addedIndex] && addedConvo;
      const isNewMultiConvo =
        hasAdded &&
        activeConvos.every((convoId) => convoId === Constants.NEW_CONVO) &&
        !rootMessages?.length;
      const overrideConvoId = isNewMultiConvo ? v4() : undefined;
      const overrideUserMessageId = hasAdded ? v4() : undefined;
      const rootIndex = addedIndex - 1;
      const clientTimestamp = new Date().toISOString();
      const overrideFiles =
        data.files?.map((file) => ({
          file_id: file.file_id,
          filepath: file.filepath,
          type: file.type,
          height: file.height,
          width: file.width,
          filename: file.filename,
        })) ?? undefined;

      ask(
        {
          text: data.text,
          overrideConvoId: appendIndex(rootIndex, overrideConvoId),
          overrideUserMessageId: appendIndex(rootIndex, overrideUserMessageId),
          clientTimestamp,
        },
        { overrideFiles },
      );

      if (hasAdded) {
        askAdditional(
          {
            text: data.text,
            overrideConvoId: appendIndex(addedIndex, overrideConvoId),
            overrideUserMessageId: appendIndex(addedIndex, overrideUserMessageId),
            clientTimestamp,
          },
          { overrideMessages: rootMessages, overrideFiles },
        );
      }
      methods.reset();
    },
    [
      ask,
      methods,
      addedIndex,
      addedConvo,
      setMessages,
      getMessages,
      activeConvos,
      askAdditional,
      latestMessage,
    ],
  );

  const submitPrompt = useCallback(
    (text: string, promptFiles?: TFile[]) => {
      const parsedText = replaceSpecialVars({ text, user });
      if (autoSendPrompts) {
        submitMessage({ text: parsedText, files: promptFiles });
        return;
      }

      const currentText = methods.getValues('text');
      const newText = currentText.trim().length > 1 ? `\n${parsedText}` : parsedText;
      setActivePrompt(newText);
      if (promptFiles) {
        setFiles(mapFilesToExtended(promptFiles));
      }
    },
    [autoSendPrompts, submitMessage, setActivePrompt, methods, user, setFiles, mapFilesToExtended],
  );

  return { submitMessage, submitPrompt };
}
