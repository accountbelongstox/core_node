
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button, Card } from '../../components/UI';
import { api } from '../../services/api';
import { WordGroup, CourseAnalysis } from '../../types';

const CourseDetailPage = () => {
  const { navigate, currentParams, setActiveGroupId, user } = useContext(AppContext);
  const [group, setGroup] = useState<WordGroup | null>(null);
  const [analysis, setAnalysis] = useState<CourseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const groupId = currentParams.groupId || 'g1';

    // Fetch group info and analysis parallel
    Promise.all([
        api.getWordGroups().then(gs => gs.find(g => g.id === groupId)),
        api.analyzeCourse(groupId)
    ]).then(([g, a]) => {
        setGroup(g || null);
        setAnalysis(a || null);
        setLoading(false);
    }).catch(err => {
        console.error('[CourseDetail] Failed to load course:', err);
        setLoading(false);
    });
  }, [currentParams, user]);

  const handleAddToLibrary = async () => {
      if (!user) {
          alert("Please login to sync this course to your cloud library.");
          return; // Don't redirect, just prompt
      }
      if (!group) return;

      setLoading(true);
      await api.addToLibrary(group.id);
      setActiveGroupId(group.id);
      setLoading(false);
      navigate('home');
  };

  if (loading || !group || !analysis) return <div className="h-full flex items-center justify-center font-bold text-slate-400 animate-pulse">Analyzing Content...</div>;

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up relative overflow-hidden">
      {/* Dynamic BG */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-100/50 to-transparent dark:from-blue-900/20 -z-10 pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('courses')} className="p-2 rounded-full bg-white/50 backdrop-blur-md hover:bg-white/80"><Icons.Back /></button>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Course Analysis</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {/* Cover Section */}
          <div className="flex items-center gap-6 mb-8 px-2">
              <div className="w-24 h-32 rounded-2xl bg-white shadow-xl flex items-center justify-center text-5xl border border-white/50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
                  {group.coverImage}
              </div>
              <div className="flex-1">
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight mb-2">{group.name}</h1>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg uppercase">{group.type}</span>
              </div>
          </div>

          {/* Analysis Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="col-span-2 holo-card p-6 rounded-[2rem] flex flex-col items-center text-center">
                   <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-1">{analysis.similarity}%</div>
                   <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">Overlap with Memory</div>
                   <p className="text-xs text-slate-400 mt-2">You already know {analysis.knownWords} words in this book.</p>
              </div>
              
              <Card className="flex flex-col items-center justify-center py-6">
                  <span className="text-2xl font-bold text-slate-800 dark:text-white">{analysis.newWords}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">New Words</span>
              </Card>

              <Card className="flex flex-col items-center justify-center py-6">
                  <span className="text-2xl font-bold text-slate-800 dark:text-white">~{Math.ceil(analysis.newWords / (user?.dailyGoal || 20))}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Days to Finish</span>
              </Card>
          </div>

          <div className="px-2 mb-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-3">Course Description</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {group.description || "This comprehensive course covers essential vocabulary tailored for your learning goals. Optimized for memory retention with spaced repetition compatibility."}
              </p>
          </div>
          
          {/* Sample Words Preview */}
           <div className="px-2">
              <h3 className="font-bold text-slate-800 dark:text-white mb-3">Sample Content</h3>
              <div className="space-y-2">
                  {[1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/20">
                          <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">{i}</span>
                          <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                          <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded-full opacity-50"></div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Floating Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 pb-safe z-20">
          <Button onClick={handleAddToLibrary} className="w-full shadow-2xl shadow-blue-500/30">
              Start Learning Now
          </Button>
      </div>
    </div>
  );
};

export default CourseDetailPage;
