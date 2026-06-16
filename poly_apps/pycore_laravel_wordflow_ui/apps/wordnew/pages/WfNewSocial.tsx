import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, MessageSquare, Mic, Send, Share2, Heart, Smile, UserPlus, 
  UserCheck, Image, Languages, Phone, Shield, Award, Activity, 
  Sparkle, Plus, Search, Compass, Paperclip, Music, Globe, Eye,
  Clock, CheckCircle2, ChevronRight, Volume2, Bookmark, HelpCircle
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
}

interface SocialPost {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorBadge: string;
  content: string;
  likes: number;
  likedByUser: boolean;
  comments: Comment[];
  timestamp: string;
  languageTag: string;
}

interface LearningPartner {
  id: string;
  name: string;
  avatar: string;
  nativeLang: string;
  targetLang: string;
  bio: string;
  online: boolean;
  streak: number;
  isFriend: boolean;
  badges: string[];
}

interface Message {
  id: string;
  sender: 'me' | 'them';
  type: 'text' | 'voice';
  text?: string;
  voiceDuration?: number; // seconds
  timestamp: string;
  audioWaves?: number[];
}

interface WfNewSocialProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  currentUser: {
    nickname: string;
    avatar: string;
    nativeLang: string;
    targetLang: string;
  };
}

// Simulated initial partners in the WordFlow network
const INITIAL_PARTNERS: LearningPartner[] = [
  {
    id: 'partner-1',
    name: 'Aiden Vance',
    avatar: '🦁',
    nativeLang: 'en',
    targetLang: 'zh',
    bio: 'Software engineer from Seattle studying Chinese literature. Let\'s exchange English/Mandarin!',
    online: true,
    streak: 42,
    isFriend: true,
    badges: ['🌌 Cosmic Elite', '☕ Coffee Addict']
  },
  {
    id: 'partner-2',
    name: 'Yuki Sato (佐藤雄輝)',
    avatar: '🐈',
    nativeLang: 'ja',
    targetLang: 'en',
    bio: 'TOEFL learner working on cosmic aerospace physics terms. 宇宙が好きです！',
    online: true,
    streak: 19,
    isFriend: false,
    badges: ['⚡ Tech Core', '🔭 stargazer']
  },
  {
    id: 'partner-3',
    name: 'Charlotte Dubois',
    avatar: '🦊',
    nativeLang: 'fr',
    targetLang: 'es',
    bio: 'French aesthetic writer investigating romance languages & classical street slang.',
    online: false,
    streak: 104,
    isFriend: true,
    badges: ['❧ Literary Fine', '🎨 Artist']
  },
  {
    id: 'partner-4',
    name: 'Carlos Ruiz',
    avatar: '🐼',
    nativeLang: 'es',
    targetLang: 'en',
    bio: 'Biomedical student preparing for clinical resonance exams. Looking to build durable synapse links.',
    online: true,
    streak: 8,
    isFriend: false,
    badges: ['🧠 Bio-Cognitive']
  },
  {
    id: 'partner-5',
    name: 'Kim Min-jun (김민준)',
    avatar: '🐰',
    nativeLang: 'ko',
    targetLang: 'fr',
    bio: 'Aesthetic designer studying French. Let\'s practice together!',
    online: false,
    streak: 27,
    isFriend: false,
    badges: ['🎨 Artist', '🍕 Foodie']
  }
];

