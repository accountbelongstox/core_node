
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';

const UploadPage = () => {
  const { navigate } = useContext(AppContext);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = () => {
    setUploading(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setUploading(false);
          alert("Document Processed! 120 words extracted.");
          navigate('courses');
        }, 500);
      }
    }, 100);
  };

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
       <div className="flex items-center gap-3 mb-6">
         <button onClick={() => navigate('courses')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><Icons.Back /></button>
         <h1 className="text-2xl font-bold dark:text-white">Upload Material</h1>
       </div>

       <div className="flex-1 flex flex-col justify-center">
         <div 
           className={`
             border-3 border-dashed rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center transition-all duration-300
             ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105' : 'border-slate-300 dark:border-slate-700 bg-white/30 dark:bg-slate-800/30'}
             ${uploading ? 'opacity-50 pointer-events-none' : ''}
           `}
           onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
           onDragLeave={() => setIsDragging(false)}
           onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(); }}
           onClick={handleUpload}
         >
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-full flex items-center justify-center shadow-lg mb-6 text-white text-4xl">
              📄
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-white mb-2">
              {uploading ? 'Processing...' : 'Drop PDF or Doc here'}
            </h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Our AI will extract words, sentences, and context automatically.
            </p>
         </div>

         {uploading && (
           <div className="mt-8 px-8">
             <div className="flex justify-between text-xs font-bold text-blue-500 mb-2">
               <span>EXTRACTING...</span>
               <span>{progress}%</span>
             </div>
             <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
             </div>
           </div>
         )}
       </div>

       <div className="grid grid-cols-2 gap-4 pb-12">
          <Card className="flex flex-col items-center p-4">
             <span className="text-2xl mb-2">📸</span>
             <span className="text-sm font-bold">Camera Scan</span>
          </Card>
          <Card className="flex flex-col items-center p-4">
             <span className="text-2xl mb-2">🔗</span>
             <span className="text-sm font-bold">Paste Link</span>
          </Card>
       </div>
    </div>
  );
};

export default UploadPage;
