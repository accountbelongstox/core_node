/**
 * Shared labels + helpers for the vocabulary audio-orchestration tab parts.
 * English literals with zh comments, matching the vocabShared VL convention.
 */
import type { OrchPatternStepType } from '@/apps/pycore-manager/api';

export const ORCH_L = {
  loginTitle: 'Qy App Account',                          // Qy 应用账户
  username: 'Username',                                  // 用户名
  password: 'Password',                                  // 密码
  login: 'Login',                                        // 登录
  logout: 'Logout',                                      // 退出登录
  loggingIn: 'Logging in…',                              // 登录中…
  loggedInAs: 'Logged in as',                            // 已登录
  notLoggedIn: 'Not logged in',                          // 未登录
  loginHint: 'Login enables Word New Only against your default Word Group.',  // 登录后可按默认 Word Group 过滤新词
  booksTitle: 'Backend Books',                           // 后端书库
  refresh: 'Refresh',                                    // 刷新
  syncing: 'Syncing…',                                   // 同步中…
  syncSentences: 'Sync sentences',                       // 同步句子
  sentencesCached: 'sentences cached',                   // 句子已缓存
  noBooks: 'No books. Refresh to fetch from Laravel.',   // 暂无书籍，点击刷新从 Laravel 获取
  tasksTitle: 'Orchestration Tasks',                     // 编排任务
  newTask: 'New Task',                                   // 新建任务
  edit: 'Edit',                                          // 编辑
  delete: 'Delete',                                      // 删除
  confirmDelete: 'Delete this task? Generated audio stays on disk.',  // 删除任务？已生成音频保留在磁盘
  noTasks: 'No tasks yet.',                              // 暂无任务
  generating: 'Generating',                              // 生成中
  cancel: 'Cancel',                                      // 取消
  regenerate: 'Regenerate',                              // 重新生成
  editorTitleNew: 'New Orchestration Task',              // 新建编排任务
  editorTitleEdit: 'Edit Orchestration Task',            // 编辑编排任务
  taskName: 'Task name',                                 // 任务名
  book: 'Book',                                          // 书籍
  pickBook: 'Select a book above first',                 // 请先在上方选择书籍
  segmentMode: 'Split by',                               // 分段方式
  segmentCount: 'Segment count',                         // 段落数
  segmentMinutes: 'Minutes per segment',                 // 每段分钟数
  pattern: 'Sentence pattern',                           // 句子编排
  patternWords: 'Words',                                 // 单词
  patternEn: 'EN sentence',                              // 英文句子
  patternZh: 'ZH sentence',                              // 中文句子
  times: 'times',                                        // 次数
  addStep: 'Add step',                                   // 添加步骤
  moveUp: 'Up',                                          // 上移
  moveDown: 'Down',                                      // 下移
  remove: 'Remove',                                      // 移除
  presetEnZh: 'EN → ZH',                                 // 先英后中
  presetZhEn: 'ZH → EN',                                 // 先中后英
  presetWordEn: 'Words → EN',                            // 先词后英
  wordMode: 'Word selection',                            // 单词选择
  wordModeNewOnly: 'Word New Only (virtual read)',       // 仅新词（虚拟已读）
  wordModeAll: 'All words',                              // 全部单词
  save: 'Save',                                          // 保存
  create: 'Create',                                      // 创建
  planPreview: 'Preview plan',                           // 预览编排
  generate: 'Generate',                                  // 生成
  segments: 'segments',                                  // 段落
  sentences: 'sentences',                                // 句子
  words: 'words',                                        // 单词
  items: 'audio items',                                  // 音频项
  outputDir: 'Output',                                   // 输出目录
  error: 'Error',                                        // 错误
  loginRequiredForNewOnly: 'Word New Only needs a logged-in qy account (falls back to task-local tracking when logged out).',  // 仅新词需登录 qy 账户（未登录时退化为本任务内去重）
};

export const ORCH_STEP_LABELS: Record<OrchPatternStepType, string> = {
  words: ORCH_L.patternWords,
  sentence_en: ORCH_L.patternEn,
  sentence_zh: ORCH_L.patternZh,
};

/** minutes:seconds for plan/preview estimates. */
export function formatDuration(seconds: number | undefined | null): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
