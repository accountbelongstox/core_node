import React, { useEffect, useState } from 'react';
import { 
  Cpu, 
  Mic, 
  Image, 
  Video, 
  Check,
  X,
  Zap,
  Save,
  BarChart2,
  Play,
  Activity,
  Upload
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { LocalCapabilities, LocalProcessingConfig, LocalProcessingStats, TestResponse } from '../types';
import { formatDuration, formatFileSize } from '../utils/formatters';

interface Props {
  defaultTab?: 'status' | 'config' | 'stats' | 'test';
}

const LocalProcessing: React.FC<Props> = ({ defaultTab = 'status' }) => {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'stats' | 'test'>('status');

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.local')}</h1>
      
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex gap-6">
          <TabButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} label={t('nav.local.cap')} />
          <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} label={t('nav.local.conf')} />
          <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} label={t('nav.local.stats')} />
          <TabButton active={activeTab === 'test'} onClick={() => setActiveTab('test')} label={t('nav.local.test')} />
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'status' && <CapabilitiesView />}
        {activeTab === 'config' && <ConfigView />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'test' && <TestView />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            active
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
        }`}
    >
        {label}
    </button>
);

const CapabilitiesView: React.FC = () => {
    const [capabilities, setCapabilities] = useState<LocalCapabilities | null>(null);

    useEffect(() => {
        api.local.getCapabilities().then(setCapabilities);
    }, []);

    if (!capabilities) return <div className="p-8 text-center text-slate-500">Loading capabilities...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Hardware Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <HardwareCard 
                    title="CPU Compute" 
                    model={capabilities.hardware.cpu.model} 
                    stats={`${capabilities.hardware.cpu.cores} Cores / ${capabilities.hardware.cpu.threads} Threads`}
                    available={capabilities.hardware.cpu.available}
                />
                <HardwareCard 
                    title="GPU Acceleration" 
                    model={capabilities.hardware.gpu.model} 
                    stats={`${(capabilities.hardware.gpu.memory / 1024).toFixed(0)} GB VRAM (CUDA ${capabilities.hardware.gpu.cuda_version})`}
                    available={capabilities.hardware.gpu.available}
                />
                <HardwareCard 
                    title="Memory" 
                    model="System RAM" 
                    stats={`${(capabilities.hardware.memory.available / 1024).toFixed(1)} GB Available / ${(capabilities.hardware.memory.total / 1024).toFixed(0)} GB Total`}
                    available={true}
                />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100">Capability Matrix</h2>
                    <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Refresh Capabilities</button>
                </div>
                <div className="p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-3 font-medium">Feature</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">Engines / Models</th>
                                <th className="px-6 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <CapabilityRow 
                                icon={Image}
                                title="Screenshot & OCR"
                                available={capabilities.capabilities.ocr.available}
                                details={capabilities.capabilities.ocr.engines.join(", ")}
                            />
                            <CapabilityRow 
                                icon={Mic}
                                title="Audio Transcription"
                                available={capabilities.capabilities.audio.available}
                                details={capabilities.capabilities.audio.engines.join(", ")}
                            />
                            <CapabilityRow 
                                icon={Video}
                                title="Video Processing"
                                available={capabilities.capabilities.video.available}
                                details={capabilities.capabilities.video.available ? "Active" : "Not Supported"}
                            />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ConfigView: React.FC = () => {
    const { t } = useApp();
    const [config, setConfig] = useState<LocalProcessingConfig | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.local.getConfig().then(setConfig);
    }, []);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        await api.local.updateConfig(config);
        setSaving(false);
    };

    if (!config) return <div className="p-8 text-center">{t('common.loading')}</div>;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 animate-fade-in">
             <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('local.config.title')}</h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Screenshot Config */}
                 <div className="space-y-4">
                     <h3 className="font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">{t('local.screenshot')}</h3>
                     <div>
                         <label className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={config.screenshot.enabled} 
                                onChange={(e) => setConfig({...config, screenshot: {...config.screenshot, enabled: e.target.checked}})}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Enable Screenshot Module</span>
                         </label>
                     </div>
                     <div>
                         <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Format</label>
                         <select 
                            value={config.screenshot.format}
                            onChange={(e) => setConfig({...config, screenshot: {...config.screenshot, format: e.target.value as any}})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                         >
                             <option value="png">PNG (Lossless)</option>
                             <option value="jpg">JPG (Compressed)</option>
                         </select>
                     </div>
                 </div>

                 {/* OCR Config */}
                 <div className="space-y-4">
                     <h3 className="font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">{t('local.ocr')}</h3>
                     <div>
                         <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Engine</label>
                         <select 
                            value={config.ocr.engine}
                            onChange={(e) => setConfig({...config, ocr: {...config.ocr, engine: e.target.value}})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                         >
                             <option value="PaddleOCR">PaddleOCR (Recommended)</option>
                             <option value="Tesseract">Tesseract</option>
                         </select>
                     </div>
                     <div>
                         <label className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={config.ocr.gpu_enabled} 
                                onChange={(e) => setConfig({...config, ocr: {...config.ocr, gpu_enabled: e.target.checked}})}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Enable GPU Acceleration</span>
                         </label>
                     </div>
                 </div>
             </div>

             <div className="pt-8 mt-4 border-t border-slate-200 dark:border-slate-700">
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : t('common.save')}
                </button>
             </div>
        </div>
    );
};

const StatsView: React.FC = () => {
    const { t } = useApp();
    const [stats, setStats] = useState<LocalProcessingStats | null>(null);

    useEffect(() => {
        api.local.getStats().then(setStats);
    }, []);

    if (!stats) return <div className="p-8 text-center">{t('common.loading')}</div>;

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    return (
        <div className="space-y-6 animate-fade-in">
             {/* Summary Cards */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <StatsCard title="Total Tasks" value={stats.summary.total_tasks} color="text-blue-600" />
                 <StatsCard title="Success Rate" value={`${((stats.summary.completed / stats.summary.total_tasks) * 100).toFixed(1)}%`} color="text-green-600" />
                 <StatsCard title="Avg. Time" value={`${stats.summary.average_time}s`} color="text-purple-600" />
                 <StatsCard title="Data Processed" value={`${(stats.summary.total_data_processed / 1024).toFixed(1)} GB`} color="text-orange-600" />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Timeline Chart */}
                 <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Processing Timeline (7 Days)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.timeline}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 12}} />
                                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}}
                                    itemStyle={{color: '#f8fafc'}}
                                />
                                <Legend />
                                <Bar dataKey="success" name="Success" fill="#10b981" stackId="a" />
                                <Bar dataKey="failed" name="Failed" fill="#ef4444" stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Type Distribution */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Task Types</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.by_type}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                >
                                    {stats.by_type.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                         </ResponsiveContainer>
                    </div>
                 </div>
             </div>
        </div>
    );
};

const TestView: React.FC = () => {
    const { t } = useApp();
    const [testType, setTestType] = useState<'screenshot' | 'ocr' | 'audio' | 'video'>('screenshot');
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<TestResponse | null>(null);

    const handleRunTest = async () => {
        setTesting(true);
        setResult(null);
        try {
            const res = await api.local.runTest({ test_type: testType, test_data: 'dummy_base64_data' });
            setResult(res);
        } catch (e) {
            console.error(e);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
             <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('local.test.title')}</h2>
                 
                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('local.test.type')}</label>
                         <div className="grid grid-cols-2 gap-2">
                             {(['screenshot', 'ocr', 'audio', 'video'] as const).map(type => (
                                 <button
                                    key={type}
                                    onClick={() => setTestType(type)}
                                    className={`px-3 py-2 text-sm rounded-lg capitalize border transition-all ${
                                        testType === type 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                 >
                                     {type}
                                 </button>
                             ))}
                         </div>
                     </div>

                     <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center text-center">
                         <Upload size={24} className="text-slate-400 mb-2" />
                         <p className="text-xs text-slate-500 mb-2">Upload Sample Data (Optional)</p>
                         <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Browse Files</button>
                     </div>

                     <button 
                        onClick={handleRunTest}
                        disabled={testing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                     >
                         {testing ? <Activity className="animate-spin" size={18} /> : <Play size={18} />}
                         {testing ? 'Running Diagnostics...' : t('local.test.run')}
                     </button>
                 </div>
             </div>

             <div className="lg:col-span-2">
                 {result ? (
                     <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 h-full animate-fade-in">
                         <div className="flex items-center gap-3 mb-6">
                             <div className={`p-2 rounded-full ${result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                 {result.success ? <Check size={24} /> : <X size={24} />}
                             </div>
                             <div>
                                 <h3 className="font-bold text-slate-900 dark:text-white text-lg">Test Completed</h3>
                                 <p className="text-sm text-slate-500">Execution time: {result.execution_time}s</p>
                             </div>
                         </div>

                         <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-4 font-mono text-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
                             <pre className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                 {JSON.stringify(result, null, 2)}
                             </pre>
                         </div>
                     </div>
                 ) : (
                     <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 h-full flex flex-col items-center justify-center text-slate-400">
                         <Activity size={48} className="mb-4 opacity-20" />
                         <p>Select a test type and run diagnostic to see results</p>
                     </div>
                 )}
             </div>
        </div>
    );
};

const HardwareCard: React.FC<{ title: string; model: string; stats: string; available: boolean }> = ({ title, model, stats, available }) => (
    <div className={`p-5 rounded-xl border ${available ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-75'}`}>
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</h3>
            {available ? <div className="h-2 w-2 rounded-full bg-green-500"></div> : <div className="h-2 w-2 rounded-full bg-red-500"></div>}
        </div>
        <div className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 truncate" title={model}>{model}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{stats}</div>
    </div>
);

const CapabilityRow: React.FC<{ icon: any; title: string; available: boolean; details: string }> = ({ icon: Icon, title, available, details }) => (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800">
        <td className="px-6 py-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${available ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Icon size={18} />
            </div>
            <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
        </td>
        <td className="px-6 py-4">
             {available ? (
                 <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                     <Check size={12} /> Active
                 </span>
             ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-1 rounded-full">
                    <X size={12} /> Inactive
                </span>
             )}
        </td>
        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{details}</td>
        <td className="px-6 py-4 text-right">
            <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50" disabled={!available}>
                Configure
            </button>
        </td>
    </tr>
);

const StatsCard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value, color }) => (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{title}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
);

export default LocalProcessing;