// Initial timeline posts/moments
const INITIAL_POSTS: SocialPost[] = [
  {
    id: 'post-1',
    authorName: 'Aiden Vance',
    authorAvatar: '🦁',
    authorBadge: '🌌 Cosmic Elite',
    content: 'Just learned "Nebula" and "Ethereal" today on WordFlow! It beautifully matches my astrophysics paper outline about galactic stardust expansions. 🌌🚀 Highly sophisticated cognitive reasoning!',
    likes: 12,
    likedByUser: false,
    comments: [
      { id: 'c-1', author: 'Charlotte Dubois', avatar: '🦊', text: 'Stardust is indeed such an ephemeral yet resplendent concept! ❧', time: '1h ago' }
    ],
    timestamp: '2 hours ago',
    languageTag: 'en'
  },
  {
    id: 'post-2',
    authorName: 'Yuki Sato',
    authorAvatar: '🐈',
    authorBadge: '🔭 stargazer',
    content: '今日も宇宙構造の単語「Supernova」(超新星) を暗記しました。大脳皮質の「Synapse」に強固な接続が構築された気がします！🧠✨',
    likes: 8,
    likedByUser: true,
    comments: [],
    timestamp: '4 hours ago',
    languageTag: 'ja'
  }
];

export const WfNewSocial: React.FC<WfNewSocialProps> = ({ activeTheme, addToast, currentUser }) => {
  const [partners, setPartners] = useState<LearningPartner[]>(() => {
    const cached = localStorage.getItem('wf_social_partners');
    return cached ? JSON.parse(cached) : INITIAL_PARTNERS;
  });

  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const cached = localStorage.getItem('wf_social_posts');
    return cached ? JSON.parse(cached) : INITIAL_POSTS;
  });

  // State configurations
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'partners' | 'direct_chat'>('feed');
  const [searchText, setSearchText] = useState('');
  const [preferredLang, setPreferredLang] = useState<string>('all');
  const [selectedFriendChat, setSelectedFriendChat] = useState<LearningPartner | null>(null);

  // Moment posting inputs
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostLang, setNewPostPostLang] = useState('en');

  // Comment adding inputs
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Interactive Friends Chat histories
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>(() => {
    const cached = localStorage.getItem('wf_social_chats');
    if (cached) return JSON.parse(cached);

    // Seed default chat messages
    return {
      'partner-1': [
        { id: 'm1', sender: 'them', type: 'text', text: 'Hey there! How is your vocabulary training going today in WordFlow? 🚀', timestamp: '10:35 AM' },
        { id: 'm2', sender: 'me', type: 'text', text: 'Incredibly smooth! I just calibrated my bilingual acoustic recital ratio parameters in the Settings panel.', timestamp: '10:37 AM' },
        { id: 'm3', sender: 'them', type: 'voice', voiceDuration: 4, timestamp: '10:38 AM', audioWaves: [12, 28, 48, 55, 30, 15, 20, 35, 60, 40, 20, 8] }
      ],
      'partner-3': [
        { id: 'm4', sender: 'them', type: 'text', text: 'Bonjour friend! Did you look up "Ephemeral" under our literary pack? Quite stunning aesthetic melancholy.', timestamp: 'Yesterday' }
      ]
    };
  });

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [newMessageText, setNewMessageText] = useState('');

  useEffect(() => {
    localStorage.setItem('wf_social_partners', JSON.stringify(partners));
  }, [partners]);

  useEffect(() => {
    localStorage.setItem('wf_social_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('wf_social_chats', JSON.stringify(chatHistories));
  }, [chatHistories]);

  // Friend status toggles
  const handleAddFriend = (partnerId: string) => {
    setPartners(prev => prev.map(p => {
      if (p.id === partnerId) {
        const updatedStatus = !p.isFriend;
        addToast(
          updatedStatus 
            ? `Successfully partnered with ${p.name}! Let's study in sync.` 
            : `Removed ${p.name} from partners list.`, 
          updatedStatus ? 'success' : 'warning'
        );
        return { ...p, isFriend: updatedStatus };
      }
      return p;
    }));
  };

  // Add Comment Action
  const handleAddComment = (postId: string) => {
    if (!commentText.trim()) return;
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const newComment: Comment = {
          id: `comment-${Date.now()}`,
          author: currentUser.nickname + ' (You)',
          avatar: currentUser.avatar,
          text: commentText,
          time: 'Just now'
        };
        return {
          ...p,
          comments: [...p.comments, newComment]
        };
      }
      return p;
    }));
    setCommentText('');
    setActiveCommentPostId(null);
    addToast('Comment synchronized on the cosmos grid!', 'success');
  };

  // Toggle Likes Action
  const handleToggleLike = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isNowLiked = !p.likedByUser;
        return {
          ...p,
          likedByUser: isNowLiked,
          likes: isNowLiked ? p.likes + 1 : p.likes - 1
        };
      }
      return p;
    }));
  };

  // Post new moment update
  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) {
      addToast('Cosmos update cannot be hollow!', 'warning');
      return;
    }
    const newPost: SocialPost = {
      id: `post-${Date.now()}`,
      authorName: currentUser.nickname,
      authorAvatar: currentUser.avatar,
      authorBadge: '🌌 WordFlow Pioneer',
      content: newPostContent,
      likes: 1,
      likedByUser: true,
      comments: [],
      timestamp: 'Just now',
      languageTag: newPostLang
    };

    setPosts([newPost, ...posts]);
    setNewPostContent('');
    addToast('Your learning insight has been published!', 'success');
  };

  // Direct message sending (Text)
  const handleSendTextMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedFriendChat) return;

    const partnerId = selectedFriendChat.id;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      sender: 'me',
      type: 'text',
      text: newMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistories(prev => ({
      ...prev,
      [partnerId]: [...(prev[partnerId] || []), newMsg]
    }));

    setNewMessageText('');

    // Trigger mock auto-reply simulation to demonstrate conversational logic
    setTimeout(() => {
      const responses = [
        "Incredible feedback! Let's schedule a synchronous walkman listening loop session soon. 🎧",
        "That is highly sophisticated. I loved studying your latest shared deck tags!",
        "Yes, the neural connection seems to grow stronger with every bento box we clear out.",
        "Exactly. Let's practice pronouncing this tricky vocabulary string together."
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];
      const replyMsg: Message = {
        id: `m-reply-${Date.now()}`,
        sender: 'them',
        type: 'text',
        text: randomReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistories(p => ({
        ...p,
        [partnerId]: [...(p[partnerId] || []), replyMsg]
      }));
    }, 1500);
  };

  // Start Mic Recording simulation
  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordSeconds(s => s + 1);
    }, 1000);
    addToast('Waveform microphone capturing active...', 'info');
  };

  // Stop Mic Recording and compile mock audio visual snippet
  const handleStopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    
    if (!selectedFriendChat) return;
    const partnerId = selectedFriendChat.id;
    const duration = recordSeconds <= 0 ? 3 : recordSeconds;

    // Generate random mock audio waveform blocks
    const waveVals: number[] = [];
    for (let i = 0; i < 15; i++) {
      waveVals.push(Math.floor(Math.random() * 50) + 10);
    }

    const newMsg: Message = {
      id: `m-voice-${Date.now()}`,
      sender: 'me',
      type: 'voice',
      voiceDuration: duration,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioWaves: waveVals,
      // Provide translation transcript caption for real fidelity
      text: "[Voice Note] Synthesizing acoustic pronunciation..."
    };

    setChatHistories(prev => ({
      ...prev,
      [partnerId]: [...(prev[partnerId] || []), newMsg]
    }));

    addToast('Acoustic voice note transmitted into conversational thread.', 'success');

    // Partner reply mock
    setTimeout(() => {
      const replyMsg: Message = {
        id: `m-voice-reply-${Date.now()}`,
        sender: 'them',
        type: 'voice',
        voiceDuration: 5,
        audioWaves: [8, 15, 35, 45, 50, 42, 30, 20, 25, 40, 52, 28, 12, 5],
        text: "[Voice reply] Understood perfectly! Your phonetics sound pristine.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistories(p => ({
        ...p,
        [partnerId]: [...(p[partnerId] || []), replyMsg]
      }));
    }, 2000);
  };

  // Filtering partners list
  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          p.bio.toLowerCase().includes(searchText.toLowerCase());
    
    if (preferredLang === 'all') return matchesSearch;
    return matchesSearch && (p.targetLang === preferredLang || p.nativeLang === preferredLang);
  });

  const activeFriendList = partners.filter(p => p.isFriend);

  return (
    <div className={`p-4 md:p-6 rounded-3xl ${activeTheme.cardClass} shadow-xl max-w-5xl mx-auto border border-white/5`}>
      
      {/* 1. Header Toolbar with Dynamic Social Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
              WordFlow Social Corridor
              <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-mono py-0.5 px-2 rounded-full border border-indigo-500/5">
                Beta v2
              </span>
            </h3>
            <p className="text-zinc-500 text-xs font-mono">
              Synchronize with cosmic bilingual learners, query tags, and trigger acoustic voice message exchanges
            </p>
          </div>
        </div>

        {/* Action Switch buttons */}
        <div className="flex bg-white/2 dark:bg-white/5 p-1 rounded-2xl border border-white/5 self-start">
          <button
            onClick={() => setActiveSubTab('feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeSubTab === 'feed'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🌌 Moments Feed
          </button>
          <button
            onClick={() => setActiveSubTab('partners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeSubTab === 'partners'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🧭 Partner Search
          </button>
          <button
            onClick={() => setActiveSubTab('direct_chat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer relative ${
              activeSubTab === 'direct_chat'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            💬 Active Rooms
            {activeFriendList.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Content Sections Grid / Feed */}
      <div className="mt-6">

        {/* ====== SUBTAB: FEED ====== */}
        {activeSubTab === 'feed' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Compose and Feed stream */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Compose New Moment Post */}
              <form onSubmit={handlePublishPost} className="p-5 rounded-2xl bg-white/2 dark:bg-white/4 border border-white/5 space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/15 flex items-center justify-center text-lg select-none">
                    {currentUser.avatar}
                  </div>
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Share a multi-lingual linguistic breakthrough, cosmic quote, or learning milestone..."
                      className="w-full bg-transparent border-0 outline-none resize-none text-xs font-sans text-slate-100 placeholder-zinc-500 h-20"
                    />
                    
                    {/* Tag bar */}
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">Attachment tag:</span>
                        <select
                          value={newPostLang}
                          onChange={(e) => setNewPostPostLang(e.target.value)}
                          className="bg-slate-900/80 text-zinc-300 font-mono text-[10px] border border-white/10 rounded-lg py-1 px-2 cursor-pointer outline-none"
                        >
                          <option value="en">🇺🇸 English</option>
                          <option value="fr">🇫🇷 French</option>
                          <option value="ja">🇯🇵 Japanese</option>
                          <option value="es">🇪🇸 Spanish</option>
                          <option value="ko">🇰🇷 Korean</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white font-mono text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Broadcast (发布瞬间)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Feed Stream */}
              <div className="space-y-4">
                {posts.map(post => {
                  const isActiveCommentOpen = activeCommentPostId === post.id;
                  return (
                    <motion.div
                      layout
                      key={post.id}
                      className="p-5 rounded-2xl bg-white/2 dark:bg-white/3 border border-white/5 hover:border-white/10 transition-all space-y-4"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-md select-none">
                            {post.authorAvatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200">{post.authorName}</span>
                              <span className="text-[9px] font-mono tracking-widest text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                {post.authorBadge}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">{post.timestamp}</span>
                          </div>
                        </div>

                        <span className="text-[9px] font-mono uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-white/5">
                          lang: {post.languageTag}
                        </span>
                      </div>

                      {/* Post Content */}
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">{post.content}</p>

                      {/* Interactive Buttons footer */}
                      <div className="flex items-center gap-4 pt-2 border-t border-white/5 text-zinc-500 font-mono text-[11px] select-none">
                        
                        {/* Likes button */}
                        <button
                          onClick={() => handleToggleLike(post.id)}
                          className={`flex items-center gap-1 hover:text-rose-400 transition-colors ${
                            post.likedByUser ? 'text-rose-500 font-bold' : ''
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${post.likedByUser ? 'fill-current text-rose-500' : ''}`} />
                          <span>{post.likes} Likes</span>
                        </button>

                        {/* Comments Toggle */}
                        <button
                          onClick={() => {
                            setActiveCommentPostId(isActiveCommentOpen ? null : post.id);
                          }}
                          className={`flex items-center gap-1 hover:text-indigo-400 transition-colors ${
                            isActiveCommentOpen ? 'text-indigo-400 font-bold' : ''
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.comments.length} Comments</span>
                        </button>
                      </div>

                      {/* Comments Area */}
                      <AnimatePresence>
                        {isActiveCommentOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 pt-3 border-t border-dashed border-white/5"
                          >
                            {/* Comments List */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {post.comments.map(comment => (
                                <div key={comment.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex gap-2">
                                  <span className="text-sm select-none">{comment.avatar}</span>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-bold text-zinc-300">{comment.author}</span>
                                      <span className="text-[9px] text-zinc-500 font-mono">{comment.time}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">{comment.text}</p>
                                  </div>
                                </div>
                              ))}
                              {post.comments.length === 0 && (
                                <p className="text-zinc-500 text-[10px] text-center font-mono py-2">
                                  No cosmic comment traces. Write yours now!
                                </p>
                              )}
                            </div>

                            {/* Add Comment Field */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Write a gorgeous comment..."
                                className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 text-slate-100 placeholder-zinc-500"
                              />
                              <button
                                onClick={() => handleAddComment(post.id)}
                                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-755 text-white text-xs font-bold transition-all cursor-pointer"
                              >
                                Send
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right Side: Quick Stats and Online Friends */}
            <div className="space-y-6">
              
              {/* Daily dynamic partners telemetry card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 to-purple-950/20 border border-indigo-500/10 space-y-4">
                <h4 className="text-xs font-black font-mono tracking-widest text-indigo-400 uppercase flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Linguistic Synergy Dashboard
                </h4>
                <div className="space-y-3 font-mono text-[11px]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Global Online Ratio:</span>
                    <span className="text-emerald-400 font-bold">14.8K (Studying)</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Active Friends:</span>
                    <span className="text-slate-200">{activeFriendList.length} partners</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Exchange Preference:</span>
                    <span className="text-purple-400 uppercase font-black">{currentUser.targetLang} Native</span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3">
                  <button 
                    onClick={() => setActiveSubTab('partners')}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all text-xs font-bold font-mono border border-white/5 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>🧭 Filter partners by languages</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Online Partners bar */}
              <div className="p-5 rounded-2xl bg-white/2 dark:bg-white/4 border border-white/5 space-y-4">
                <h4 className="text-xs font-black font-mono tracking-widest text-slate-300 uppercase flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-450 fill-rose-500/20" />
                  Active Partners ({activeFriendList.length})
                </h4>
                <div className="space-y-3">
                  {activeFriendList.map(friend => (
                    <div 
                      key={friend.id} 
                      onClick={() => {
                        setSelectedFriendChat(friend);
                        setActiveSubTab('direct_chat');
                      }}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <span className="text-lg select-none">{friend.avatar}</span>
                          <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                            friend.online ? 'bg-emerald-500' : 'bg-zinc-500'
                          }`} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">{friend.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Streak: {friend.streak} days</p>
                        </div>
                      </div>

                      <MessageSquare className="w-4 h-4 text-zinc-500 hover:text-indigo-400 transition-colors" />
                    </div>
                  ))}
                  {activeFriendList.length === 0 && (
                    <div className="text-center py-4 space-y-2">
                      <p className="text-zinc-500 text-[11px] font-mono">No partners added yet.</p>
                      <button
                        onClick={() => setActiveSubTab('partners')}
                        className="text-[11px] font-mono text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        Browse Active Learners →
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ====== SUBTAB: PARTNERS (Discovery Portal) ====== */}
        {activeSubTab === 'partners' && (
          <div className="space-y-6">
            
            {/* Filter ribbons toolbar */}
            <div className="p-4 rounded-2xl bg-white/2 dark:bg-white/3 border border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-center">
              
              {/* Keyword Query Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Insert name or interest tags..."
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 outline-none placeholder-zinc-500 focus:border-indigo-500/50"
                />
              </div>

              {/* Language Preferences button tag lists */}
              <div className="flex bg-white/2 dark:bg-white/5 p-1 rounded-xl border border-white/5 gap-1 overflow-x-auto w-full sm:w-auto">
                {[
                  { code: 'all', label: 'All 🌐' },
                  { code: 'en', label: 'English' },
                  { code: 'zh', label: 'Chinese' },
                  { code: 'ja', label: 'Japanese' },
                  { code: 'es', label: 'Spanish' },
                  { code: 'fr', label: 'French' },
                  { code: 'ko', label: 'Korean' }
                ].map(langItem => (
                  <button
                    key={langItem.code}
                    onClick={() => setPreferredLang(langItem.code)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                      preferredLang === langItem.code
                        ? 'bg-indigo-650 text-white shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {langItem.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Partners Catalog grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPartners.map(partner => (
                <div 
                  key={partner.id}
                  className="p-5 rounded-2xl bg-white/2 dark:bg-white/3 border border-white/5 hover:border-white/10 hover:scale-[1.01] transition-all flex flex-col justify-between space-y-4 relative"
                >
                  {/* Streak & Badge label overlay to show active credentials */}
                  <div className="flex justify-between items-start">
                    <div className="flex gap-1 items-center flex-wrap max-w-[70%]">
                      {partner.badges.map((badge, bIdx) => (
                        <span 
                          key={bIdx}
                          className="text-[8px] font-black font-mono tracking-wider bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      🔥 {partner.streak}d streak
                    </span>
                  </div>

                  {/* Body part details */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="text-2xl select-none">{partner.avatar}</span>
                        <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                          partner.online ? 'bg-emerald-500' : 'bg-zinc-500'
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-200">{partner.name}</h4>
                        <p className="text-[10px] text-indigo-400 font-mono">
                          Native: <span className="uppercase text-slate-300 font-bold">{partner.nativeLang}</span> / Target: <span className="uppercase text-slate-300 font-bold">{partner.targetLang}</span>
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-3 leading-relaxed">
                      {partner.bio}
                    </p>
                  </div>

                  {/* Bottom partner action row */}
                  <div className="flex gap-2.5 pt-3 border-t border-white/5">
                    
                    {/* Add Friend button */}
                    <button
                      onClick={() => handleAddFriend(partner.id)}
                      className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        partner.isFriend 
                          ? 'bg-zinc-805/40 border-zinc-700 text-indigo-400' 
                          : 'bg-indigo-600/90 hover:bg-indigo-705 border-indigo-500/20 text-white'
                      }`}
                    >
                      {partner.isFriend ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Collaborating (已加好友)</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Sync Partner (加好友)</span>
                        </>
                      )}
                    </button>

                    {/* Chat messaging launcher button */}
                    <button
                      onClick={() => {
                        setSelectedFriendChat(partner);
                        if (!partner.isFriend) {
                          // Auto add as friend to enable chat smoothly
                          setPartners(prev => prev.map(p => p.id === partner.id ? { ...p, isFriend: true } : p));
                        }
                        setActiveSubTab('direct_chat');
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/5 text-zinc-400 transition-all cursor-pointer"
                      title="Direct Chat Session"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              ))}
              {filteredPartners.length === 0 && (
                <div className="col-span-full py-16 text-center text-zinc-500 space-y-2">
                  <p className="text-xs font-mono">No matching bilingual coordinates on our galactic records.</p>
                  <button 
                    onClick={() => { setSearchText(''); setPreferredLang('all'); }}
                    className="px-4 py-2 bg-indigo-650/15 text-indigo-400 rounded-xl text-xs font-mono border border-indigo-505/10 hover:bg-indigo-505/20 cursor-pointer"
                  >
                    Reset Grid filters
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ====== SUBTAB: DIRECT CHAT (Room Corridor) ====== */}
        {activeSubTab === 'direct_chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[550px] relative">
            
            {/* Friends list pane (Left 1 Col) */}
            <div className="lg:col-span-1 rounded-2xl bg-white/2 dark:bg-white/3 border border-white/5 flex flex-col overflow-hidden max-h-full">
              <div className="p-3.5 border-b border-white/5">
                <span className="text-[10px] font-black font-mono uppercase tracking-widest text-zinc-500">Active Rooms ({activeFriendList.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                {activeFriendList.map(item => {
                  const isSelected = selectedFriendChat?.id === item.id;
                  const chatLogs = chatHistories[item.id] || [];
                  const lastMsg = chatLogs[chatLogs.length - 1];
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedFriendChat(item)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between border ${
                        isSelected 
                          ? 'bg-indigo-500/10 border-indigo-500/30' 
                          : 'bg-transparent border-transparent hover:bg-white/3 hover:border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <span className="text-lg select-none">{item.avatar}</span>
                          <span className={`absolute -bottom-1 -right-1 w-2 rounded-full border border-slate-950 h-2 ${
                            item.online ? 'bg-emerald-500' : 'bg-zinc-500'
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                            {item.name}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono truncate">
                            {lastMsg ? (lastMsg.type === 'voice' ? '🎙️ Voice message' : lastMsg.text) : 'Tap to start...'}
                          </p>
                        </div>
                      </div>

                      {item.online && (
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      )}
                    </div>
                  );
                })}
                {activeFriendList.length === 0 && (
                  <div className="p-4 text-center text-zinc-500 space-y-2">
                    <p className="text-[10px] font-mono leading-relaxed">No chat sessions. Browse partners first.</p>
                    <button
                      onClick={() => setActiveSubTab('partners')}
                      className="px-3 py-1 bg-indigo-650/20 text-indigo-400 font-serif text-[10px] font-bold rounded-lg hover:underline cursor-pointer"
                    >
                      Portal Link →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Conversation Body Area (Right 3 Cols) */}
            <div className="lg:col-span-3 rounded-2xl bg-white/1.5 dark:bg-slate-950/40 border border-white/5 flex flex-col justify-between overflow-hidden relative max-h-full">
              
              {selectedFriendChat ? (
                <>
                  {/* Chat Sub-Header */}
                  <div className="p-4 bg-white/2 dark:bg-white/3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl select-none">{selectedFriendChat.avatar}</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{selectedFriendChat.name}</h4>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {selectedFriendChat.online ? '🟢 Connected online' : '⚫ Offline sleep state'} | Streak: {selectedFriendChat.streak}d
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase">
                        lang exchange: {selectedFriendChat.targetLang}
                      </span>
                    </div>
                  </div>

                  {/* Chat Message Scrolling List */}
                  <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5 bg-slate-900/10">
                    {(chatHistories[selectedFriendChat.id] || []).map(msg => {
                      const isMe = msg.sender === 'me';
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl p-3 space-y-1.5 shadow-sm border ${
                            isMe 
                              ? 'bg-gradient-to-br from-indigo-600/90 to-purple-650/90 text-white border-indigo-500/20 rounded-tr-none' 
                              : 'bg-white/4 dark:bg-white/5 text-slate-105 border-white/5 rounded-tl-none'
                          }`}>
                            
                            {/* Message dynamic type rendering */}
                            {msg.type === 'text' ? (
                              <p className="text-[11px] leading-relaxed font-sans">{msg.text}</p>
                            ) : (
                              // Voice Message rendering with beautiful audio waves!
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <button 
                                    className="p-1 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all cursor-pointer"
                                    onClick={() => addToast(`Acoustic recital: Playing back ${msg.voiceDuration}s voice capsule.`, 'info')}
                                  >
                                    <Volume2 className="w-3.5 h-3.5 text-white" />
                                  </button>
                                  
                                  {/* Waves display */}
                                  <div className="flex items-end gap-0.5 h-6">
                                    {(msg.audioWaves || [10, 20, 15, 30, 45, 20, 12]).map((barH, hIdx) => (
                                      <div 
                                        key={hIdx}
                                        className={`w-0.75 rounded-full ${isMe ? 'bg-indigo-200' : 'bg-indigo-400'}`}
                                        style={{ height: `${(barH / 50) * 100}%` }}
                                      />
                                    ))}
                                  </div>

                                  <span className="text-[9px] font-mono opacity-80 pl-1">{msg.voiceDuration}s</span>
                                </div>
                                {msg.text && (
                                  <div className="text-[9px] opacity-75 italic border-t border-white/10 pt-1 flex items-center gap-1">
                                    <span>Caption transcript:</span>
                                    <span>{msg.text}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Timestamp */}
                            <span className={`block text-[8px] font-mono text-right opacity-60`}>
                              {msg.timestamp}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {(chatHistories[selectedFriendChat.id] || []).length === 0 && (
                      <div className="text-center py-12 text-zinc-500 font-mono text-[10px]">
                        Grid session initialized cleanly. Send your first transmitter word!
                      </div>
                    )}
                  </div>

                  {/* Continuous Recording State Overlay */}
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        className="absolute bottom-[60px] left-1/2 -translate-x-1/2 bg-slate-950/95 border border-red-500/35 p-3 px-6 rounded-2xl flex items-center gap-4 z-40 shadow-2xl"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10px] font-mono tracking-widest uppercase text-red-400 animate-pulse">recording: {recordSeconds}s</span>
                        </div>

                        {/* Faux waveform animations to look realistic */}
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5, 6].map(i => (
                            <motion.div 
                              className="w-[3px] bg-indigo-500 rounded-full"
                              key={i}
                              animate={{ height: [10, Math.random() * 25 + 10, 10] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                            />
                          ))}
                        </div>

                        <button
                          onClick={handleStopRecording}
                          type="button"
                          className="px-3 py-1 bg-red-650 hover:bg-red-750 text-white rounded-lg text-[10px] font-mono font-black uppercase cursor-pointer"
                        >
                          Release & Transmit
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Chat Input form bar with Voice trigger and attachment drawer */}
                  <form onSubmit={handleSendTextMessage} className="p-3.5 bg-white/2 dark:bg-white/4 border-t border-white/5 flex gap-2 items-center">
                    
                    {/* Voice Recording Toggle button */}
                    <button
                      type="button"
                      onMouseDown={handleStartRecording}
                      onMouseUp={handleStopRecording}
                      onTouchStart={handleStartRecording}
                      onTouchEnd={handleStopRecording}
                      className={`p-2.5 rounded-xl border border-white/5 text-zinc-400 hover:text-indigo-400 transition-all cursor-pointer ${
                        isRecording ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-white/3'
                      }`}
                      title="Hold to Record Voice (长按录音)"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    {/* text inputs */}
                    <input
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder={isRecording ? 'Capturing audio frequencies...' : 'Transmit vocabulary message or question...'}
                      className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-120 outline-none focus:border-indigo-500"
                      disabled={isRecording}
                    />

                    {/* Quick smile/paperclip attachment buttons */}
                    <button 
                      type="button"
                      onClick={() => addToast("Bilingual document attachments configured on standard profile.", "info")}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer hidden sm:block"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Send button */}
                    <button
                      type="submit"
                      className="p-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
                      disabled={isRecording || !newMessageText.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">No Interactive Room Selected</h4>
                    <p className="text-zinc-500 text-[11px] font-mono mt-1 max-w-sm">
                      Select one of your saved study partners from the left panel to begin exchanging acoustic messages and text loops.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveSubTab('partners')}
                    className="px-4 py-2 bg-indigo-650 text-white font-mono text-[10px] font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer"
                  >
                    🧭 Exchange Partner Directory
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
