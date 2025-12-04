import React, { useState, useEffect } from 'react';
import { useTranslation } from '../services/i18n';
import { wsClient } from '../services/websocket/client';

interface ManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfigSection = 
  | 'connection' 
  | 'video' 
  | 'input' 
  | 'group' 
  | 'recording' 
  | 'file' 
  | 'preferences' 
  | 'interface';

export const ManagementPanel: React.FC<ManagementPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<ConfigSection>('connection');
  const [config, setConfig] = useState({
    // 连接与部署
    connection: {
      maxDevices: 1000,
      adbReversePort: 27183,
      autoFallback: true,
      portAllocation: 'auto' as 'auto' | 'manual',
    },
    // 视频与渲染
    video: {
      resolution: '1080',
      bitrate: 8000000,
      framerate: 60,
      crop: '',
      orientationLock: false,
      keepAwake: true,
      showFPS: true,
      borderless: false,
      skinMode: false,
      gridColumns: 4,
    },
    // 输入与控制
    input: {
      autoScreenOff: false,
      keepAwake: true,
      showTouch: false,
      borderlessWindow: false,
      keymapScript: '',
      gameMode: false,
      mouseCapture: false,
    },
    // 多设备编组
    group: {
      autoRestore: true,
      broadcastDelay: 0,
      groupControlMode: 'free' as 'free' | 'host' | 'client',
    },
    // 采集与录制
    recording: {
      format: 'mp4' as 'mp4' | 'mkv',
      recordWhileDisplay: true,
      backgroundRecord: false,
      screenshotFormat: 'png',
      screenshotPath: './screenshots',
      timestampFormat: 'YYYY-MM-DD_HH-mm-ss',
    },
    // 文件与剪贴板
    file: {
      pushPath: './files',
      clipboardSync: true,
      autoPaste: true,
    },
    // 配置与用户偏好
    preferences: {
      recordingPath: './recordings',
      resolutionPreset: '1080',
      reverseConnection: false,
      alwaysOnTop: false,
      autoScreenOff: false,
      simpleMode: false,
      deviceNickname: true,
      windowPosition: true,
    },
    // 界面与平台
    interface: {
      theme: 'cyber' as 'cyber' | 'dark' | 'light',
      language: 'auto' as 'auto' | 'zh' | 'en',
      openglBackend: 'auto' as 'auto' | 'desktop' | 'egl',
      qssSkin: 'default',
      borderless: false,
      maximizeOnStart: true,
    },
  });

  if (!isOpen) return null;

  const updateConfig = <K extends keyof typeof config>(
    section: K,
    updates: Partial<typeof config[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
  };

  const sections: { id: ConfigSection; label: string; icon: string; color: string }[] = [
    { id: 'connection', label: t('management.sections.connection'), icon: 'ph-plugs-connected', color: 'text-[#00f2ff]' },
    { id: 'video', label: t('management.sections.video'), icon: 'ph-monitor', color: 'text-[#05ffa1]' },
    { id: 'input', label: t('management.sections.input'), icon: 'ph-keyboard', color: 'text-[#bd00ff]' },
    { id: 'group', label: t('management.sections.group'), icon: 'ph-users-three', color: 'text-[#ff2a6d]' },
    { id: 'recording', label: t('management.sections.recording'), icon: 'ph-video-camera', color: 'text-[#ffaa00]' },
    { id: 'file', label: t('management.sections.file'), icon: 'ph-folder', color: 'text-[#00d4ff]' },
    { id: 'preferences', label: t('management.sections.preferences'), icon: 'ph-gear', color: 'text-[#a855f7]' },
    { id: 'interface', label: t('management.sections.interface'), icon: 'ph-paint-brush', color: 'text-[#ec4899]' },
  ];

  // Load config from WebSocket on mount
  useEffect(() => {
    if (isOpen) {
      wsClient
        .send({ namespace: 'config', action: 'get_full' })
        .then((response) => {
          if (response.success && response.data?.config) {
            // Update config from server
            // This is a simplified version - you may need to map the response structure
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Save config via WebSocket
  const handleSave = async () => {
    try {
      await wsClient.send({
        namespace: 'config',
        action: 'update_global',
        data: config,
      });
      // Show success message
    } catch (error) {
      // Show error message
    }
  };

  return (
    <div className="fixed inset-0 bg-[#030305]/95 backdrop-blur-xl z-[70] flex">
      {/* Sidebar */}
      <div className="w-[280px] bg-[#0a0c10] border-r border-white/10 flex flex-col">
        <div className="h-20 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-xl font-bold tracking-widest text-white">{t('management.title')}</h1>
            <p className="text-[9px] text-[#00f2ff] font-mono">SYSTEM CONFIG</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            <i className="ph ph-x"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <div className="space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative group
                  ${activeSection === section.id 
                    ? 'bg-white/10 border border-white/20' 
                    : 'hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                {activeSection === section.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00f2ff] shadow-[0_0_10px_#00f2ff] rounded-r"></div>
                )}
                <i className={`ph ${section.icon} text-xl ${section.color}`}></i>
                <span className="text-sm font-medium text-white">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleSave}
            className="w-full py-3 bg-[#00f2ff]/10 border border-[#00f2ff]/50 text-[#00f2ff] font-bold tracking-widest hover:bg-[#00f2ff]/20 transition-all rounded text-sm"
          >
            {t('management.save')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 shrink-0 bg-[#0a0c10]">
          <div>
            <h2 className="text-lg font-bold tracking-widest text-white">
              {sections.find(s => s.id === activeSection)?.label}
            </h2>
            <p className="text-[10px] text-slate-500 font-mono">
              {activeSection.toUpperCase()} CONFIGURATION
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {/* 连接与部署 */}
          {activeSection === 'connection' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="设备连接限制">
                <div className="space-y-4">
                  <ConfigField label="最大设备数" description="支持最多连接的设备数量">
                    <input
                      type="number"
                      value={config.connection.maxDevices}
                      onChange={(e) => updateConfig('connection', { maxDevices: parseInt(e.target.value) || 1000 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="ADB Reverse 起始端口" description="端口耗尽时自动回落到 forward">
                    <input
                      type="number"
                      value={config.connection.adbReversePort}
                      onChange={(e) => updateConfig('connection', { adbReversePort: parseInt(e.target.value) || 27183 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigToggle
                    label="自动回退到 Forward"
                    checked={config.connection.autoFallback}
                    onChange={(v) => updateConfig('connection', { autoFallback: v })}
                  />
                  <ConfigField label="端口分配策略">
                    <select
                      value={config.connection.portAllocation}
                      onChange={(e) => updateConfig('connection', { portAllocation: e.target.value as 'auto' | 'manual' })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="auto">自动分配</option>
                      <option value="manual">手动分配</option>
                    </select>
                  </ConfigField>
                </div>
              </ConfigCard>

              <ConfigCard title="设备连接参数">
                <div className="space-y-4">
                  <ConfigField label="ADB 路径" description="ADB 可执行文件路径">
                    <input
                      type="text"
                      placeholder="/usr/bin/adb"
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="Scrcpy 服务器路径">
                    <input
                      type="text"
                      placeholder="./scrcpy-server"
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 视频与渲染 */}
          {activeSection === 'video' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="视频流参数">
                <div className="space-y-4">
                  <ConfigField label="分辨率" description="设备显示分辨率">
                    <select
                      value={config.video.resolution}
                      onChange={(e) => updateConfig('video', { resolution: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="720">720p</option>
                      <option value="1080">1080p</option>
                      <option value="1440">1440p</option>
                      <option value="max">最大</option>
                    </select>
                  </ConfigField>
                  <ConfigField label="码率 (bps)" description="视频编码码率">
                    <input
                      type="number"
                      value={config.video.bitrate}
                      onChange={(e) => updateConfig('video', { bitrate: parseInt(e.target.value) || 8000000 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="帧率 (fps)">
                    <input
                      type="number"
                      value={config.video.framerate}
                      onChange={(e) => updateConfig('video', { framerate: parseInt(e.target.value) || 60 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="裁剪区域" description="格式: width:height:x:y">
                    <input
                      type="text"
                      value={config.video.crop}
                      onChange={(e) => updateConfig('video', { crop: e.target.value })}
                      placeholder="1920:1080:0:0"
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                </div>
              </ConfigCard>

              <ConfigCard title="渲染设置">
                <div className="space-y-4">
                  <ConfigToggle
                    label="方向锁定"
                    checked={config.video.orientationLock}
                    onChange={(v) => updateConfig('video', { orientationLock: v })}
                  />
                  <ConfigToggle
                    label="保持唤醒"
                    checked={config.video.keepAwake}
                    onChange={(v) => updateConfig('video', { keepAwake: v })}
                  />
                  <ConfigToggle
                    label="显示 FPS 指示器"
                    checked={config.video.showFPS}
                    onChange={(v) => updateConfig('video', { showFPS: v })}
                  />
                  <ConfigToggle
                    label="无边框窗口"
                    checked={config.video.borderless}
                    onChange={(v) => updateConfig('video', { borderless: v })}
                  />
                  <ConfigToggle
                    label="皮肤模式"
                    checked={config.video.skinMode}
                    onChange={(v) => updateConfig('video', { skinMode: v })}
                  />
                  <ConfigField label="网格列数" description="主界面设备网格布局">
                    <input
                      type="number"
                      value={config.video.gridColumns}
                      onChange={(e) => updateConfig('video', { gridColumns: parseInt(e.target.value) || 4 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                </div>
              </ConfigCard>

              <ConfigCard title="OpenGL 设置">
                <div className="space-y-4">
                  <ConfigField label="OpenGL 模式">
                    <select className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none">
                      <option>自动</option>
                      <option>Desktop</option>
                      <option>EGL</option>
                    </select>
                  </ConfigField>
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 输入与控制 */}
          {activeSection === 'input' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="设备控制选项">
                <div className="space-y-4">
                  <ConfigToggle
                    label="自动息屏"
                    checked={config.input.autoScreenOff}
                    onChange={(v) => updateConfig('input', { autoScreenOff: v })}
                  />
                  <ConfigToggle
                    label="保持唤醒"
                    checked={config.input.keepAwake}
                    onChange={(v) => updateConfig('input', { keepAwake: v })}
                  />
                  <ConfigToggle
                    label="显示触摸点"
                    checked={config.input.showTouch}
                    onChange={(v) => updateConfig('input', { showTouch: v })}
                  />
                  <ConfigToggle
                    label="无边框窗口"
                    checked={config.input.borderlessWindow}
                    onChange={(v) => updateConfig('input', { borderlessWindow: v })}
                  />
                </div>
              </ConfigCard>

              <ConfigCard title="游戏模式">
                <div className="space-y-4">
                  <ConfigToggle
                    label="启用游戏模式"
                    checked={config.input.gameMode}
                    onChange={(v) => updateConfig('input', { gameMode: v })}
                  />
                  <ConfigToggle
                    label="鼠标捕获"
                    checked={config.input.mouseCapture}
                    onChange={(v) => updateConfig('input', { mouseCapture: v })}
                    disabled={!config.input.gameMode}
                  />
                  <ConfigField label="键位脚本" description="JSON 格式的键位映射配置">
                    <textarea
                      value={config.input.keymapScript}
                      onChange={(e) => updateConfig('input', { keymapScript: e.target.value })}
                      placeholder='{"key": "W", "action": "move_forward"}'
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none font-mono h-32 resize-none"
                    />
                  </ConfigField>
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 多设备编组 */}
          {activeSection === 'group' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="群控设置">
                <div className="space-y-4">
                  <ConfigToggle
                    label="自动恢复群组状态"
                    checked={config.group.autoRestore}
                    onChange={(v) => updateConfig('group', { autoRestore: v })}
                  />
                  <ConfigField label="广播延迟 (ms)" description="群控操作广播延迟">
                    <input
                      type="number"
                      value={config.group.broadcastDelay}
                      onChange={(e) => updateConfig('group', { broadcastDelay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="群控模式">
                    <select
                      value={config.group.groupControlMode}
                      onChange={(e) => updateConfig('group', { groupControlMode: e.target.value as 'free' | 'host' | 'client' })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="free">自由模式</option>
                      <option value="host">主机模式</option>
                      <option value="client">客户端模式</option>
                    </select>
                  </ConfigField>
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 采集与录制 */}
          {activeSection === 'recording' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="录制设置">
                <div className="space-y-4">
                  <ConfigField label="录像格式">
                    <select
                      value={config.recording.format}
                      onChange={(e) => updateConfig('recording', { format: e.target.value as 'mp4' | 'mkv' })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="mp4">MP4</option>
                      <option value="mkv">MKV</option>
                    </select>
                  </ConfigField>
                  <ConfigToggle
                    label="边显示边录制"
                    checked={config.recording.recordWhileDisplay}
                    onChange={(v) => updateConfig('recording', { recordWhileDisplay: v })}
                  />
                  <ConfigToggle
                    label="纯后台录制"
                    checked={config.recording.backgroundRecord}
                    onChange={(v) => updateConfig('recording', { backgroundRecord: v })}
                  />
                </div>
              </ConfigCard>

              <ConfigCard title="截图设置">
                <div className="space-y-4">
                  <ConfigField label="截图格式">
                    <select
                      value={config.recording.screenshotFormat}
                      onChange={(e) => updateConfig('recording', { screenshotFormat: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="png">PNG</option>
                      <option value="jpg">JPG</option>
                    </select>
                  </ConfigField>
                  <ConfigField label="截图保存路径">
                    <input
                      type="text"
                      value={config.recording.screenshotPath}
                      onChange={(e) => updateConfig('recording', { screenshotPath: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="时间戳格式" description="文件名时间戳格式">
                    <input
                      type="text"
                      value={config.recording.timestampFormat}
                      onChange={(e) => updateConfig('recording', { timestampFormat: e.target.value })}
                      placeholder="YYYY-MM-DD_HH-mm-ss"
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 文件与剪贴板 */}
          {activeSection === 'file' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="文件管理">
                <div className="space-y-4">
                  <ConfigField label="文件推送目录">
                    <input
                      type="text"
                      value={config.file.pushPath}
                      onChange={(e) => updateConfig('file', { pushPath: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                </div>
              </ConfigCard>

              <ConfigCard title="剪贴板同步">
                <div className="space-y-4">
                  <ConfigToggle
                    label="启用剪贴板同步"
                    checked={config.file.clipboardSync}
                    onChange={(v) => updateConfig('file', { clipboardSync: v })}
                  />
                  <ConfigToggle
                    label="自动粘贴"
                    checked={config.file.autoPaste}
                    onChange={(v) => updateConfig('file', { autoPaste: v })}
                    disabled={!config.file.clipboardSync}
                  />
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 配置与用户偏好 */}
          {activeSection === 'preferences' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="用户偏好">
                <div className="space-y-4">
                  <ConfigField label="录像保存路径">
                    <input
                      type="text"
                      value={config.preferences.recordingPath}
                      onChange={(e) => updateConfig('preferences', { recordingPath: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    />
                  </ConfigField>
                  <ConfigField label="分辨率预设">
                    <select
                      value={config.preferences.resolutionPreset}
                      onChange={(e) => updateConfig('preferences', { resolutionPreset: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="720">720p</option>
                      <option value="1080">1080p</option>
                      <option value="1440">1440p</option>
                    </select>
                  </ConfigField>
                  <ConfigToggle
                    label="反向连接"
                    checked={config.preferences.reverseConnection}
                    onChange={(v) => updateConfig('preferences', { reverseConnection: v })}
                  />
                  <ConfigToggle
                    label="窗口置顶"
                    checked={config.preferences.alwaysOnTop}
                    onChange={(v) => updateConfig('preferences', { alwaysOnTop: v })}
                  />
                  <ConfigToggle
                    label="自动息屏"
                    checked={config.preferences.autoScreenOff}
                    onChange={(v) => updateConfig('preferences', { autoScreenOff: v })}
                  />
                  <ConfigToggle
                    label="简单模式"
                    checked={config.preferences.simpleMode}
                    onChange={(v) => updateConfig('preferences', { simpleMode: v })}
                  />
                  <ConfigToggle
                    label="保存设备昵称"
                    checked={config.preferences.deviceNickname}
                    onChange={(v) => updateConfig('preferences', { deviceNickname: v })}
                  />
                  <ConfigToggle
                    label="保存窗口位置"
                    checked={config.preferences.windowPosition}
                    onChange={(v) => updateConfig('preferences', { windowPosition: v })}
                  />
                </div>
              </ConfigCard>
            </div>
          )}

          {/* 界面与平台 */}
          {activeSection === 'interface' && (
            <div className="space-y-6 max-w-4xl">
              <ConfigCard title="主题与外观">
                <div className="space-y-4">
                  <ConfigField label="主题">
                    <select
                      value={config.interface.theme}
                      onChange={(e) => updateConfig('interface', { theme: e.target.value as 'cyber' | 'dark' | 'light' })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="cyber">赛博朋克</option>
                      <option value="dark">深色</option>
                      <option value="light">浅色</option>
                    </select>
                  </ConfigField>
                  <ConfigField label="QSS 皮肤">
                    <select
                      value={config.interface.qssSkin}
                      onChange={(e) => updateConfig('interface', { qssSkin: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="default">默认</option>
                      <option value="matrix">矩阵</option>
                      <option value="neon">霓虹</option>
                    </select>
                  </ConfigField>
                </div>
              </ConfigCard>

              <ConfigCard title="语言设置">
                <div className="space-y-4">
                  <ConfigField label="界面语言">
                    <select
                      value={config.interface.language}
                      onChange={(e) => updateConfig('interface', { language: e.target.value as 'auto' | 'zh' | 'en' })}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                    >
                      <option value="auto">自动</option>
                      <option value="zh">中文</option>
                      <option value="en">English</option>
                    </select>
                  </ConfigField>
                </div>
              </ConfigCard>

              <ConfigCard title="窗口设置">
                <div className="space-y-4">
                  <ConfigToggle
                    label="无边框窗口"
                    checked={config.interface.borderless}
                    onChange={(v) => updateConfig('interface', { borderless: v })}
                  />
                  <ConfigToggle
                    label="启动时最大化"
                    checked={config.interface.maximizeOnStart}
                    onChange={(v) => updateConfig('interface', { maximizeOnStart: v })}
                  />
                </div>
              </ConfigCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 辅助组件
const ConfigCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
    <h3 className="text-sm font-bold text-[#00f2ff] tracking-widest mb-4 font-mono">{title}</h3>
    {children}
  </div>
);

const ConfigField: React.FC<{ 
  label: string; 
  description?: string; 
  children: React.ReactNode 
}> = ({ label, description, children }) => (
  <div>
    <label className="block text-xs font-mono text-slate-400 mb-2 tracking-widest">
      {label}
      {description && <span className="ml-2 text-[10px] text-slate-600">({description})</span>}
    </label>
    {children}
  </div>
);

const ConfigToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <label className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10 cursor-pointer hover:border-white/30 transition-colors">
    <span className="text-sm text-white">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="w-4 h-4 accent-[#00f2ff] rounded bg-white/10 border-white/20 disabled:opacity-50"
    />
  </label>
);

