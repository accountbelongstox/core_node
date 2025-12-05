import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '../services/api';
import {
  Card,
  Button,
  SectionTitle,
  Avatar,
  Tag,
  ProgressBar,
  Row,
  StatPill,
  Divider,
  PillButton,
} from '../components/UI';
import {
  CourseAnalysis,
  LeaderboardUser,
  QuizQuestion,
  RetentionStat,
  User,
  Word,
  WordGroup,
} from '../models/types';
import { MOCK_ACHIEVEMENTS, MOCK_FRIENDS, MOCK_ACTIVITIES } from '../services/mockData';
import { useAppContext } from '../state/AppContext';
import { palette, shadow } from '../theme';

const ScreenContainer = ({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 px-5 pb-24"
      style={[
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 80 },
      ]}>
      <ScrollView
        contentContainerStyle={styles.content}
        className="flex-1">
        <View style={styles.contentInner} className="w-full">
          {title && (
            <View className="mb-4">
              <Text className="text-2xl font-black text-slate-900">{title}</Text>
              {subtitle && <Text className="text-sm text-slate-500 mt-1">{subtitle}</Text>}
            </View>
          )}
          <View className="gap-3">
            {children}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export const LoginScreen = () => {
  const { login } = useAppContext();
  const [email, setEmail] = useState('user@wordflow.ai');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      login(res.user as User);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer title="Welcome Back" subtitle="Sign in to continue learning">
      <Card variant="holo" className="bg-white/80">
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          style={styles.input}
          placeholder="you@example.com"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="••••••••"
        />
        <Button onPress={handleLogin} style={{ marginTop: 12 }}>
          {loading ? 'Connecting...' : 'Login'}
        </Button>
      </Card>
    </ScreenContainer>
  );
};

