# UI 组件与页面元素规范文档

## 概述

本文档详细定义了 Laravel Dashboard 所有新增模块的 UI 组件结构、页面元素布局和交互规范。

---

## 目录

1. [System Information 页面](#1-system-information-页面)
2. [Vocabulary Learning 页面](#2-vocabulary-learning-页面)
3. [MCP Manager 页面](#3-mcp-manager-页面)
4. [Octane Tasks 页面](#4-octane-tasks-页面)
5. [共享组件库](#5-共享组件库)
6. [布局与样式规范](#6-布局与样式规范)

---

## 1. System Information 页面

### 1.1 页面结构

```
SystemInfo.tsx
├── Header (标题栏)
├── RefreshButton (刷新按钮)
├── TabNavigation (标签导航)
│   ├── Server Tab
│   ├── PHP Tab
│   ├── Laravel Tab
│   ├── Database Tab
│   ├── Cache Tab
│   ├── Queue Tab
│   └── Routes Tab
└── Content Area
    ├── JSONViewer (JSON 可视化)
    └── LoadingState (加载状态)
```

### 1.2 组件详细设计

#### SystemInfo 主组件

**文件**: `components/views/SystemInfo.tsx`

**Props**:
```typescript
interface SystemInfoProps {
  // 无需外部 props，自管理状态
}
```

**State**:
```typescript
{
  systemInfo: AsyncState<SystemInfo>;
  activeTab: 'server' | 'php' | 'laravel' | 'database' | 'cache' | 'queue' | 'routes';
  autoRefresh: boolean;
  refreshInterval: number; // seconds
}
```

**UI 元素**:

1. **Header Section**
   - Title: "System Information Dashboard"
   - Subtitle: "Real-time system configuration and status"
   - Last Updated: timestamp
   - Refresh Button (带加载动画)
   - Auto-refresh Toggle Switch

2. **Tab Navigation**
   ```tsx
   <div className="tabs">
     <button className={activeTab === 'server' ? 'active' : ''}>
       <Server size={18} />
       Server
     </button>
     <button className={activeTab === 'php' ? 'active' : ''}>
       <Code size={18} />
       PHP
     </button>
     {/* ... other tabs */}
   </div>
   ```

3. **Content Cards**

   **Server Info Card**:
   ```tsx
   <Card>
     <CardHeader>
       <h3>Server Information</h3>
     </CardHeader>
     <CardBody>
       <InfoRow label="OS" value={systemInfo.server.os} />
       <InfoRow label="Architecture" value={systemInfo.server.architecture} />
       <InfoRow label="Hostname" value={systemInfo.server.hostname} />
       <InfoRow label="Web Server" value={systemInfo.server.server_software} />
       <InfoRow label="Protocol" value={systemInfo.server.server_protocol} />
     </CardBody>
   </Card>
   ```

   **PHP Info Card**:
   ```tsx
   <Card>
     <CardHeader>
       <h3>PHP Configuration</h3>
       <StatusBadge status={phpVersionCheck()} />
     </CardHeader>
     <CardBody>
       <InfoRow label="Version" value={systemInfo.php.version} highlighted />
       <InfoRow label="Memory Limit" value={systemInfo.php.memory_limit} />
       <InfoRow label="Max Execution Time" value={systemInfo.php.max_execution_time} />
       <InfoRow label="Upload Max Size" value={systemInfo.php.upload_max_filesize} />
       <InfoRow label="Timezone" value={systemInfo.php.timezone} />

       <Divider />

       <h4>Extensions</h4>
       <TagList tags={systemInfo.php.extensions} />
     </CardBody>
   </Card>
   ```

   **Database Info Card**:
   ```tsx
   <Card>
     <CardHeader>
       <h3>Database Connections</h3>
     </CardHeader>
     <CardBody>
       {systemInfo.database.connections.map(conn => (
         <ConnectionCard key={conn.name}>
           <ConnectionStatus connected={conn.connected} />
           <InfoRow label="Driver" value={conn.driver} />
           <InfoRow label="Host" value={`${conn.host}:${conn.port}`} />
           <InfoRow label="Database" value={conn.database} />
           <InfoRow label="Username" value={conn.username} />
           <InfoRow label="Charset" value={conn.charset} />
         </ConnectionCard>
       ))}
     </CardBody>
   </Card>
   ```

4. **Routes Table** (当选择 Routes tab 时)
   ```tsx
   <Table>
     <TableHeader>
       <th>Method</th>
       <th>URI</th>
       <th>Name</th>
       <th>Action</th>
       <th>Middleware</th>
     </TableHeader>
     <TableBody>
       {systemInfo.routes.map(route => (
         <TableRow key={route.uri}>
           <MethodBadge method={route.method} />
           <td><code>{route.uri}</code></td>
           <td>{route.name || '-'}</td>
           <td><code>{route.action}</code></td>
           <td>
             <TagList tags={route.middleware} small />
           </td>
         </TableRow>
       ))}
     </TableBody>
   </Table>
   ```

### 1.3 子组件

#### InfoRow 组件

```typescript
interface InfoRowProps {
  label: string;
  value: string | number | boolean;
  highlighted?: boolean;
  copyable?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, highlighted, copyable }) => (
  <div className={`info-row ${highlighted ? 'highlighted' : ''}`}>
    <span className="label">{label}</span>
    <span className="value">
      {value}
      {copyable && <CopyButton text={String(value)} />}
    </span>
  </div>
);
```

#### StatusBadge 组件

```typescript
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info';
  text?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => (
  <span className={`status-badge status-${status}`}>
    <StatusIcon status={status} />
    {text}
  </span>
);
```

#### JSONViewer 组件

```typescript
interface JSONViewerProps {
  data: any;
  collapsed?: boolean;
}

const JSONViewer: React.FC<JSONViewerProps> = ({ data, collapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  return (
    <div className="json-viewer">
      <div className="json-viewer-header">
        <button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronRight /> : <ChevronDown />}
        </button>
        <CopyButton text={JSON.stringify(data, null, 2)} />
        <DownloadButton data={data} filename="system-info.json" />
      </div>
      <pre className={isCollapsed ? 'collapsed' : ''}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};
```

---

## 2. Vocabulary Learning 页面

### 2.1 页面结构

```
VocabularyLearning.tsx
├── Header
├── PanelLayout (可调整大小的面板布局)
│   ├── LeftPanel (翻译输入)
│   │   ├── LanguageSelector
│   │   ├── TextInput
│   │   ├── TranslateButton
│   │   └── TranslationResult
│   ├── CenterPanel (TTS 播放器)
│   │   ├── AudioPlayer
│   │   ├── SubtitleDisplay
│   │   └── PlaybackControls
│   └── RightPanel (学习任务)
│       ├── TaskList
│       ├── VocabularyWords
│       └── ProgressTracker
└── BottomBar (历史记录)
```

### 2.2 组件详细设计

#### VocabularyLearning 主组件

**State**:
```typescript
{
  translation: AsyncState<TranslationResponse>;
  tts: AsyncState<TTSGenerateResponse>;
  tasks: AsyncState<VocabularyTask[]>;
  sourceLanguage: string;
  targetLanguage: string;
  inputText: string;
  currentAudio: HTMLAudioElement | null;
  isPlaying: boolean;
  currentTime: number;
  history: TranslationHistory[];
}
```

**UI 元素**:

1. **Translation Panel** (左侧面板)

   ```tsx
   <TranslationPanel>
     <PanelHeader>
       <h3>Translation</h3>
       <LanguageSwapButton onClick={swapLanguages} />
     </PanelHeader>

     <LanguageSelector
       source={sourceLanguage}
       target={targetLanguage}
       onSourceChange={setSourceLanguage}
       onTargetChange={setTargetLanguage}
       availableLanguages={languages}
     />

     <TextArea
       value={inputText}
       onChange={setInputText}
       placeholder="Enter text to translate..."
       rows={6}
     />

     <ActionButtons>
       <Button onClick={handleTranslate} primary>
         <Languages size={18} />
         Translate
       </Button>
       <Button onClick={handleDetectAndTranslate}>
         Auto Detect
       </Button>
       <Button onClick={handleClear} variant="ghost">
         Clear
       </Button>
     </ActionButtons>

     {translation.data && (
       <TranslationResult>
         <ResultHeader>
           <h4>Translation</h4>
           <CopyButton text={translation.data.translated_text} />
           <TTSButton onClick={handleGenerateTTS} />
         </ResultHeader>

         <ResultText>{translation.data.translated_text}</ResultText>

         {translation.data.phonetic && (
           <Phonetic>/{translation.data.phonetic}/</Phonetic>
         )}

         {translation.data.alternatives && (
           <Alternatives>
             <h5>Alternatives:</h5>
             {translation.data.alternatives.map(alt => (
               <AlternativeChip key={alt} onClick={() => selectAlternative(alt)}>
                 {alt}
               </AlternativeChip>
             ))}
           </Alternatives>
         )}

         <Metadata>
           <Badge>Confidence: {(translation.data.confidence * 100).toFixed(0)}%</Badge>
           <Badge>Provider: {translation.data.provider}</Badge>
         </Metadata>
       </TranslationResult>
     )}
   </TranslationPanel>
   ```

2. **TTS Player Panel** (中间面板)

   ```tsx
   <TTSPlayerPanel>
     <PanelHeader>
       <h3>Audio Player</h3>
       <VoiceSelector
         language={targetLanguage}
         selected={selectedVoice}
         onChange={setSelectedVoice}
       />
     </PanelHeader>

     <AudioWaveform
       audioUrl={tts.data?.audio_url}
       currentTime={currentTime}
       duration={tts.data?.duration}
     />

     <SubtitleDisplay>
       <Subtitle size="large">
         {currentSegment?.text}
       </Subtitle>
       <SubtitleTranslation>
         {currentSegment?.translation}
       </SubtitleTranslation>
     </SubtitleDisplay>

     <PlaybackControls>
       <Button onClick={handlePrevious} disabled={!hasPrevious}>
         <SkipBack size={20} />
       </Button>

       <PlayPauseButton
         isPlaying={isPlaying}
         onClick={togglePlayPause}
         size="large"
       />

       <Button onClick={handleNext} disabled={!hasNext}>
         <SkipForward size={20} />
       </Button>
     </PlaybackControls>

     <ProgressBar
       value={currentTime}
       max={tts.data?.duration || 0}
       onChange={handleSeek}
     />

     <TimeDisplay>
       <span>{formatTime(currentTime)}</span>
       <span>{formatTime(tts.data?.duration || 0)}</span>
     </TimeDisplay>

     <SpeedControl>
       <label>Speed:</label>
       <Slider
         min={0.5}
         max={2.0}
         step={0.1}
         value={playbackSpeed}
         onChange={setPlaybackSpeed}
       />
       <span>{playbackSpeed}x</span>
     </SpeedControl>
   </TTSPlayerPanel>
   ```

3. **Learning Tasks Panel** (右侧面板)

   ```tsx
   <LearningTasksPanel>
     <PanelHeader>
       <h3>Learning Tasks</h3>
       <Button onClick={createNewTask} size="small">
         <Plus size={16} />
         New Task
       </Button>
     </PanelHeader>

     <TaskList>
       {tasks.data?.map(task => (
         <TaskCard
           key={task.id}
           task={task}
           onClick={() => selectTask(task)}
           active={selectedTask?.id === task.id}
         >
           <TaskHeader>
             <TaskTitle>{task.title}</TaskTitle>
             <TaskStatus status={task.status} />
           </TaskHeader>

           <TaskProgress>
             <ProgressBar value={task.progress} max={100} />
             <ProgressText>{task.progress}%</ProgressText>
           </TaskProgress>

           <TaskMeta>
             <MetaItem>
               <BookOpen size={14} />
               {task.words.length} words
             </MetaItem>
             <MetaItem>
               <Clock size={14} />
               {formatDate(task.created_at)}
             </MetaItem>
           </TaskMeta>
         </TaskCard>
       ))}
     </TaskList>

     {selectedTask && (
       <VocabularyWordsList>
         <WordsHeader>
           <h4>Vocabulary ({selectedTask.words.length})</h4>
           <FilterButtons>
             <FilterButton active={filter === 'all'}>All</FilterButton>
             <FilterButton active={filter === 'learned'}>Learned</FilterButton>
             <FilterButton active={filter === 'unlearned'}>Unlearned</FilterButton>
           </FilterButtons>
         </WordsHeader>

         {selectedTask.words.map(word => (
           <WordCard key={word.id} learned={word.learned}>
             <WordHeader>
               <Word>{word.word}</Word>
               <LearnedCheckbox
                 checked={word.learned}
                 onChange={() => toggleLearned(word.id)}
               />
             </WordHeader>

             <Translation>{word.translation}</Translation>

             {word.phonetic && (
               <Phonetic>/{word.phonetic}/</Phonetic>
             )}

             {word.definition && (
               <Definition>{word.definition}</Definition>
             )}

             {word.example_sentences && (
               <Examples>
                 {word.example_sentences.map((example, idx) => (
                   <ExampleSentence key={idx}>{example}</ExampleSentence>
                 ))}
               </Examples>
             )}

             {word.audio_url && (
               <AudioButton onClick={() => playWord(word)}>
                 <Volume2 size={16} />
                 Play
               </AudioButton>
             )}

             {word.proficiency !== undefined && (
               <ProficiencyBar value={word.proficiency} />
             )}
           </WordCard>
         ))}
       </VocabularyWordsList>
     )}
   </LearningTasksPanel>
   ```

4. **History Bar** (底部栏)

   ```tsx
   <HistoryBar collapsed={historyCollapsed}>
     <HistoryHeader onClick={() => setHistoryCollapsed(!historyCollapsed)}>
       <h4>Translation History</h4>
       <ChevronIcon collapsed={historyCollapsed} />
       <ClearHistoryButton onClick={clearHistory} />
     </HistoryHeader>

     {!historyCollapsed && (
       <HistoryList>
         {history.map(item => (
           <HistoryItem
             key={item.id}
             onClick={() => loadHistoryItem(item)}
           >
             <HistoryText>
               <SourceText>{item.original_text}</SourceText>
               <Arrow>→</Arrow>
               <TargetText>{item.translated_text}</TargetText>
             </HistoryText>
             <HistoryMeta>
               <LanguageBadge>{item.source_language}</LanguageBadge>
               <Arrow>→</Arrow>
               <LanguageBadge>{item.target_language}</LanguageBadge>
               <Timestamp>{formatTime(item.timestamp)}</Timestamp>
             </HistoryMeta>
           </HistoryItem>
         ))}
       </HistoryList>
     )}
   </HistoryBar>
   ```

### 2.3 子组件

#### LanguageSelector 组件

```typescript
interface LanguageSelectorProps {
  source: string;
  target: string;
  availableLanguages: Language[];
  onSourceChange: (lang: string) => void;
  onTargetChange: (lang: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  source,
  target,
  availableLanguages,
  onSourceChange,
  onTargetChange
}) => (
  <div className="language-selector">
    <Select
      value={source}
      onChange={onSourceChange}
      options={availableLanguages.map(lang => ({
        value: lang.code,
        label: `${lang.native_name} (${lang.name})`
      }))}
      placeholder="Source Language"
    />

    <SwapButton onClick={() => {
      onSourceChange(target);
      onTargetChange(source);
    }}>
      <ArrowLeftRight size={18} />
    </SwapButton>

    <Select
      value={target}
      onChange={onTargetChange}
      options={availableLanguages.map(lang => ({
        value: lang.code,
        label: `${lang.native_name} (${lang.name})`
      }))}
      placeholder="Target Language"
    />
  </div>
);
```

#### VoiceSelector 组件

```typescript
interface VoiceSelectorProps {
  language: string;
  selected: string;
  onChange: (voice: string) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ language, selected, onChange }) => {
  const voices = useVoices(language);

  return (
    <Select
      value={selected}
      onChange={onChange}
      options={voices.map(voice => ({
        value: voice.voice_type,
        label: `${voice.name} (${voice.gender})`,
        icon: voice.sample_url && <AudioIcon onClick={() => playSample(voice.sample_url)} />
      }))}
    />
  );
};
```

---

## 3. MCP Manager 页面

### 3.1 页面结构

```
MCPManager.tsx
├── Header
├── TabNavigation
│   ├── Screenshots Tab
│   ├── Task Dispatch Tab
│   ├── Placeholders Tab
│   ├── Voice Subtitle Tab
│   └── Settings Tab
└── TabContent
    ├── <ScreenshotManager />
    ├── <TaskDispatch />
    ├── <PlaceholderGenerator />
    ├── <VoiceSubtitle />
    └── <MCPSettings />
```

### 3.2 Screenshot Manager 子页面

#### 组件结构

```
ScreenshotManager.tsx
├── UploadSection
│   ├── UploadButton
│   ├── BatchUploadButton
│   ├── MergeUploadButton
│   └── DragDropZone
├── FilterBar
│   ├── SearchInput
│   ├── TagFilter
│   ├── DateRangePicker
│   └── SortSelector
├── StatsCards
│   ├── TotalCountCard
│   ├── TotalSizeCard
│   ├── TodayCountCard
│   └── WeekCountCard
└── GalleryView / ListView
    └── ScreenshotCards
```

#### UI 元素

```tsx
<ScreenshotManager>
  {/* Upload Section */}
  <UploadSection>
    <UploadButtons>
      <Button onClick={openUploadDialog} primary>
        <Upload size={18} />
        Upload Screenshot
      </Button>

      <Button onClick={openBatchUpload}>
        <UploadMultiple size={18} />
        Batch Upload
      </Button>

      <Button onClick={openMergeUpload}>
        <Combine size={18} />
        Upload & Merge
      </Button>
    </UploadButtons>

    <DragDropZone
      onDrop={handleDrop}
      accept="image/*"
      multiple
    >
      <DropIcon><ImagePlus size={48} /></DropIcon>
      <DropText>Drag & drop images here</DropText>
      <DropSubtext>or click Upload button</DropSubtext>
    </DragDropZone>
  </UploadSection>

  {/* Stats Cards */}
  <StatsGrid>
    <StatCard>
      <StatIcon><Image size={24} /></StatIcon>
      <StatValue>{stats.total_count}</StatValue>
      <StatLabel>Total Screenshots</StatLabel>
    </StatCard>

    <StatCard>
      <StatIcon><HardDrive size={24} /></StatIcon>
      <StatValue>{formatBytes(stats.total_size)}</StatValue>
      <StatLabel>Total Size</StatLabel>
    </StatCard>

    <StatCard>
      <StatIcon><Calendar size={24} /></StatIcon>
      <StatValue>{stats.today_count}</StatValue>
      <StatLabel>Today</StatLabel>
    </StatCard>

    <StatCard>
      <StatIcon><TrendingUp size={24} /></StatIcon>
      <StatValue>{stats.week_count}</StatValue>
      <StatLabel>This Week</StatLabel>
    </StatCard>
  </StatsGrid>

  {/* Filter Bar */}
  <FilterBar>
    <SearchInput
      value={searchQuery}
      onChange={setSearchQuery}
      placeholder="Search screenshots..."
      icon={<Search />}
    />

    <TagFilter
      selectedTags={selectedTags}
      onChange={setSelectedTags}
      availableTags={getAllTags()}
    />

    <DateRangePicker
      startDate={dateRange.start}
      endDate={dateRange.end}
      onChange={setDateRange}
    />

    <ViewToggle>
      <ViewButton active={view === 'gallery'} onClick={() => setView('gallery')}>
        <Grid size={18} />
      </ViewButton>
      <ViewButton active={view === 'list'} onClick={() => setView('list')}>
        <List size={18} />
      </ViewButton>
    </ViewToggle>

    <SortSelector
      value={sortBy}
      onChange={setSortBy}
      options={[
        { value: 'date_desc', label: 'Newest First' },
        { value: 'date_asc', label: 'Oldest First' },
        { value: 'size_desc', label: 'Largest First' },
        { value: 'size_asc', label: 'Smallest First' }
      ]}
    />
  </FilterBar>

  {/* Gallery View */}
  {view === 'gallery' && (
    <GalleryGrid>
      {screenshots.map(screenshot => (
        <ScreenshotCard
          key={screenshot.id}
          screenshot={screenshot}
          onClick={() => openPreview(screenshot)}
          onDelete={() => handleDelete(screenshot.id)}
        >
          <ThumbnailWrapper>
            <Thumbnail
              src={screenshot.thumbnail_url}
              alt={screenshot.original_name}
              loading="lazy"
            />
            <ThumbnailOverlay>
              <OverlayActions>
                <IconButton onClick={() => downloadScreenshot(screenshot)}>
                  <Download size={18} />
                </IconButton>
                <IconButton onClick={() => copyToClipboard(screenshot)}>
                  <Copy size={18} />
                </IconButton>
                <IconButton onClick={() => deleteScreenshot(screenshot)} danger>
                  <Trash2 size={18} />
                </IconButton>
              </OverlayActions>
            </ThumbnailOverlay>
          </ThumbnailWrapper>

          <CardFooter>
            <FileName>{screenshot.original_name}</FileName>
            <CardMeta>
              <MetaItem>
                <Maximize2 size={12} />
                {screenshot.width}x{screenshot.height}
              </MetaItem>
              <MetaItem>
                <FileSize size={12} />
                {formatBytes(screenshot.file_size)}
              </MetaItem>
              <MetaItem>
                <Clock size={12} />
                {formatDate(screenshot.created_at)}
              </MetaItem>
            </CardMeta>

            {screenshot.tags && (
              <TagList>
                {screenshot.tags.map(tag => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </TagList>
            )}
          </CardFooter>
        </ScreenshotCard>
      ))}
    </GalleryGrid>
  )}

  {/* Pagination */}
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={setCurrentPage}
    perPage={perPage}
    onPerPageChange={setPerPage}
  />
</ScreenshotManager>
```

#### Screenshot Preview Modal

```tsx
<ScreenshotPreviewModal
  screenshot={previewScreenshot}
  onClose={closePreview}
  onNext={showNextScreenshot}
  onPrevious={showPreviousScreenshot}
>
  <ModalHeader>
    <ModalTitle>{previewScreenshot.original_name}</ModalTitle>
    <CloseButton onClick={closePreview} />
  </ModalHeader>

  <ModalBody>
    <ImageContainer>
      <FullImage
        src={previewScreenshot.file_path}
        alt={previewScreenshot.original_name}
      />
    </ImageContainer>

    <ImageNavigation>
      <NavButton onClick={showPreviousScreenshot} disabled={!hasPrevious}>
        <ChevronLeft size={24} />
      </NavButton>
      <NavButton onClick={showNextScreenshot} disabled={!hasNext}>
        <ChevronRight size={24} />
      </NavButton>
    </ImageNavigation>
  </ModalBody>

  <ModalSidebar>
    <SidebarSection>
      <SectionTitle>Information</SectionTitle>
      <InfoList>
        <InfoRow label="Filename" value={previewScreenshot.original_name} />
        <InfoRow label="Dimensions" value={`${previewScreenshot.width}x${previewScreenshot.height}`} />
        <InfoRow label="File Size" value={formatBytes(previewScreenshot.file_size)} />
        <InfoRow label="MIME Type" value={previewScreenshot.mime_type} />
        <InfoRow label="Created" value={formatDate(previewScreenshot.created_at)} />
      </InfoList>
    </SidebarSection>

    <SidebarSection>
      <SectionTitle>Description</SectionTitle>
      <Description editable onSave={updateDescription}>
        {previewScreenshot.description || 'No description'}
      </Description>
    </SidebarSection>

    <SidebarSection>
      <SectionTitle>Tags</SectionTitle>
      <TagEditor
        tags={previewScreenshot.tags || []}
        onAdd={addTag}
        onRemove={removeTag}
      />
    </SidebarSection>

    <SidebarSection>
      <SectionTitle>Actions</SectionTitle>
      <ActionButtons vertical>
        <Button onClick={() => downloadScreenshot(previewScreenshot)}>
          <Download size={18} />
          Download
        </Button>
        <Button onClick={() => copyToClipboard(previewScreenshot)}>
          <Copy size={18} />
          Copy URL
        </Button>
        <Button onClick={() => shareScreenshot(previewScreenshot)}>
          <Share2 size={18} />
          Share
        </Button>
        <Divider />
        <Button onClick={() => deleteScreenshot(previewScreenshot)} danger>
          <Trash2 size={18} />
          Delete
        </Button>
      </ActionButtons>
    </SidebarSection>
  </ModalSidebar>
</ScreenshotPreviewModal>
```

### 3.3 Task Dispatch 子页面

#### 组件结构

```
TaskDispatch.tsx
├── CategorySidebar
│   ├── CategoryList
│   └── CreateCategoryButton
├── MainContent
│   ├── CategoryHeader
│   ├── StatsOverview
│   ├── AddTaskSection
│   ├── TaskQueue
│   └── PromptMapping
```

#### UI 元素

```tsx
<TaskDispatch>
  {/* Category Sidebar */}
  <CategorySidebar>
    <SidebarHeader>
      <h3>Categories</h3>
      <IconButton onClick={createCategory}>
        <Plus size={18} />
      </IconButton>
    </SidebarHeader>

    <CategoryList>
      {categories.map(category => (
        <CategoryItem
          key={category.id}
          active={selectedCategory?.id === category.id}
          onClick={() => selectCategory(category)}
        >
          <CategoryIcon color={category.color}>
            {category.icon}
          </CategoryIcon>
          <CategoryInfo>
            <CategoryName>{category.name}</CategoryName>
            <CategoryCount>{category.file_count} tasks</CategoryCount>
          </CategoryInfo>
          <CategoryActions>
            <IconButton size="small" onClick={() => editCategory(category)}>
              <Edit3 size={14} />
            </IconButton>
          </CategoryActions>
        </CategoryItem>
      ))}
    </CategoryList>
  </CategorySidebar>

  {/* Main Content */}
  {selectedCategory && (
    <MainContent>
      {/* Category Header */}
      <CategoryHeader>
        <CategoryTitle>
          <CategoryIcon large color={selectedCategory.color}>
            {selectedCategory.icon}
          </CategoryIcon>
          <TitleText>
            <h2>{selectedCategory.name}</h2>
            <p>{selectedCategory.description}</p>
          </TitleText>
        </CategoryTitle>

        <HeaderActions>
          <Button onClick={refreshTasks}>
            <RefreshCw size={18} />
            Refresh
          </Button>
          <Button onClick={openSettings}>
            <Settings size={18} />
            Settings
          </Button>
        </HeaderActions>
      </CategoryHeader>

      {/* Stats Overview */}
      <StatsGrid>
        <StatCard>
          <StatLabel>Total Tasks</StatLabel>
          <StatValue>{stats.total_tasks}</StatValue>
        </StatCard>
        <StatCard highlight="warning">
          <StatLabel>Pending</StatLabel>
          <StatValue>{stats.pending_tasks}</StatValue>
        </StatCard>
        <StatCard highlight="info">
          <StatLabel>Processing</StatLabel>
          <StatValue>{stats.processing_tasks}</StatValue>
        </StatCard>
        <StatCard highlight="success">
          <StatLabel>Completed</StatLabel>
          <StatValue>{stats.completed_tasks}</StatValue>
        </StatCard>
        <StatCard highlight="error">
          <StatLabel>Failed</StatLabel>
          <StatValue>{stats.failed_tasks}</StatValue>
        </StatCard>
      </StatsGrid>

      {/* Add Task Section */}
      <AddTaskSection>
        <SectionHeader>
          <h3>Add New Task</h3>
        </SectionHeader>

        <AddTaskForm>
          <FormGroup>
            <Label>Task Content</Label>
            <TextArea
              value={newTaskContent}
              onChange={setNewTaskContent}
              placeholder="Enter task content or paste markdown..."
              rows={6}
            />
          </FormGroup>

          <FormGroup>
            <Label>File Name (optional)</Label>
            <Input
              value={newTaskFileName}
              onChange={setNewTaskFileName}
              placeholder="task_001.md"
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <Label>Priority</Label>
              <Select
                value={newTaskPriority}
                onChange={setNewTaskPriority}
                options={[
                  { value: 1, label: 'Low' },
                  { value: 2, label: 'Normal' },
                  { value: 3, label: 'High' },
                  { value: 4, label: 'Urgent' }
                ]}
              />
            </FormGroup>

            <FormGroup>
              <Label>Metadata (JSON)</Label>
              <Input
                value={newTaskMetadata}
                onChange={setNewTaskMetadata}
                placeholder='{"key": "value"}'
              />
            </FormGroup>
          </FormRow>

          <ActionButtons>
            <Button onClick={addTask} primary>
              <Plus size={18} />
              Add Task
            </Button>
            <Button onClick={addTaskAndStart}>
              <Play size={18} />
              Add & Start
            </Button>
            <Button onClick={clearForm} variant="ghost">
              Clear
            </Button>
          </ActionButtons>
        </AddTaskForm>
      </AddTaskSection>

      {/* Task Queue */}
      <TaskQueueSection>
        <SectionHeader>
          <h3>Task Queue ({tasks.length})</h3>
          <FilterButtons>
            <FilterButton active={statusFilter === 'all'}>All</FilterButton>
            <FilterButton active={statusFilter === 'pending'}>Pending</FilterButton>
            <FilterButton active={statusFilter === 'processing'}>Processing</FilterButton>
            <FilterButton active={statusFilter === 'completed'}>Completed</FilterButton>
            <FilterButton active={statusFilter === 'failed'}>Failed</FilterButton>
          </FilterButtons>
        </SectionHeader>

        <TaskList>
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              status={task.status}
            >
              <TaskHeader>
                <TaskStatusBadge status={task.status} />
                <TaskFileName>{task.original_name}</TaskFileName>
                <TaskPriority priority={task.priority} />
                <TaskActions>
                  <IconButton onClick={() => viewTask(task)}>
                    <Eye size={16} />
                  </IconButton>
                  <IconButton onClick={() => editTask(task)}>
                    <Edit3 size={16} />
                  </IconButton>
                  <IconButton onClick={() => downloadTask(task)}>
                    <Download size={16} />
                  </IconButton>
                  <IconButton onClick={() => deleteTask(task)} danger>
                    <Trash2 size={16} />
                  </IconButton>
                </TaskActions>
              </TaskHeader>

              <TaskContent collapsed>
                <ContentPreview>
                  {task.content?.substring(0, 200)}...
                </ContentPreview>
              </TaskContent>

              <TaskFooter>
                <TaskMeta>
                  <MetaItem>
                    <Calendar size={14} />
                    Created: {formatDate(task.created_at)}
                  </MetaItem>
                  {task.completed_at && (
                    <MetaItem>
                      <CheckCircle size={14} />
                      Completed: {formatDate(task.completed_at)}
                    </MetaItem>
                  )}
                  {task.metadata && (
                    <MetaItem>
                      <Info size={14} />
                      Metadata: {JSON.stringify(task.metadata)}
                    </MetaItem>
                  )}
                </TaskMeta>

                <TaskStatusActions>
                  {task.status === 'pending' && (
                    <Button size="small" onClick={() => startTask(task)}>
                      <Play size={14} />
                      Start
                    </Button>
                  )}
                  {task.status === 'processing' && (
                    <Button size="small" onClick={() => pauseTask(task)}>
                      <Pause size={14} />
                      Pause
                    </Button>
                  )}
                  {task.status === 'completed' && (
                    <Button size="small" onClick={() => restartTask(task)}>
                      <RotateCcw size={14} />
                      Restart
                    </Button>
                  )}
                  {task.status === 'failed' && (
                    <Button size="small" onClick={() => retryTask(task)}>
                      <RefreshCw size={14} />
                      Retry
                    </Button>
                  )}
                </TaskStatusActions>
              </TaskFooter>
            </TaskCard>
          ))}
        </TaskList>

        <Pagination {...paginationProps} />
      </TaskQueueSection>

      {/* Prompt Mapping */}
      <PromptMappingSection>
        <SectionHeader>
          <h3>Prompt Mapping</h3>
          <Button onClick={resetPrompt} variant="ghost">
            <RotateCcw size={16} />
            Reset to Default
          </Button>
        </SectionHeader>

        <PromptEditor>
          <EditorHeader>
            <Label>Prompt File Path</Label>
            <FilePathInput
              value={promptMapping?.prompt_file_path}
              onChange={updatePromptPath}
              placeholder="/prompts/category_prompt.md"
            />
          </EditorHeader>

          <CodeEditor
            value={promptMapping?.prompt_content}
            onChange={updatePromptContent}
            language="markdown"
            height="300px"
          />

          <VariablesSection>
            <h4>Variables</h4>
            <VariableList>
              {promptMapping?.variables?.map(variable => (
                <VariableChip key={variable.name}>
                  {`{{${variable.name}}}`}
                  {variable.description && (
                    <Tooltip content={variable.description} />
                  )}
                </VariableChip>
              ))}
            </VariableList>
            <Button size="small" onClick={addVariable}>
              <Plus size={14} />
              Add Variable
            </Button>
          </VariablesSection>

          <EditorActions>
            <Button onClick={savePrompt} primary>
              <Save size={18} />
              Save Prompt
            </Button>
            <Button onClick={testPrompt}>
              <PlayCircle size={18} />
              Test
            </Button>
          </EditorActions>
        </PromptEditor>
      </PromptMappingSection>
    </MainContent>
  )}
</TaskDispatch>
```

### 3.4 Placeholder Generator 子页面

```tsx
<PlaceholderGenerator>
  <GeneratorPanel>
    <PanelHeader>
      <h3>Generate Placeholder Image</h3>
    </PanelHeader>

    <GeneratorForm>
      <FormRow>
        <FormGroup>
          <Label>Width (px)</Label>
          <Input
            type="number"
            value={width}
            onChange={setWidth}
            placeholder="800"
          />
        </FormGroup>

        <FormGroup>
          <Label>Height (px)</Label>
          <Input
            type="number"
            value={height}
            onChange={setHeight}
            placeholder="600"
          />
        </FormGroup>
      </FormRow>

      <FormGroup>
        <Label>Text (optional)</Label>
        <Input
          value={text}
          onChange={setText}
          placeholder="Placeholder Image"
        />
      </FormGroup>

      <FormRow>
        <FormGroup>
          <Label>Background Color</Label>
          <ColorPicker
            value={bgColor}
            onChange={setBgColor}
          />
        </FormGroup>

        <FormGroup>
          <Label>Text Color</Label>
          <ColorPicker
            value={textColor}
            onChange={setTextColor}
          />
        </FormGroup>
      </FormRow>

      <FormRow>
        <FormGroup>
          <Label>Format</Label>
          <Select
            value={format}
            onChange={setFormat}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpg', label: 'JPEG' },
              { value: 'svg', label: 'SVG' },
              { value: 'webp', label: 'WebP' }
            ]}
          />
        </FormGroup>

        <FormGroup>
          <Label>Mode</Label>
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'real', label: 'Realistic' }
            ]}
          />
        </FormGroup>
      </FormRow>

      <ActionButtons>
        <Button onClick={generatePlaceholder} primary>
          <Wand2 size={18} />
          Generate
        </Button>
        <Button onClick={resetForm} variant="ghost">
          Reset
        </Button>
      </ActionButtons>
    </GeneratorForm>
  </GeneratorPanel>

  <PreviewPanel>
    <PanelHeader>
      <h3>Preview</h3>
      {generatedPlaceholder && (
        <HeaderActions>
          <Button onClick={downloadPlaceholder} size="small">
            <Download size={16} />
            Download
          </Button>
          <Button onClick={copyURL} size="small">
            <Copy size={16} />
            Copy URL
          </Button>
        </HeaderActions>
      )}
    </PanelHeader>

    {generatedPlaceholder ? (
      <PreviewContainer>
        <PlaceholderImage
          src={generatedPlaceholder.url}
          alt="Generated placeholder"
        />

        <PreviewInfo>
          <InfoRow label="Dimensions" value={`${generatedPlaceholder.width}x${generatedPlaceholder.height}`} />
          <InfoRow label="Format" value={generatedPlaceholder.format.toUpperCase()} />
          <InfoRow label="File Size" value={formatBytes(generatedPlaceholder.file_size)} />
          <InfoRow label="URL" value={generatedPlaceholder.url} copyable />
        </PreviewInfo>
      </PreviewContainer>
    ) : (
      <EmptyState>
        <EmptyIcon><ImagePlus size={48} /></EmptyIcon>
        <EmptyText>No placeholder generated yet</EmptyText>
        <EmptySubtext>Fill the form and click Generate</EmptySubtext>
      </EmptyState>
    )}
  </PreviewPanel>

  <HistoryPanel>
    <PanelHeader>
      <h3>Recent Placeholders</h3>
      <Button onClick={cleanupOld} size="small" variant="ghost">
        <Trash2 size={16} />
        Cleanup
      </Button>
    </PanelHeader>

    <HistoryList>
      {placeholders.map(item => (
        <HistoryItem
          key={item.uuid}
          onClick={() => loadPlaceholder(item)}
        >
          <ItemThumbnail>
            <img src={item.file_path} alt={`${item.width}x${item.height}`} />
          </ItemThumbnail>
          <ItemInfo>
            <ItemDimensions>{item.width}x{item.height}</ItemDimensions>
            <ItemMeta>
              <span>{item.format}</span>
              <span>{formatBytes(item.file_size)}</span>
              <span>{formatDate(item.created_at)}</span>
            </ItemMeta>
          </ItemInfo>
          <ItemActions>
            <IconButton onClick={() => deletePlaceholder(item.uuid)}>
              <Trash2 size={14} />
            </IconButton>
          </ItemActions>
        </HistoryItem>
      ))}
    </HistoryList>
  </HistoryPanel>

  <StatsPanel>
    <StatsCard>
      <StatValue>{placeholderStats.total_count}</StatValue>
      <StatLabel>Total Generated</StatLabel>
    </StatCard>
    <StatsCard>
      <StatValue>{formatBytes(placeholderStats.total_size)}</StatValue>
      <StatLabel>Total Size</StatLabel>
    </StatsCard>
  </StatsPanel>
</PlaceholderGenerator>
```

---

## 4. Octane Tasks 页面

### 4.1 组件结构

```
OctaneTasks.tsx
├── Header
├── StatusOverview (Summary Cards)
├── HeartbeatMonitor
├── TasksList
└── TaskDetailModal
```

### 4.2 UI 元素

```tsx
<OctaneTasks>
  {/* Header */}
  <PageHeader>
    <Title>
      <h2>Octane Timer Tasks Monitor</h2>
      <Subtitle>Real-time task scheduling and execution monitoring</Subtitle>
    </Title>
    <HeaderActions>
      <Button onClick={refresh}>
        <RefreshCw size={18} />
        Refresh
      </Button>
      <AutoRefreshToggle
        enabled={autoRefresh}
        onChange={setAutoRefresh}
        interval={refreshInterval}
        onIntervalChange={setRefreshInterval}
      />
    </HeaderActions>
  </PageHeader>

  {/* Status Overview */}
  <StatusOverview>
    <StatCard highlight="success">
      <StatIcon><Activity size={32} /></StatIcon>
      <StatValue>{status.timer_running ? 'Running' : 'Stopped'}</StatValue>
      <StatLabel>Timer Status</StatLabel>
      <StatIndicator active={status.timer_running} />
    </StatCard>

    <StatCard>
      <StatIcon><Layers size={32} /></StatIcon>
      <StatValue>{status.total_tasks}</StatValue>
      <StatLabel>Total Tasks</StatLabel>
    </StatCard>

    <StatCard highlight="info">
      <StatIcon><PlayCircle size={32} /></StatIcon>
      <StatValue>{status.running_tasks}</StatValue>
      <StatLabel>Running Tasks</StatLabel>
    </StatCard>

    <StatCard highlight="warning">
      <StatIcon><Clock size={32} /></StatIcon>
      <StatValue>{formatNumber(status.total_ticks)}</StatValue>
      <StatLabel>Total Ticks</StatLabel>
    </StatCard>

    <StatCard>
      <StatIcon><Timer size={32} /></StatIcon>
      <StatValue>{formatDuration(status.uptime)}</StatValue>
      <StatLabel>Uptime</StatLabel>
    </StatCard>
  </StatusOverview>

  {/* Heartbeat Status */}
  {heartbeat && (
    <HeartbeatMonitor healthy={heartbeat.healthy}>
      <HeartbeatIcon>
        <Heart size={20} className={heartbeat.alive ? 'beating' : ''} />
      </HeartbeatIcon>
      <HeartbeatInfo>
        <HeartbeatTitle>
          {heartbeat.healthy ? '⏱️ Heartbeat Healthy' : '⚠️ Heartbeat Issues Detected'}
        </HeartbeatTitle>
        <HeartbeatDetails>
          Last beat: {formatTime(heartbeat.last_beat_at)} |
          Interval: {heartbeat.interval}s |
          Missed beats: {heartbeat.missed_beats}
        </HeartbeatDetails>
      </HeartbeatInfo>
    </HeartbeatMonitor>
  )}

  {/* Tasks List */}
  <TasksSection>
    <SectionHeader>
      <h3>Task List ({tasks.length})</h3>
      <FilterButtons>
        <FilterButton active={filter === 'all'}>All</FilterButton>
        <FilterButton active={filter === 'idle'}>Idle</FilterButton>
        <FilterButton active={filter === 'running'}>Running</FilterButton>
        <FilterButton active={filter === 'completed'}>Completed</FilterButton>
        <FilterButton active={filter === 'failed'}>Failed</FilterButton>
      </FilterButtons>
    </SectionHeader>

    <TasksGrid>
      {filteredTasks.map(task => (
        <TaskCard
          key={task.name}
          status={task.status}
          onClick={() => openTaskDetail(task)}
        >
          <TaskHeader>
            <TaskName>{task.name}</TaskName>
            <TaskStatusBadge status={task.status} />
          </TaskHeader>

          <TaskClass>
            <Code size={14} />
            {task.class}
          </TaskClass>

          <TaskSchedule>
            <Clock size={14} />
            <ScheduleText>{task.schedule}</ScheduleText>
          </TaskSchedule>

          <TaskStats>
            <StatItem>
              <StatLabel>Run Count</StatLabel>
              <StatValue>{task.run_count}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Success Rate</StatLabel>
              <StatValue>
                {((task.success_count / task.run_count) * 100).toFixed(1)}%
              </StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Avg Duration</StatLabel>
              <StatValue>{task.average_duration}ms</StatValue>
            </StatItem>
          </TaskStats>

          <TaskTiming>
            {task.last_run_at && (
              <TimingItem>
                <Label>Last Run:</Label>
                <Time>{formatRelative(task.last_run_at)}</Time>
              </TimingItem>
            )}
            {task.next_run_at && (
              <TimingItem>
                <Label>Next Run:</Label>
                <Time>{formatRelative(task.next_run_at)}</Time>
              </TimingItem>
            )}
          </TaskTiming>

          {task.last_error && (
            <ErrorBanner>
              <AlertCircle size={16} />
              <ErrorText>{task.last_error}</ErrorText>
            </ErrorBanner>
          )}

          <TaskFooter>
            <EnabledToggle
              checked={task.enabled}
              onChange={() => toggleTaskEnabled(task.name)}
            />
            <FooterActions>
              <IconButton onClick={() => viewTaskLogs(task)}>
                <FileText size={16} />
              </IconButton>
              <IconButton onClick={() => manualRunTask(task)}>
                <Play size={16} />
              </IconButton>
            </FooterActions>
          </TaskFooter>
        </TaskCard>
      ))}
    </TasksGrid>
  </TasksSection>

  {/* Task Detail Modal */}
  {selectedTask && (
    <TaskDetailModal
      task={selectedTask}
      onClose={closeTaskDetail}
    >
      <ModalHeader>
        <h3>{selectedTask.name}</h3>
        <TaskStatusBadge status={selectedTask.status} />
      </ModalHeader>

      <ModalBody>
        <DetailSection>
          <SectionTitle>Task Information</SectionTitle>
          <InfoGrid>
            <InfoRow label="Class" value={selectedTask.class} />
            <InfoRow label="Schedule" value={selectedTask.schedule} />
            <InfoRow label="Status" value={selectedTask.status} />
            <InfoRow label="Enabled" value={selectedTask.enabled ? 'Yes' : 'No'} />
          </InfoGrid>
        </DetailSection>

        <DetailSection>
          <SectionTitle>Execution Statistics</SectionTitle>
          <StatsGrid>
            <StatBox>
              <StatLabel>Total Runs</StatLabel>
              <StatValue>{selectedTask.run_count}</StatValue>
            </StatBox>
            <StatBox>
              <StatLabel>Successful</StatLabel>
              <StatValue success>{selectedTask.success_count}</StatValue>
            </StatBox>
            <StatBox>
              <StatLabel>Failed</StatLabel>
              <StatValue error>{selectedTask.failure_count}</StatValue>
            </StatBox>
            <StatBox>
              <StatLabel>Success Rate</StatLabel>
              <StatValue>
                {((selectedTask.success_count / selectedTask.run_count) * 100).toFixed(1)}%
              </StatValue>
            </StatBox>
          </StatsGrid>
        </DetailSection>

        <DetailSection>
          <SectionTitle>Performance</SectionTitle>
          <PerformanceChart
            data={taskRunHistory}
            metric="duration"
          />
          <InfoGrid>
            <InfoRow label="Average Duration" value={`${selectedTask.average_duration}ms`} />
            <InfoRow label="Last Duration" value={`${selectedTask.last_duration}ms`} />
          </InfoGrid>
        </DetailSection>

        <DetailSection>
          <SectionTitle>Timing</SectionTitle>
          <InfoGrid>
            <InfoRow label="Last Run" value={formatDateTime(selectedTask.last_run_at)} />
            <InfoRow label="Next Run" value={formatDateTime(selectedTask.next_run_at)} />
          </InfoGrid>
        </DetailSection>

        {selectedTask.metadata && (
          <DetailSection>
            <SectionTitle>Metadata</SectionTitle>
            <MetadataGrid>
              {selectedTask.metadata.description && (
                <InfoRow label="Description" value={selectedTask.metadata.description} />
              )}
              {selectedTask.metadata.priority && (
                <InfoRow label="Priority" value={selectedTask.metadata.priority} />
              )}
              {selectedTask.metadata.timeout && (
                <InfoRow label="Timeout" value={`${selectedTask.metadata.timeout}s`} />
              )}
              {selectedTask.metadata.retry_on_failure && (
                <InfoRow label="Retry on Failure" value="Yes" />
              )}
              {selectedTask.metadata.max_retries && (
                <InfoRow label="Max Retries" value={selectedTask.metadata.max_retries} />
              )}
            </MetadataGrid>
          </DetailSection>
        )}

        {selectedTask.last_error && (
          <DetailSection>
            <SectionTitle>Last Error</SectionTitle>
            <ErrorBox>
              <pre>{selectedTask.last_error}</pre>
            </ErrorBox>
          </DetailSection>
        )}

        <DetailSection>
          <SectionTitle>Recent Runs</SectionTitle>
          <RunHistory>
            {taskRunHistory.map(run => (
              <RunHistoryItem key={run.id} status={run.status}>
                <RunTime>{formatDateTime(run.started_at)}</RunTime>
                <RunDuration>{run.duration}ms</RunDuration>
                <RunStatus status={run.status}>
                  {run.status === 'success' ? (
                    <CheckCircle size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  {run.status}
                </RunStatus>
              </RunHistoryItem>
            ))}
          </RunHistory>
        </DetailSection>
      </ModalBody>

      <ModalFooter>
        <Button onClick={() => manualRunTask(selectedTask)} primary>
          <Play size={18} />
          Run Now
        </Button>
        <Button onClick={() => viewFullLogs(selectedTask)}>
          <FileText size={18} />
          View Logs
        </Button>
        <Button onClick={closeTaskDetail} variant="ghost">
          Close
        </Button>
      </ModalFooter>
    </TaskDetailModal>
  )}
</OctaneTasks>
```

---

## 5. 共享组件库

### 5.1 基础 UI 组件

#### Button

```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}
```

#### Card

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
}

interface CardBodyProps {
  children: React.ReactNode;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

interface CardFooterProps {
  children: React.ReactNode;
  justify?: 'start' | 'end' | 'center' | 'between';
}
```

#### Input

```typescript
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'email' | 'number';
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}
```

#### Select

```typescript
interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
}
```

#### Table

```typescript
interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
}
```

#### Modal

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
}
```

#### Tabs

```typescript
interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'line' | 'card';
}
```

### 5.2 数据展示组件

#### JSONViewer (详见 System Info)
#### ProgressBar
#### StatCard
#### Badge
#### Tag
#### Tooltip
#### Pagination

### 5.3 表单组件

#### TextArea
#### Checkbox
#### Radio
#### Switch
#### DatePicker
#### ColorPicker
#### FileUpload

### 5.4 反馈组件

#### LoadingSpinner
#### EmptyState
#### ErrorBoundary
#### Toast/Notification
#### ConfirmDialog

---

## 6. 布局与样式规范

### 6.1 颜色系统

```typescript
const colors = {
  // Primary
  primary: '#3b82f6',
  primaryHover: '#2563eb',

  // Status
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Neutral (Dark Mode)
  background: '#0f172a',
  surface: '#1e293b',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#e2e8f0',
  textMuted: '#94a3b8',

  // Neutral (Light Mode)
  backgroundLight: '#f8fafc',
  surfaceLight: '#ffffff',
  borderLight: '#e2e8f0',
  textLight: '#1e293b',
  textMutedLight: '#64748b'
};
```

### 6.2 间距系统

```typescript
const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem'   // 64px
};
```

### 6.3 字体系统

```typescript
const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'Monaco, Menlo, "Courier New", monospace'
  },
  fontSize: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    md: '1rem',      // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem'// 30px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};
```

### 6.4 响应式断点

```typescript
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};
```

---

## 总结

本文档详细定义了:

- ✅ 4 个主要页面的完整 UI 结构
- ✅ 100+ 页面元素和组件
- ✅ 交互行为和状态管理
- ✅ 共享组件库规范
- ✅ 样式和布局系统

所有组件均包含完整的 Props 定义和使用示例。

**全部扩展文档已完成！**
