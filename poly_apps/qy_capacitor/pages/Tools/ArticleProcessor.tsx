/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';
import { Card, PageHeader, ProgressBar, Button } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function ArticleProcessor() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('en');
  const [difficultyLevel, setDifficultyLevel] = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<any>(null);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
  ];

  // Preview article parsing
  const handlePreview = async () => {
    if (!content.trim()) {
      alert('Please enter article content');
      return;
    }

    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const result = await ApiCenter.article.preview({
        content: content.trim(),
        language,
      });

      if (result.success && result.data) {
        setPreviewData(result.data);
      } else {
        alert(result.error?.message || 'Preview failed');
      }
    } catch (error) {
      console.error('Preview failed:', error);
      alert('Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Submit article for processing
  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Please enter both title and content');
      return;
    }

    setLoading(true);
    setTaskId(null);
    setTaskStatus(null);

    try {
      const result = await ApiCenter.article.submit({
        title: title.trim(),
        content: content.trim(),
        language,
        difficulty_level: difficultyLevel,
      });

      if (result.success && result.data) {
        setTaskId(result.data.task_id);
        alert(`Article submitted successfully! Task ID: ${result.data.task_id}`);

        // Start checking task status
        checkTaskStatus(result.data.task_id);
      } else {
        alert(result.error?.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Submission failed');
    } finally {
      setLoading(false);
    }
  };

  // Check task status
  const checkTaskStatus = async (id: string) => {
    try {
      const result = await ApiCenter.article.getTaskStatus(id);

      if (result.success && result.data) {
        setTaskStatus(result.data);

        // If task is still processing, check again after 2 seconds
        if (result.data.status === 'processing' || result.data.status === 'pending') {
          setTimeout(() => checkTaskStatus(id), 2000);
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  // Sample article
  const loadSampleArticle = () => {
    setTitle('The Benefits of Learning Languages');
    setContent(`Learning a new language opens up a world of opportunities. It not only enhances your cognitive abilities but also allows you to connect with people from different cultures.

Research shows that bilingual individuals have better problem-solving skills and improved memory. Language learning also delays cognitive decline in older adults.

Furthermore, knowing multiple languages can boost your career prospects. In today's globalized world, employers value candidates who can communicate across cultures and languages.

Start your language learning journey today and experience these amazing benefits yourself!`);
    setLanguage('en');
  };

  return (
    <div className="min-h-screen bg-transparent pb-32">
      <PageHeader title="Article Processor" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">Process articles and extract vocabulary</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-lg)]">
          {/* Input Panel */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="ds-section-title">Article Content</h2>
              <button
                onClick={loadSampleArticle}
                className="ds-link-more"
              >
                Load Sample
              </button>
            </div>

            {/* Title Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Article Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter article title..."
                className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
              />
            </div>

            {/* Content Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Article Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter or paste article content..."
                className="w-full h-80 px-4 py-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none"
              />
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {content.length} characters | {content.split(/\s+/).filter(w => w).length} words
              </div>
            </div>

            {/* Settings — pill nav */}
            <div className="space-y-4 mb-4">
              <div>
                <label className="ds-section-label block mb-2">Language</label>
                <PillNav
                  items={languages.map((l) => ({ id: l.code, label: l.name }))}
                  activeId={language}
                  onChange={setLanguage}
                  aria-label="Language"
                />
              </div>

              <div>
                <label className="ds-section-label block mb-2">Difficulty Level</label>
                <PillNav
                  items={[
                    { id: 'beginner', label: 'Beginner' },
                    { id: 'intermediate', label: 'Intermediate' },
                    { id: 'advanced', label: 'Advanced' },
                  ]}
                  activeId={difficultyLevel}
                  onChange={setDifficultyLevel}
                  aria-label="Difficulty level"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={previewLoading || !content.trim()}
              >
                {previewLoading ? 'Previewing...' : 'Preview Parsing'}
              </Button>

              <Button
                variant="grad"
                onClick={handleSubmit}
                disabled={loading || !title.trim() || !content.trim()}
              >
                {loading ? 'Submitting...' : 'Process Article'}
              </Button>
            </div>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-1 space-y-[var(--space-lg)]">
            {/* Preview Results */}
            {previewData && (
              <Card>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Preview Results</h3>

                <div className="space-y-3">
                  <div className="p-3 bg-[var(--klein-blue-soft)] rounded-[var(--radius-button)]">
                    <p className="text-sm text-[var(--klein-blue)] font-semibold">
                      {previewData.word_count || 0} words found
                    </p>
                  </div>

                  {previewData.parsed_words && previewData.parsed_words.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Sample Words:</p>
                      <div className="flex flex-wrap gap-2">
                        {previewData.parsed_words.slice(0, 10).map((word: string, index: number) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-secondary)] text-xs rounded-full"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Task Status */}
            {taskId && (
              <Card>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Processing Status</h3>

                <div className="space-y-3">
                  <div className="p-3 bg-[var(--color-surface)] border border-[var(--border-highlight)] rounded-[var(--radius-button)]">
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Task ID</p>
                    <p className="text-sm font-mono text-[var(--color-text-primary)]">{taskId}</p>
                  </div>

                  {taskStatus && (
                    <>
                      <div className="p-3 bg-[var(--klein-blue-soft)] rounded-[var(--radius-button)]">
                        <p className="text-xs text-[var(--klein-blue)] mb-1">Status</p>
                        <p className="text-sm font-semibold text-[var(--klein-blue)] capitalize">
                          {taskStatus.status}
                        </p>
                      </div>

                      {taskStatus.progress !== undefined && (
                        <div className="p-3 bg-[var(--color-surface)] border border-[var(--border-highlight)] rounded-[var(--radius-button)]">
                          <p className="text-xs text-[var(--color-text-secondary)] mb-2">Progress</p>
                          <ProgressBar value={taskStatus.progress} />
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-right">
                            {taskStatus.progress}%
                          </p>
                        </div>
                      )}

                      {taskStatus.result && (
                        <div className="p-3 bg-[var(--color-surface)] border border-[var(--border-highlight)] rounded-[var(--radius-button)]">
                          <p className="text-xs text-[var(--color-text-secondary)] mb-1">Result</p>
                          <pre className="text-xs text-[var(--color-text-primary)] overflow-auto">
                            {JSON.stringify(taskStatus.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {taskStatus.status === 'completed' && (
                        <div className="p-3 bg-[var(--klein-blue-soft)] border border-[var(--klein-blue)]/30 rounded-[var(--radius-button)]">
                          <p className="text-sm text-[var(--klein-blue)] font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Processing completed successfully!
                          </p>
                        </div>
                      )}

                      {taskStatus.status === 'failed' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-[var(--radius-button)]">
                          <p className="text-sm text-red-500 font-semibold flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 flex-shrink-0" /> Processing failed
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Info Box */}
            {!taskId && !previewData && (
              <Card>
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-[var(--klein-blue)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    <p className="font-semibold mb-1 text-[var(--color-text-primary)]">How it works:</p>
                    <ul className="space-y-1">
                      <li>• Extract vocabulary from articles</li>
                      <li>• Analyze difficulty level</li>
                      <li>• Create word lists for learning</li>
                      <li>• Generate comprehension questions</li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
