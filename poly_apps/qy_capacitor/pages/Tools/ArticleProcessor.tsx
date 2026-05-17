import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Article Processor</h1>
              <p className="text-sm text-gray-500">Process articles and extract vocabulary</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full sm:max-w-2xl sm:mx-auto md:max-w-4xl lg:max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Article Content</h2>
              <button
                onClick={loadSampleArticle}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Load Sample
              </button>
            </div>

            {/* Title Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Article Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter article title..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Content Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Article Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter or paste article content..."
                className="w-full h-80 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
              <div className="mt-1 text-xs text-gray-500">
                {content.length} characters | {content.split(/\s+/).filter(w => w).length} words
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty Level
                </label>
                <select
                  value={difficultyLevel}
                  onChange={(e) => setDifficultyLevel(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handlePreview}
                disabled={previewLoading || !content.trim()}
                className="py-3 border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {previewLoading ? 'Previewing...' : 'Preview Parsing'}
              </button>

              <button
                onClick={handleSubmit}
                disabled={loading || !title.trim() || !content.trim()}
                className="py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {loading ? 'Submitting...' : 'Process Article'}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-1">
            {/* Preview Results */}
            {previewData && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Preview Results</h3>

                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900 font-semibold">
                      {previewData.word_count || 0} words found
                    </p>
                  </div>

                  {previewData.parsed_words && previewData.parsed_words.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Sample Words:</p>
                      <div className="flex flex-wrap gap-2">
                        {previewData.parsed_words.slice(0, 10).map((word: string, index: number) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Task Status */}
            {taskId && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Processing Status</h3>

                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Task ID</p>
                    <p className="text-sm font-mono text-gray-900">{taskId}</p>
                  </div>

                  {taskStatus && (
                    <>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-700 mb-1">Status</p>
                        <p className="text-sm font-semibold text-blue-900 capitalize">
                          {taskStatus.status}
                        </p>
                      </div>

                      {taskStatus.progress !== undefined && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-xs text-green-700 mb-2">Progress</p>
                          <div className="w-full bg-green-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${taskStatus.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-green-700 mt-1 text-right">
                            {taskStatus.progress}%
                          </p>
                        </div>
                      )}

                      {taskStatus.result && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-xs text-green-700 mb-1">Result</p>
                          <pre className="text-xs text-green-900 overflow-auto">
                            {JSON.stringify(taskStatus.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {taskStatus.status === 'completed' && (
                        <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800 font-semibold">
                            ✓ Processing completed successfully!
                          </p>
                        </div>
                      )}

                      {taskStatus.status === 'failed' && (
                        <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800 font-semibold">
                            ✗ Processing failed
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Info Box */}
            {!taskId && !previewData && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-orange-900">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ul className="space-y-1 text-orange-800">
                      <li>• Extract vocabulary from articles</li>
                      <li>• Analyze difficulty level</li>
                      <li>• Create word lists for learning</li>
                      <li>• Generate comprehension questions</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
