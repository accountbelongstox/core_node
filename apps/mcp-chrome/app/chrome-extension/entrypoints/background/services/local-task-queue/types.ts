/**
 * Local Task Queue - Unified Task Types
 * Extensible task system with generic details
 */

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',     // Waiting in queue
  PROCESSING = 'processing', // Currently being processed
  COMPLETED = 'completed',  // Successfully completed
  FAILED = 'failed',       // Failed with error
  CANCELLED = 'cancelled',  // Cancelled by user
}

/**
 * Task type enum
 * Add new task types here
 */
export enum TaskType {
  BING_DICTIONARY = 'bing_dictionary',
  DEEPSEEK_CHAT = 'deepseek_chat',
  TRANSLATION = 'translation',
  TTS = 'tts',
  WEB_SCRAPING = 'web_scraping',
  // Add more task types as needed
}

/**
 * Base task interface with generic details
 * T is the type of task-specific details
 */
export interface Task<T = any> {
  id: string;                    // Unique task ID
  type: TaskType;                // Task type
  status: TaskStatus;            // Current status
  createdAt: number;             // Creation timestamp
  updatedAt: number;             // Last update timestamp
  startedAt?: number;            // Processing start time
  completedAt?: number;          // Completion time
  details: T;                    // Task-specific details (extensible)
  result?: any;                  // Task result
  error?: string;                // Error message if failed
  progress?: number;             // Progress percentage (0-100)
  metadata?: {                   // Optional metadata
    priority?: number;           // Task priority (higher first)
    retryCount?: number;         // Number of retries
    maxRetries?: number;         // Max retry attempts
    timeout?: number;            // Timeout in ms
    tags?: string[];             // Tags for filtering
    [key: string]: any;          // Additional metadata
  };
}

/**
 * Task event types
 */
export enum TaskEventType {
  ADDED = 'added',
  STARTED = 'started',
  PROGRESS = 'progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  QUEUE_EMPTY = 'queue_empty',
}

/**
 * Task event
 */
export interface TaskEvent<T = any> {
  type: TaskEventType;
  task: Task<T>;
  timestamp: number;
}

/**
 * Task queue statistics
 */
export interface TaskQueueStats {
  total: number;                 // Total tasks in queue
  pending: number;               // Pending tasks
  processing: number;            // Currently processing
  completed: number;             // Completed tasks
  failed: number;                // Failed tasks
  cancelled: number;             // Cancelled tasks
  byType: Record<TaskType, number>; // Count by type
}

/**
 * Bing Dictionary Task Details
 */
export interface BingDictionaryTaskDetails {
  words: Array<{
    word: string;
    md5?: string;
  }>;
  language?: string;             // Default: 'english'
  batchSize?: number;            // Batch processing size
  provider?: string;             // Dictionary provider
}

/**
 * DeepSeek Chat Task Details
 */
export interface DeepSeekTaskDetails {
  prompt: string;                // The prompt to send
  conversationId?: string;       // Conversation ID (for context)
  model?: string;                // Model selection
  attachments?: Array<{          // File attachments
    name: string;
    url: string;
    type: string;
  }>;
  options?: {
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };
}

/**
 * Translation Task Details
 */
export interface TranslationTaskDetails {
  text: string;                  // Text to translate
  sourceLanguage: string;        // Source language code
  targetLanguage: string;        // Target language code
  provider?: string;             // Translation provider
  model?: string;                // Model to use
  type?: string;                 // Translation type
}

/**
 * TTS Task Details
 */
export interface TTSTaskDetails {
  text: string;                  // Text to speak
  language: string;              // Language code
  voice?: string;                // Voice ID
  speed?: number;                // Speech speed
  format?: string;               // Audio format
}

/**
 * Web Scraping Task Details
 */
export interface WebScrapingTaskDetails {
  url: string;                   // URL to scrape
  selector?: string;             // CSS selector
  extractFields?: string[];      // Fields to extract
  waitFor?: string;              // Wait for element
  timeout?: number;              // Page timeout
}

/**
 * Type helpers for creating tasks
 */
export type BingDictionaryTask = Task<BingDictionaryTaskDetails>;
export type DeepSeekTask = Task<DeepSeekTaskDetails>;
export type TranslationTask = Task<TranslationTaskDetails>;
export type TTSTask = Task<TTSTaskDetails>;
export type WebScrapingTask = Task<WebScrapingTaskDetails>;
