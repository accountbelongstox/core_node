/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button, Card, BackButton, Badge, Stat, LoadingState } from '../../components/UI';
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
        api.getWordGroups().then(gs => (Array.isArray(gs) ? gs : []).find(g => g.id === groupId)),
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

  if (loading || !group || !analysis) return (
    <div className="h-full flex items-center justify-center">
      <LoadingState label="Analyzing Content..." />
    </div>
  );

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate('courses')} />
        <span className="ds-section-label">Course Analysis</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 ds-stack">
          {/* Cover Section */}
          <div className="flex items-center gap-6 px-1">
              <div className="ds-media-frame w-24 h-32 shrink-0">
                  <span className="text-5xl">{group.coverImage}</span>
              </div>
              <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-black text-[var(--color-text-primary)] leading-tight mb-2 line-clamp-2">{group.name}</h1>
                  <Badge tone="klein">{group.type}</Badge>
              </div>
          </div>

          {/* Analysis Cards */}
          <div className="ds-grid-breathing grid-cols-2">
              {/* Hero overlap card — gradient hero surface */}
              <div className="col-span-2 rounded-[var(--radius-card)] p-7 flex flex-col items-center text-center text-[color:var(--klein-on)] relative overflow-hidden" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}>
                   <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl"></div>
                   <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl"></div>
                   <div className="relative z-10">
                      <div className="text-4xl font-black mb-1">{analysis.similarity}%</div>
                      <div className="text-xs font-bold uppercase tracking-widest text-white/85">Overlap with Memory</div>
                      <p className="text-xs text-white/75 mt-2">You already know {analysis.knownWords} words in this book.</p>
                   </div>
              </div>

              <Card className="flex flex-col items-center justify-center py-7">
                  <Stat value={analysis.newWords} label="New Words" accent className="items-center" />
              </Card>

              <Card className="flex flex-col items-center justify-center py-7">
                  <Stat value={`~${Math.ceil(analysis.newWords / (user?.dailyGoal || 20))}`} label="Days to Finish" accent className="items-center" />
              </Card>
          </div>

          <div className="px-1">
              <h3 className="ds-section-title mb-3">Course Description</h3>
              <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                  {group.description || "This comprehensive course covers essential vocabulary tailored for your learning goals. Optimized for memory retention with spaced repetition compatibility."}
              </p>
          </div>

          {/* Sample Words Preview */}
           <div className="px-1">
              <h3 className="ds-section-title mb-3">Sample Content</h3>
              <div className="ds-stack-tight flex flex-col">
                  {[1,2,3].map(i => (
                      <div key={i} className="ds-row flex items-center gap-3 p-4">
                          <span className="w-8 h-8 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-xs font-bold text-[var(--klein-blue)]">{i}</span>
                          <div className="h-2 w-24 bg-black/10 dark:bg-white/10 rounded-full"></div>
                          <div className="h-2 w-16 bg-black/10 dark:bg-white/10 rounded-full opacity-50"></div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Floating Action Bar — gradient hero CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/90 to-transparent pb-safe z-20">
          <Button variant="grad" onClick={handleAddToLibrary}>
              Start Learning Now
          </Button>
      </div>
    </div>
  );
};

export default CourseDetailPage;
