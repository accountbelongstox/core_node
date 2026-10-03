/** Ops workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const OPS_WORKBENCHES: ToolWorkbenchMap = {
  translation: lazy(() => import('./TranslationWorkbench')),
  tts: lazy(() => import('./TtsWorkbench')),
  ocr: lazy(() => import('./OcrWorkbench')),
  promptManager: lazy(() => import('./PromptManagerWorkbench')),
  imageGeneration: lazy(() => import('./ImageGenerationWorkbench')),
  speechToText: lazy(() => import('./SpeechToTextWorkbench')),
  wordLibrary: lazy(() => import('./WordLibraryWorkbench')),
  learningWords: lazy(() => import('./LearningWordsWorkbench')),
  systemInfo: lazy(() => import('./SystemInfoWorkbench')),
  fileManager: lazy(() => import('./FileManagerWorkbench')),
  nginxManager: lazy(() => import('./NginxWorkbench')),
  sslManager: lazy(() => import('./SslWorkbench')),
  codeExecutor: lazy(() => import('./CodeExecutorWorkbench')),
  vsQueue: lazy(() => import('./VsQueueWorkbench')),
  vsAddText: lazy(() => import('./VsAddTextWorkbench')),
  vsPlayer: lazy(() => import('./VsPlayerWorkbench')),
};
