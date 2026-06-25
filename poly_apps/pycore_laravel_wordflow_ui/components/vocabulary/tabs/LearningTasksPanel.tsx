import React from 'react';
import { RefreshCw, BookOpen, CheckCircle } from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, EmptyState, StatusBadge } from '../../common';
import {
  AsyncState,
  VocabularyTask,
  VocabularyWord
} from '../../../types';

interface LearningTasksPanelProps {
  tasks: AsyncState<VocabularyTask[]>;
  selectedTask: VocabularyTask | null;
  setSelectedTask: React.Dispatch<React.SetStateAction<VocabularyTask | null>>;
  vocabularyWords: VocabularyWord[];
  loadTasks: () => void;
  toggleWordLearned: (wordId: string) => void;
  t: {
    learning_tasks?: string;
  };
}

/** Right panel of the Translate tab: legacy Learning-Tasks list with per-word vocabulary cards. */
const LearningTasksPanel: React.FC<LearningTasksPanelProps> = ({
  tasks,
  selectedTask,
  setSelectedTask,
  vocabularyWords,
  loadTasks,
  toggleWordLearned,
  t,
}) => {
  return (
    <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t.learning_tasks || 'Learning Tasks'}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Refresh tasks"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
          <BookOpen className="w-5 h-5 text-indigo-500" />
        </div>
      </div>

      {tasks.loading ? (
        <LoadingBlock full />
      ) : tasks.error ? (
        <AlertBox variant="error" className="flex-1">{tasks.error}</AlertBox>
      ) : tasks.data && tasks.data.length > 0 ? (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Task List */}
          <div className="flex-shrink-0">
            <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">Tasks</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {tasks.data.map(task => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`w-full text-left p-2 rounded-lg border transition-colors ${
                    selectedTask?.id === task.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{task.title}</span>
                    <StatusBadge status={task.status} withDot={false} />
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-500 mb-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{task.progress}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Vocabulary Words */}
          {selectedTask && vocabularyWords.length > 0 && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">
                Vocabulary ({vocabularyWords.filter(w => w.learned).length}/{vocabularyWords.length})
              </h4>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {vocabularyWords.map(word => (
                  <div
                    key={word.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      word.learned
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-base">{word.word}</span>
                          {word.phonetic && (
                            <span className="text-xs text-slate-500">[{word.phonetic}]</span>
                          )}
                          {word.part_of_speech && (
                            <span className="text-xs px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400">
                              {word.part_of_speech}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {word.translation}
                        </p>
                        {word.definition && (
                          <p className="text-xs text-slate-500 mt-1">{word.definition}</p>
                        )}
                        {word.example_sentences && word.example_sentences.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {word.example_sentences.map((sentence, idx) => (
                              <p key={idx} className="text-xs italic text-slate-600 dark:text-slate-400">
                                "{sentence}"
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleWordLearned(word.id)}
                        className={`ml-2 p-1.5 rounded transition-colors ${
                          word.learned
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}
                        title={word.learned ? 'Mark as unlearned' : 'Mark as learned'}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </div>
                    {word.proficiency !== undefined && word.proficiency > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${word.proficiency}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{word.proficiency}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTask && vocabularyWords.length === 0 && (
            <EmptyState message="No vocabulary words in this task" className="flex-1" />
          )}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          message="No tasks available"
          className="flex-1"
          action={
            <button
              onClick={loadTasks}
              className="text-xs text-indigo-500 hover:text-indigo-400"
            >
              Refresh
            </button>
          }
        />
      )}
    </div>
  );
};

export default LearningTasksPanel;