export const DashboardScreen = () => {
  const { user, navigate, t, activeGroupId } = useAppContext();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<WordGroup | null>(null);

  useEffect(() => {
    api.getWordGroups().then(gs => {
      setGroups(gs);
      const found = gs.find(g => g.id === activeGroupId) || gs[0];
      setActiveGroup(found);
    });
  }, [activeGroupId]);

  const startMode = (route: Parameters<typeof navigate>[0]) => {
    navigate(route, { groupId: activeGroupId });
  };

  return (
    <ScreenContainer>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
        className="rounded-[28px] p-5 mb-4">
        <Row spaced className="items-start">
          <View className="gap-1">
            <Text style={styles.heroKicker}>{t('start_learning')}</Text>
            <Text style={styles.heroTitle}>{user?.name.split(' ')[0]}</Text>
            <Text style={styles.heroSub}>Personalized session launcher</Text>
          </View>
          <Pressable onPress={() => navigate('profile')} style={styles.heroAvatarWrap}>
            <Avatar uri={user?.avatar} size={64} />
          </Pressable>
        </Row>
        <View style={styles.heroStats}>
          <View>
            <Text style={styles.heroStatLabel}>Streak</Text>
            <Text style={styles.heroStatValue}>{user?.streak}d</Text>
          </View>
          <View>
            <Text style={styles.heroStatLabel}>Daily</Text>
            <Text style={styles.heroStatValue}>{user?.dailyProgress}/{user?.dailyGoal}</Text>
          </View>
          <View>
            <Text style={styles.heroStatLabel}>Total</Text>
            <Text style={styles.heroStatValue}>{user?.totalLearned}</Text>
          </View>
        </View>
      </LinearGradient>

      <Card onPress={() => navigate('courses')} variant="holo" style={styles.activeGroupCard} className="mb-4">
        <Row spaced className="items-center">
          <Row className="items-center">
            <View style={styles.groupIcon}>
              <Text style={styles.groupIconText}>{activeGroup?.coverImage || '📚'}</Text>
            </View>
            <View>
              <Text style={styles.tagline}>Current Book</Text>
              <Text style={styles.cardTitle}>{activeGroup?.name || 'Loading...'}</Text>
              <Text style={styles.miniLabel}>{activeGroup?.language?.toUpperCase()} · {activeGroup?.count} words</Text>
            </View>
          </Row>
          <Tag>Change</Tag>
        </Row>
      </Card>

      <SectionTitle>Study Center</SectionTitle>
      <Card
        onPress={() => startMode('playlist')}
        variant="holo"
        gradient={['#2563eb', '#9333ea']}
        className="mt-2">
        <Row spaced>
          <View>
            <Tag>RECOMMENDED</Tag>
            <Text style={[styles.cardTitle, { color: '#fff', marginTop: 8 }]}>
              Smart Playlist
            </Text>
            <Text style={styles.cardSubtitle}>Auto-play & Instant Review</Text>
          </View>
          <View style={styles.fabCircle}>
            <Text style={styles.fabText}>▶</Text>
          </View>
        </Row>
      </Card>

      <Row spaced>
        <Card onPress={() => startMode('flashcard_run')} style={styles.squareCard} className="mr-2">
          <View style={styles.squareIcon} className="bg-blue-100">
            <Text style={styles.squareIconText}>Aa</Text>
          </View>
          <Text style={styles.cardTitle}>Flashcards</Text>
          <Text style={styles.miniLabel}>Spaced Repetition</Text>
        </Card>
        <Card onPress={() => startMode('reading_run')} style={styles.squareCard}>
          <View style={[styles.squareIcon, { backgroundColor: '#f3e8ff' }]}>
            <Text style={[styles.squareIconText, { color: '#6b21a8' }]}>📖</Text>
          </View>
          <Text style={styles.cardTitle}>Reading</Text>
          <Text style={styles.miniLabel}>Flow Context</Text>
        </Card>
      </Row>

      <Row spaced>
        <Card onPress={() => startMode('quiz_run')} style={styles.squareCard}>
          <View style={[styles.squareIcon, { backgroundColor: '#fff1e6' }]}>
            <Text style={[styles.squareIconText, { color: '#f97316' }]}>?</Text>
          </View>
          <Text style={styles.cardTitle}>Quiz</Text>
          <Text style={styles.miniLabel}>Gamified Test</Text>
        </Card>
        <Card onPress={() => startMode('listening_player')} style={styles.squareCard}>
          <View style={[styles.squareIcon, { backgroundColor: '#ffe4e6' }]}>
            <Text style={[styles.squareIconText, { color: '#ec4899' }]}>🎧</Text>
          </View>
          <Text style={styles.cardTitle}>Passive</Text>
          <Text style={styles.miniLabel}>Audio Loop</Text>
        </Card>
      </Row>

      <SectionTitle>My Progress</SectionTitle>
      <Row spaced>
        <Card onPress={() => navigate('stats')} style={styles.progressCard} className="mr-2">
          <Text style={styles.emoji}>🔥</Text>
          <Text style={styles.cardTitle}>{user?.streak} Days</Text>
          <Text style={styles.miniLabel}>Current Streak</Text>
        </Card>
        <Card onPress={() => navigate('review_dashboard')} style={styles.progressCard}>
          <Text style={styles.emoji}>📈</Text>
          <Text style={styles.cardTitle}>85%</Text>
          <Text style={styles.miniLabel}>Retention Rate</Text>
        </Card>
      </Row>

      <Divider />
      <SectionTitle>Library</SectionTitle>
      {groups.map(g => (
        <Card key={g.id} onPress={() => navigate('course_detail', { groupId: g.id })} variant="holo">
          <Row spaced>
            <Row>
              <View style={styles.groupIconSmall}>
                <Text style={styles.groupIconText}>{g.coverImage || '📘'}</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>{g.name}</Text>
                <Text style={styles.miniLabel}>{g.count} words · {g.language.toUpperCase()}</Text>
                <ProgressBar percent={g.progress} />
              </View>
            </Row>
            <Tag>{g.type}</Tag>
          </Row>
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const StatsScreen = () => {
  const [stats, setStats] = useState<RetentionStat[]>([]);
  useEffect(() => {
    api.getRetentionStats().then(setStats);
  }, []);

  return (
    <ScreenContainer title="Statistics" subtitle="Review health across memory buckets">
      <Row spaced className="mb-3">
        <Card variant="holo" className="flex-1 mr-2">
          <Text className="text-xs uppercase tracking-[0.15em] text-slate-500 font-bold">Total Items</Text>
          <Text className="text-3xl font-black text-slate-900 mt-1">{stats.reduce((a, b) => a + b.count, 0)}</Text>
        </Card>
        <Card variant="holo" className="flex-1">
          <Text className="text-xs uppercase tracking-[0.15em] text-slate-500 font-bold">Mastered</Text>
          <Text className="text-3xl font-black text-slate-900 mt-1">{stats.find(s => s.level === 'Mastered')?.count ?? 0}</Text>
        </Card>
      </Row>
      {stats.map(s => (
        <Card key={s.level} style={{ borderColor: s.color + '55' }} className="bg-white/90">
          <Row spaced className="items-center">
            <View>
              <Text style={styles.cardTitle} className="text-slate-900">{s.level}</Text>
              <Text style={styles.miniLabel} className="text-slate-500">{s.count} words</Text>
            </View>
            <StatPill value={`${s.percentage}%`} label="mastery" color={s.color} />
          </Row>
          <ProgressBar percent={s.percentage} color={s.color} />
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const ReadingSetupScreen = () => {
  const { playlistSettings, updatePlaylistSettings, navigate } = useAppContext();
  return (
    <ScreenContainer title="Reading Mode" subtitle="Configure flow before you start">
      <Card>
        <Text style={styles.label}>Words per page</Text>
        <TextInput
          value={String(playlistSettings.wordsPerPage)}
          onChangeText={v => updatePlaylistSettings({ wordsPerPage: Number(v) || 0 })}
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.label}>Play interval (sec)</Text>
        <TextInput
          value={String(playlistSettings.playInterval)}
          onChangeText={v => updatePlaylistSettings({ playInterval: Number(v) || 0 })}
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.label}>Repeat count</Text>
        <TextInput
          value={String(playlistSettings.repeatCount)}
          onChangeText={v => updatePlaylistSettings({ repeatCount: Number(v) || 0 })}
          keyboardType="numeric"
          style={styles.input}
        />
        <Button onPress={() => navigate('reading_run')} style={{ marginTop: 8 }}>
          Start Reading
        </Button>
      </Card>
    </ScreenContainer>
  );
};

const WordList = ({ words }: { words: Word[] }) => (
  <>
    {words.map(w => (
      <Card key={w.id} style={styles.wordCard} className="bg-white/90">
        <Row spaced>
          <View>
            <Text style={styles.cardTitle} className="text-slate-900">{w.text}</Text>
            <Text style={styles.miniLabel} className="text-slate-500">{w.phonetic}</Text>
          </View>
          <Tag>{w.masteryLevel}%</Tag>
        </Row>
        <Text style={styles.wordTranslation} className="text-slate-900">{w.translation}</Text>
        {w.definition && <Text style={styles.wordDefinition} className="text-slate-600">{w.definition}</Text>}
        <Text style={styles.example} className="text-slate-800">{w.example}</Text>
      </Card>
    ))}
  </>
);

export const ReadingRunScreen = () => {
  const { currentParams } = useAppContext();
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    api.getWordsForGroup(currentParams.groupId || 'g1').then(setWords);
  }, [currentParams.groupId]);
  return (
    <ScreenContainer title="Reading Flow" subtitle="Immersive context mode">
      <WordList words={words} />
    </ScreenContainer>
  );
};

export const FlashcardRunScreen = () => {
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    api.getWordsForGroup('g1').then(setWords);
  }, []);
  return (
    <ScreenContainer title="Flashcards" subtitle="Swipe through spaced cards">
      <WordList words={words.slice(0, 5)} />
    </ScreenContainer>
  );
};

export const ProfileScreen = () => {
  const { user, logout } = useAppContext();
  if (!user) return null;
  return (
    <ScreenContainer title="Profile" subtitle="Account overview">
      <Card variant="holo">
        <Row spaced className="items-center">
          <Row className="items-center">
            <Avatar uri={user.avatar} size={64} />
            <View className="ml-3">
              <Text style={styles.cardTitle} className="text-slate-900">{user.name}</Text>
              <Text style={styles.miniLabel} className="text-slate-500">{user.email}</Text>
              <Tag>{user.isPro ? 'PRO' : 'FREE'}</Tag>
            </View>
          </Row>
          <Button variant="ghost" onPress={logout} className="px-4">
            Logout
          </Button>
        </Row>
      </Card>
      <Row spaced className="mt-2">
        <StatPill label="Daily Goal" value={`${user.dailyGoal}`} />
        <StatPill label="Completed" value={`${user.dailyProgress}`} />
        <StatPill label="Total" value={`${user.totalLearned}`} />
      </Row>
    </ScreenContainer>
  );
};

export const SettingsIndexScreen = () => {
  const { navigate } = useAppContext();
  const links: { title: string; route: Parameters<typeof navigate>[0]; desc: string }[] = [
    { title: 'Language', route: 'settings_lang', desc: 'App & learning languages' },
    { title: 'Learning', route: 'settings_learning', desc: 'Session size, daily goal' },
    { title: 'Display', route: 'settings_display', desc: 'Theme & typography' },
    { title: 'Notifications', route: 'settings_notifications', desc: 'Reminders' },
    { title: 'Data Sync', route: 'settings_data', desc: 'Cloud sync (mocked)' },
    { title: 'About', route: 'settings_about', desc: 'Version & credits' },
  ];
  return (
    <ScreenContainer title="Settings" subtitle="Control the experience">
      {links.map(l => (
        <Card key={l.route} onPress={() => navigate(l.route)}>
          <Text style={styles.cardTitle}>{l.title}</Text>
          <Text style={styles.miniLabel}>{l.desc}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const LanguageSettingsScreen = () => {
  const { settings, updateSettings, supportedLanguages } = useAppContext();
  return (
    <ScreenContainer title="Language" subtitle="Interface and learning targets">
      <SectionTitle>Interface</SectionTitle>
      <Row>
        {supportedLanguages.map(l => (
          <PillButton
            key={l.code}
            label={`${l.flag} ${l.name}`}
            active={settings.language.appInterface === l.code}
            onPress={() => updateSettings({ language: { appInterface: l.code } })}
          />
        ))}
      </Row>
      <SectionTitle>Translation Target</SectionTitle>
      <TextInput
        style={styles.input}
        value={settings.language.translationTarget}
        onChangeText={v => updateSettings({ language: { translationTarget: v } })}
      />
    </ScreenContainer>
  );
};

export const LearningSettingsScreen = () => {
  const { settings, updateSettings } = useAppContext();
  return (
    <ScreenContainer title="Learning" subtitle="Control pacing and goals">
      <Card>
        <Text style={styles.label}>Daily word goal</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(settings.learning.dailyWordGoal)}
          onChangeText={v => updateSettings({ learning: { dailyWordGoal: Number(v) || 0 } })}
        />
        <Text style={styles.label}>Session size</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(settings.learning.sessionSize)}
          onChangeText={v => updateSettings({ learning: { sessionSize: Number(v) || 0 } })}
        />
        <Text style={styles.label}>Mode</Text>
        <Row>
          {['reading', 'card', 'random'].map(m => (
            <PillButton
              key={m}
              label={m}
              active={settings.learning.mode === m}
              onPress={() => updateSettings({ learning: { mode: m as any } })}
            />
          ))}
        </Row>
      </Card>
    </ScreenContainer>
  );
};

export const DisplaySettingsScreen = () => {
  const { settings, updateSettings } = useAppContext();
  return (
    <ScreenContainer title="Display" subtitle="Visual preferences">
      <Card>
        <Text style={styles.label}>Theme</Text>
        <Row>
          {['light', 'dark', 'auto'].map(theme => (
            <PillButton
              key={theme}
              label={theme}
              active={settings.display.theme === theme}
              onPress={() => updateSettings({ display: { theme: theme as any } })}
            />
          ))}
        </Row>
        <Text style={styles.label}>Font size</Text>
        <Row>
          {['small', 'medium', 'large'].map(f => (
            <PillButton
              key={f}
              label={f}
              active={settings.display.fontSize === f}
              onPress={() => updateSettings({ display: { fontSize: f as any } })}
            />
          ))}
        </Row>
      </Card>
    </ScreenContainer>
  );
};

export const NotificationSettingsScreen = () => {
  const { settings, updateSettings } = useAppContext();
  return (
    <ScreenContainer title="Notifications" subtitle="Stay on track">
      <Card>
        <Row spaced>
          <Text style={styles.cardTitle}>Daily reminder</Text>
          <PillButton
            label={settings.notifications.dailyReminder ? 'On' : 'Off'}
            active={settings.notifications.dailyReminder}
            onPress={() =>
              updateSettings({
                notifications: { dailyReminder: !settings.notifications.dailyReminder },
              })
            }
          />
        </Row>
        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          value={settings.notifications.reminderTime}
          onChangeText={v => updateSettings({ notifications: { reminderTime: v } })}
        />
      </Card>
    </ScreenContainer>
  );
};

export const DataSyncScreen = () => {
  return (
    <ScreenContainer title="Data Sync" subtitle="API disabled, mock enabled">
      <Card>
        <Text style={styles.cardTitle}>Offline-first</Text>
        <Text style={styles.miniLabel}>
          All requests are intercepted and served by the mock data center. Nothing is sent over the network.
        </Text>
      </Card>
    </ScreenContainer>
  );
};

export const AboutScreen = () => {
  return (
    <ScreenContainer title="About Wordflow" subtitle="Style-matched RN rewrite">
      <Card>
        <Text style={styles.cardTitle}>Version</Text>
        <Text style={styles.miniLabel}>React Native port · mock API only</Text>
      </Card>
    </ScreenContainer>
  );
};

export const CoursesScreen = () => {
  const { setActiveGroupId, navigate } = useAppContext();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  useEffect(() => {
    api.getWordGroups().then(setGroups);
  }, []);
  return (
    <ScreenContainer title="Courses" subtitle="Pick a book or upload">
      {groups.map(g => (
        <Card
          key={g.id}
          onPress={() => {
            setActiveGroupId(g.id);
            navigate('course_detail', { groupId: g.id });
          }}
          className="bg-white/90">
          <Row spaced className="items-center">
            <Row className="items-center">
              <View style={styles.groupIconSmall}>
                <Text style={styles.groupIconText}>{g.coverImage || '📘'}</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>{g.name}</Text>
                <Text style={styles.miniLabel}>{g.count} words · {g.language}</Text>
                <ProgressBar percent={g.progress} />
              </View>
            </Row>
            <Tag>{g.type}</Tag>
          </Row>
        </Card>
      ))}
      <Button onPress={() => navigate('upload')} className="mt-2">Upload PDF</Button>
    </ScreenContainer>
  );
};

export const CourseDetailScreen = () => {
  const { currentParams, navigate } = useAppContext();
  const [analysis, setAnalysis] = useState<CourseAnalysis | null>(null);
  const groupId = currentParams.groupId || 'g1';
  useEffect(() => {
    api.analyzeCourse(groupId).then(setAnalysis);
  }, [groupId]);

  if (!analysis) {
    return (
      <ScreenContainer title="Course Detail">
        <Text>Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Course Detail" subtitle="Overview of overlap and pacing">
      <Card variant="holo">
        <Row spaced className="items-center mb-3">
          <View>
            <Text style={styles.cardTitle}>Total Words</Text>
            <Text style={styles.heroNumber}>{analysis.totalWords}</Text>
          </View>
          <View>
            <Text style={styles.cardTitle}>Known</Text>
            <Text style={styles.heroNumber}>{analysis.knownWords}</Text>
          </View>
          <View>
            <Text style={styles.cardTitle}>New</Text>
            <Text style={styles.heroNumber}>{analysis.newWords}</Text>
          </View>
        </Row>
        <Divider />
        <Row spaced className="items-center">
          <StatPill label="Days" value={`${analysis.estimatedDays}`} />
          <StatPill label="Similarity" value={`${analysis.similarity}%`} />
        </Row>
        <Button onPress={() => navigate('reading_setup')} style={{ marginTop: 12 }}>
          Start studying
        </Button>
      </Card>
    </ScreenContainer>
  );
};

export const UploadScreen = () => {
  return (
    <ScreenContainer title="Upload Document" subtitle="Mocked upload entry point">
      <Card>
        <Text style={styles.cardTitle}>Upload disabled</Text>
        <Text style={styles.miniLabel}>API center returns mock data; no network calls.</Text>
      </Card>
    </ScreenContainer>
  );
};

export const DictionaryScreen = () => {
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    api.getWordsForGroup('g1').then(setWords);
  }, []);
  return (
    <ScreenContainer title="Dictionary" subtitle="Lookup words quickly">
      <WordList words={words.slice(0, 6)} />
    </ScreenContainer>
  );
};

export const LeaderboardScreen = () => {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  useEffect(() => {
    api.getLeaderboard().then(setLeaders);
  }, []);
  return (
    <ScreenContainer title="Leaderboard" subtitle="Friendly competition">
      {leaders.map(l => (
        <Card key={l.rank} variant="holo" className="bg-white/90">
          <Row spaced className="items-center">
            <Row className="items-center">
              <Text style={styles.rank}>{l.rank}</Text>
              <Avatar uri={l.avatar} size={44} />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.cardTitle}>{l.name}</Text>
                <Text style={styles.miniLabel}>{l.xp} XP</Text>
              </View>
            </Row>
            {l.isCurrentUser && <Tag>You</Tag>}
          </Row>
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const ReviewDashboardScreen = () => {
  const [stats, setStats] = useState<RetentionStat[]>([]);
  useEffect(() => {
    api.getRetentionStats().then(setStats);
  }, []);
  return (
    <ScreenContainer title="Review Center" subtitle="Mastery breakdown">
      {stats.map(s => (
        <Card key={s.level} style={{ borderColor: s.color + '55' }} className="bg-white/90">
          <Row spaced className="items-center">
            <Text style={styles.cardTitle}>{s.level}</Text>
            <Tag>{s.count} items</Tag>
          </Row>
          <ProgressBar percent={s.percentage} color={s.color} />
        </Card>
      ))}
      <SectionTitle>Achievements</SectionTitle>
      {MOCK_ACHIEVEMENTS.map(a => (
        <Card key={a.id} className="bg-white/90">
          <Row spaced>
            <Text style={styles.emoji}>{a.icon}</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.cardTitle}>{a.name}</Text>
              <Text style={styles.miniLabel}>{a.description}</Text>
              <ProgressBar percent={(a.progress / a.maxProgress) * 100} />
            </View>
            {a.unlocked && <Tag>Unlocked</Tag>}
          </Row>
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const QuizRunScreen = () => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    api.getQuizSession().then(setQuestions);
  }, []);
  const current = questions[index];
  return (
    <ScreenContainer title="Quiz" subtitle="Gamified test flow">
      {current ? (
        <Card className="bg-white/90">
          <Text style={styles.cardTitle} className="text-slate-900">{current.question}</Text>
          {current.options.map(o => (
            <Button
              key={o.id}
              variant="secondary"
              style={{ marginTop: 8 }}
              onPress={() => setIndex(i => Math.min(i + 1, questions.length - 1))}>
              {o.text}
            </Button>
          ))}
          <Text style={styles.miniLabel}>Question {index + 1}/{questions.length}</Text>
        </Card>
      ) : (
        <Text>Loading...</Text>
      )}
    </ScreenContainer>
  );
};

export const ListeningPlayerScreen = () => {
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    api.getWordsForGroup('g1').then(setWords);
  }, []);
  return (
    <ScreenContainer title="Listening" subtitle="Passive audio loop">
      {words.slice(0, 4).map(w => (
        <Card key={w.id} className="bg-white/90">
          <Text style={styles.cardTitle}>{w.text}</Text>
          <Text style={styles.miniLabel}>{w.phonetic}</Text>
          <Text style={styles.wordDefinition}>{w.definition}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const WordDetailScreen = () => {
  const { currentParams } = useAppContext();
  const [word, setWord] = useState<Word | null>(null);
  useEffect(() => {
    api.getWordDetail(currentParams.wordId || 'w1').then(setWord);
  }, [currentParams.wordId]);
  if (!word) return null;
  return (
    <ScreenContainer title={word.text} subtitle={word.phonetic}>
      <Card className="bg-white/90">
        <Text style={styles.cardTitle}>{word.translation}</Text>
        <Text style={styles.wordDefinition}>{word.definition}</Text>
        <Text style={styles.example}>{word.example}</Text>
        <Row className="mt-2 flex-wrap">
          {word.tags.map(t => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Row>
      </Card>
    </ScreenContainer>
  );
};

export const PlaylistScreen = () => {
  const [words, setWords] = useState<Word[]>([]);
  useEffect(() => {
    api.getWordsForGroup('g1').then(setWords);
  }, []);
  return (
    <ScreenContainer title="Smart Playlist" subtitle="Sequential playback">
      <WordList words={words.slice(0, 6)} />
    </ScreenContainer>
  );
};

export const PlaylistConfigScreen = () => {
  const { playlistSettings, updatePlaylistSettings } = useAppContext();
  return (
    <ScreenContainer title="Playlist Config" subtitle="Fine-tune playback">
      <Card>
        <Text style={styles.label}>Playback speed</Text>
        <TextInput
          style={styles.input}
          value={String(playlistSettings.playbackSpeed)}
          onChangeText={v => updatePlaylistSettings({ playbackSpeed: Number(v) || 1 })}
          keyboardType="numeric"
        />
        <Text style={styles.label}>Instant review every</Text>
        <TextInput
          style={styles.input}
          value={String(playlistSettings.instantReviewInterval)}
          onChangeText={v => updatePlaylistSettings({ instantReviewInterval: Number(v) || 0 })}
          keyboardType="numeric"
        />
      </Card>
    </ScreenContainer>
  );
};

export const FriendsScreen = () => {
  const [friends, setFriends] = useState(MOCK_FRIENDS);
  useEffect(() => {
    api.getFriends().then(setFriends);
  }, []);
  return (
    <ScreenContainer title="Friends" subtitle="Keep each other accountable">
      {friends.map(f => (
        <Card key={f.id} className="bg-white/90">
          <Row spaced className="items-center">
            <Row className="items-center">
              <Avatar uri={f.avatar} size={44} />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.cardTitle}>{f.name}</Text>
                <Text style={styles.miniLabel}>{f.status} · {f.lastActive}</Text>
              </View>
            </Row>
            <Tag>{f.streak} 🔥</Tag>
          </Row>
        </Card>
      ))}
    </ScreenContainer>
  );
};

export const HistoryScreen = () => {
  const [activities, setActivities] = useState(MOCK_ACTIVITIES);
  useEffect(() => {
    api.getActivities().then(setActivities);
  }, []);
  return (
    <ScreenContainer title="History" subtitle="Recent activity stream">
      {activities.map(a => (
        <Card key={a.id} className="bg-white/90">
          <Row spaced className="items-center">
            <Row className="items-center">
              <Avatar uri={a.userAvatar} size={44} />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.cardTitle}>{a.userName}</Text>
                <Text style={styles.miniLabel}>{a.action}</Text>
              </View>
            </Row>
            <Tag>{a.time}</Tag>
          </Row>
        </Card>
      ))}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentInner: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginTop: 4,
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    ...shadow.card,
  },
  heroKicker: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#cbd5e1',
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
  },
  heroSub: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  heroAvatarWrap: {
    borderRadius: 20,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroStats: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStatLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  smallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  heroText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
  },
  avatarCard: {
    padding: 8,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeGroupCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupIconSmall: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  groupIconText: {
    fontSize: 22,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    color: '#bfdbfe',
    marginTop: 4,
  },
  squareCard: {
    flex: 1,
    marginRight: 8,
    minHeight: 150,
  },
  squareIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  squareIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
  },
  miniLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  fabCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: 20,
    color: '#2563eb',
    fontWeight: '800',
  },
  progressCard: {
    flex: 1,
    marginRight: 8,
  },
  emoji: {
    fontSize: 32,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  wordCard: {
    marginBottom: 12,
  },
  wordTranslation: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 6,
  },
  wordDefinition: {
    color: '#475569',
    marginTop: 4,
  },
  example: {
    marginTop: 6,
    color: '#0f172a',
    fontStyle: 'italic',
  },
  heroNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  rank: {
    fontSize: 18,
    fontWeight: '900',
    marginRight: 10,
    color: '#2563eb',
  },
});
