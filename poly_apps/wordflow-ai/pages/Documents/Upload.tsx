
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { LanguageCenter } from '../../i18n/LanguageCenter';

const UploadPage = () => {
  const { navigate } = useContext(AppContext);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string) => LanguageCenter.t(key);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(t('upload.invalidFileType') || 'Invalid file type. Please upload PDF, DOC, DOCX, or TXT files.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError(t('upload.fileTooLarge') || 'File is too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setError('');
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const response = await ApiCenter.documents.upload(file, (progressPercent) => {
        setProgress(Math.round(progressPercent));
      });

      if (response.success && response.data) {
        console.log('[Upload] Upload successful:', response.data);

        // Show success message
        setTimeout(() => {
          setUploading(false);
          alert(
            response.data.message ||
            `${t('upload.success') || 'Document processed successfully'}! ${response.data.word_count || 0} ${t('upload.wordsExtracted') || 'words extracted'}.`
          );
          // Navigate to the created library or courses page
          navigate('courses');
        }, 500);
      } else {
        throw new Error(response.error?.message || t('upload.failed') || 'Upload failed');
      }
    } catch (err: any) {
      console.error('[Upload] Upload error:', err);
      setError(err.message || t('upload.error') || 'An error occurred during upload');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
       {/* Hidden file input */}
       <input
         ref={fileInputRef}
         type="file"
         accept=".pdf,.doc,.docx,.txt"
         onChange={handleFileInputChange}
         className="hidden"
       />

       <div className="flex items-center gap-3 mb-6">
         <button onClick={() => navigate('courses')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><Icons.Back /></button>
         <h1 className="text-2xl font-bold dark:text-white">{t('upload.title') || 'Upload Material'}</h1>
       </div>

       {error && (
         <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
           {error}
         </div>
       )}

       <div className="flex-1 flex flex-col justify-center">
         <div
           className={`
             border-3 border-dashed rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer
             ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105' : 'border-slate-300 dark:border-slate-700 bg-white/30 dark:bg-slate-800/30'}
             ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}
           `}
           onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
           onDragLeave={() => setIsDragging(false)}
           onDrop={handleDrop}
           onClick={handleClick}
         >
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-full flex items-center justify-center shadow-lg mb-6 text-white text-4xl">
              📄
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-white mb-2">
              {uploading ? t('upload.processing') || 'Processing...' : t('upload.dropHere') || 'Drop PDF or Doc here'}
            </h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              {t('upload.description') || 'Our AI will extract words, sentences, and context automatically.'}
            </p>
            {!uploading && (
              <p className="text-slate-400 text-xs mt-4">
                {t('upload.clickToSelect') || 'Or click to select a file'}
              </p>
            )}
            {selectedFile && !uploading && (
              <div className="mt-4 text-blue-500 text-sm font-medium">
                {t('upload.selectedFile') || 'Selected'}: {selectedFile.name}
              </div>
            )}
         </div>

         {uploading && (
           <div className="mt-8 px-8">
             <div className="flex justify-between text-xs font-bold text-blue-500 mb-2">
               <span>{t('upload.extracting') || 'EXTRACTING'}...</span>
               <span>{progress}%</span>
             </div>
             <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
             </div>
             {selectedFile && (
               <div className="mt-2 text-xs text-slate-500 text-center">
                 {t('upload.uploadingFile') || 'Uploading'}: {selectedFile.name}
               </div>
             )}
           </div>
         )}
       </div>

       <div className="grid grid-cols-2 gap-4 pb-12">
          <Card className="flex flex-col items-center p-4 opacity-50 cursor-not-allowed">
             <span className="text-2xl mb-2">📸</span>
             <span className="text-sm font-bold">{t('upload.cameraScan') || 'Camera Scan'}</span>
             <span className="text-xs text-slate-400 mt-1">{t('common.comingSoon') || 'Coming Soon'}</span>
          </Card>
          <Card className="flex flex-col items-center p-4 opacity-50 cursor-not-allowed">
             <span className="text-2xl mb-2">🔗</span>
             <span className="text-sm font-bold">{t('upload.pasteLink') || 'Paste Link'}</span>
             <span className="text-xs text-slate-400 mt-1">{t('common.comingSoon') || 'Coming Soon'}</span>
          </Card>
       </div>
    </div>
  );
};

export default UploadPage;
