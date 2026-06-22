import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, RefreshCw, Search, Bookmark, 
  BookmarkCheck, Plus, ShoppingCart, Percent, Clock, Briefcase, 
  Layers, Check, AlertCircle, ShoppingBag, ShieldCheck, Award,
  Volume2, Trash2, ArrowLeft, RotateCw, BarChart2, Eye, Compass,
  Activity, Sparkles, Filter, Settings, Sliders, Play, Pause, Coins,
  SlidersHorizontal, Repeat, Info, CheckSquare, Square, XSquare, PlusCircle,
  Sun, Moon, Globe, Database
} from 'lucide-react';
import { useShell } from '../../shell/ShellContext';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import OkxBacktestPanel from './OkxBacktestPanel';
import OkxQuantPanel from './OkxQuantPanel';
import OkxAccountPanel from './OkxAccountPanel';

/** The tabs that are real URL routes under /vortex (e.g. /vortex/settings). */
const VORTEX_TABS = ['market', 'compare', 'ledger', 'settings', 'okx-backtest'] as const;
type VortexTab = (typeof VORTEX_TABS)[number];

// Types representation
interface CoinAsset {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price: number;
  price1mAgo: number;
  price5mAgo: number;
  price5hAgo: number;
  price24hAgo: number;
  history: number[];
}

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
}

interface HistoricTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  amount: number;
  quantity: number;
  price: number;
  pnl: number;
  leverage: number;
  time: string;
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'warning' | 'star';
}

// Famous core baseline cryptocurrencies
const BASE_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', category: 'L1', price: 68420 },
  { symbol: 'ETH', name: 'Ethereum', category: 'L1', price: 3512 },
  { symbol: 'SOL', name: 'Solana', category: 'L1', price: 149.5 },
  { symbol: 'BNB', name: 'BNB Chain', category: 'L1', price: 582.1 },
  { symbol: 'XRP', name: 'Ripple', category: 'Payment', price: 0.524 },
  { symbol: 'ADA', name: 'Cardano', category: 'L1', price: 0.392 },
  { symbol: 'DOT', name: 'Polkadot', category: 'L1', price: 5.95 },
  { symbol: 'AVAX', name: 'Avalanche', category: 'L1', price: 29.85 },
  { symbol: 'DOGE', name: 'Dogecoin', category: 'Meme', price: 0.128 },
  { symbol: 'SHIB', name: 'Shiba Inu', category: 'Meme', price: 0.0000189 },
  { symbol: 'LINK', name: 'Chainlink', category: 'Oracle', price: 14.35 },
  { symbol: 'NEAR', name: 'Near Protocol', category: 'L1', price: 5.12 },
  { symbol: 'MATIC', name: 'Polygon', category: 'L2', price: 0.581 },
  { symbol: 'PEPE', name: 'Pepe', category: 'Meme', price: 0.0000122 },
  { symbol: 'FET', name: 'Artificial Superintelligence', category: 'AI', price: 1.48 },
  { symbol: 'RNDR', name: 'Render Token', category: 'AI', price: 7.95 },
  { symbol: 'UNI', name: 'Uniswap', category: 'DeFi', price: 7.42 },
  { symbol: 'AAVE', name: 'Aave', category: 'DeFi', price: 93.80 },
  { symbol: 'INJ', name: 'Injective', category: 'L1', price: 22.90 },
  { symbol: 'SUI', name: 'Sui Network', category: 'L1', price: 1.135 },
  { symbol: 'WLD', name: 'Worldcoin', category: 'AI', price: 2.24 },
  { symbol: 'OP', name: 'Optimism', category: 'L2', price: 1.89 },
  { symbol: 'ARB', name: 'Arbitrum', category: 'L2', price: 0.825 },
];

const VORTEX_I18N: Record<string, Record<string, string>> = {
  en: {
    title: "Quantum Vortex Quant Sandbox",
    subtitle: "Real-time Simulated High-Frequency Sandbox Multi-Coin Terminal & Performance Analytics Arena",
    tabMarket: "Market Plaza",
    tabCompare: "Compare Arena",
    tabLedger: "Sim Ledger",
    tabSettings: "Control Center",
    tabOkx: "OKX Backtest",
    totalWealth: "Sim Portfolio Value",
    availableCash: "Available Margin (USDT)",
    holdingValue: "Crypto Value",
    unrealizedPnL: "Unrealized Floating P&L",
    updatedAt: "Ledger State Heartbeat",
    searchPlaceholder: "Search symbol, category or name...",
    categoryAll: "All Categories",
    onlyBookmarked: "Stars Only",
    filter1m: "1m Growth",
    filter5m: "5m Growth",
    actionTrade: "Pre-execution Sandbox Order Placement",
    actionBuy: "Simulated Long BUY",
    actionSell: "Simulated Short SELL",
    amountUSDT: "Max Order Allocation Size (USDT)",
    quantity: "Est. Asset Quantity Received",
    insufficientFunds: "Insufficient margin in simulated balance!",
    orderSuccess: "Vortex ledger sequence executed and committed to private sandbox sandbox local index!",
    currentHoldings: "Live Holdings Terminal Tracker",
    noHoldings: "No current active exposures. Search tokens in the list to trigger order placement!",
    pnlTable: "Simulated Realized Ledger Records",
    colSize: "Quantity",
    colEntry: "Acquisition Price",
    colCurrent: "Ticked Spot Price",
    colROI: "Unrealized return margin & ROI%",
    colAction: "Manual Liquidation",
    closeBtn: "Liquidate",
    historyTitle: "Real-time Settlement History Audit Logs",
    totalProfit: "Realized Net Yield",
    autoRefresh: "High-Freq Sim Heartbeat Speed",
    refreshSuccess: "External rates feed updated.",
    categoryLabel: "Category Filter Scope",
    chartTitle: "High-Freq Spot Asset Wave",
    searchFilterTitle: "Sandbox Filter Toolbelt",
    quickStats: "Simulated Exchange Run stats",
    detailTitle: "Spot Asset Intelligent Drawer",
    orderBookTitle: "Real-time Sim Order book Depth (5-level)",
    indicatorsTitle: "Sub-Engine Derived Indicators View",
    rsiLabel: "Calculated Spot RSI Index (14 ticks)",
    macdLabel: "MACD Signal Wave (Fast/Slow Drift)",
    volume24h: "Simulated 24H volume",
    compareHeadline: "Overlaid Relative Performance Grid",
    compareSub: "Cross-asset normalized percent gain compare index starts from 15 ticks ago. Max 4 selected tokens.",
    noSelectedCompare: "Please select 1 to 4 tokens from the coin directory using the 'Compare' checkbox to render superimposed chart overlays!",
    metricCategory: "Asset category",
    metricRSI: "RSI Trend",
    metric1m: "1m Gain %",
    metric5m: "5m Gain %",
    metric24h: "Daily Gain %",
    metricHoldings: "My Holdings",
    clearCompare: "Clear list",
    configSub: "Tune simulated latency, fee coefficients, trade parameters and layout modifiers below.",
    optLatency: "Engine ticks timer period speed",
    optFee: "Exchange commission rates (%)",
    optLeverage: "Order Leverage Multiplier multiplier",
    btnReset: "Restore initial $100,000 credit",
    btnAirdrop: "Inject simulated $15,000 airdrop",
    notifyReset: "Airdrop committed. Simulated account balances synced.",
    langLabel: "System Lang support override",
    themeLabel: "Theme canvas display profile"
  },
  zh: {
    title: "Vortex 高级虚拟代币量化沙盒",
    subtitle: "高频自更新算法行情、多维跨时性能指标对比、交互下账以及多模态配置中心",
    tabMarket: "行情中心",
    tabCompare: "多币竞技对比",
    tabLedger: "持仓与账本",
    tabSettings: "量化参数设置",
    tabOkx: "OKX 回测",
    totalWealth: "总模拟净资产 (USDT)",
    availableCash: "保证金可用余额",
    holdingValue: "代币持有总市值",
    unrealizedPnL: "浮动中未实现盈亏",
    updatedAt: "高频沙盒链账本同步",
    searchPlaceholder: "检索代币符号、名称或板块...",
    categoryAll: "全部板块",
    onlyBookmarked: "仅自选星标",
    filter1m: "1分钟内看涨",
    filter5m: "5分钟内看涨",
    actionTrade: "量子一键闪电交易下单柜台",
    actionBuy: "模拟市价做多 (BUY)",
    actionSell: "模拟市价做空 (SELL)",
    amountUSDT: "单次下单计划额度 (USDT)",
    quantity: "预计可交割虚拟代币份额",
    insufficientFunds: "可用模拟保证金不足或没有持仓！交易已拒绝。",
    orderSuccess: "订单交割完成！已同步写入Vortex沙盒私有账本结算序列中。",
    currentHoldings: "活跃持仓与未交割头寸实时监控",
    noHoldings: "当前无活跃风险敞口。请在左侧行情中心点击任何代币完成快速下单！",
    pnlTable: "实盘持仓盈亏表",
    colSize: "持仓量",
    colEntry: "买入成本均价",
    colCurrent: "外部最新参考价",
    colROI: "未实现损益 (收益率 %)",
    colAction: "清算操作",
    closeBtn: "市价清算一击",
    historyTitle: "沙盒已结算历史交割单",
    totalProfit: "已结算账户净盈亏",
    autoRefresh: "行情自动报价心跳",
    refreshSuccess: "行情自动心跳触发成功，当前代币序列重估完毕。",
    categoryLabel: "代币板块细分检索",
    chartTitle: "实时一分钟高频趋势波动",
    searchFilterTitle: "智能标的检索过滤面板",
    quickStats: "交易中心量子统计",
    detailTitle: "特定标的多模态详情视窗",
    orderBookTitle: "实时模拟五档深度盘口",
    indicatorsTitle: "衍生量化技标引擎计算",
    rsiLabel: "相对强弱指标 RSI (14 周期)",
    macdLabel: "MACD 移动平均多空博弈波形",
    volume24h: "模拟 24H 交易额",
    compareHeadline: "多币复合相对增长竞技场 (叠线对比)",
    compareSub: "基于 15 周期前的首个计价，按比例归一化为百分比进行走势直观对抗。上限支持 4 个币种。",
    noSelectedCompare: "请并在下方或行情中心勾选 '选择对比' 复选框（上限 4 个币），即可将多条代币走势绘制于同一基准百分比坐标内！",
    metricCategory: "归属板块",
    metricRSI: "RSI 位置",
    metric1m: "1m 变化率",
    metric5m: "5m 变化率",
    metric24h: "24h 涨跌幅",
    metricHoldings: "我的模拟持仓",
    clearCompare: "清空对比队列",
    configSub: "调整底层自循环行情延迟、下单杠杆倍数、手续费比率、多语言及主题视觉设定。",
    optLatency: "模拟区块报价更新频率",
    optFee: "模拟交易手续费系数 (%)",
    optLeverage: "下单最大可配资持仓杠杆",
    btnReset: "一键重置账户 $100,000 信用额",
    btnAirdrop: "申请即时 $15,000 体验券空投",
    notifyReset: "资产划转完成。沙盒账本及保证金已经刷新锁定。",
    langLabel: "系统当前渲染语言",
    themeLabel: "主题视觉主题模式"
  },
  ja: {
    title: "Vortex 高度取引サンドボックス",
    subtitle: "高画質リアルタイム更新、複数通貨同時比較、模擬取引下帳およびカスタマイズ設定ハブ",
    tabMarket: "相場取引広場",
    tabCompare: "マルチスタック比較",
    tabLedger: "資産とポジション",
    tabSettings: "コントロールハブ",
    tabOkx: "OKX バックテスト",
    totalWealth: "仮想評価総資産",
    availableCash: "利用可能マージン (USDT)",
    holdingValue: "保有暗号資産総額",
    unrealizedPnL: "未実現持分評価損益",
    updatedAt: "台帳ブロック心拍数",
    searchPlaceholder: "シンボル、カテゴリ、名称を検索...",
    categoryAll: "全セクター",
    onlyBookmarked: "お気に入り限定",
    filter1m: "1分上昇トレンド",
    filter5m: "5分上昇トレンド",
    actionTrade: "注文予約・瞬間シミュレーター",
    actionBuy: "模擬買い注文 (BUY)",
    actionSell: "模擬売り注文 (SELL)",
    amountUSDT: "１回注文配分金額 (USDT)",
    quantity: "推計可受領トークン数量",
    insufficientFunds: "デモ残高が不足しているか、既存のポジションがありません！",
    orderSuccess: "取引成立！Vortex模擬ローカル台帳へ書き込まれました。 ",
    currentHoldings: "アクティブ露出リアルタイム追跡",
    noHoldings: "既存の露出ポジションはありません。相場一覧からシンボルを選択してください！",
    pnlTable: "リアルタイム評価損益一覧",
    colSize: "保有数量",
    colEntry: "平均取得単価",
    colCurrent: "外部現在指数価格",
    colROI: "未評価損益 (収益率 %)",
    colAction: "清算アクション",
    closeBtn: "ポジション決済",
    historyTitle: "決済完了取引・交割報告履歴",
    totalProfit: "決済済み累積実現損益",
    autoRefresh: "レート自動心拍速度調整",
    refreshSuccess: "マーケット価格が自律更新されました。",
    categoryLabel: "カテゴリ切り替え",
    chartTitle: "自律更新スポットトレンドライン",
    searchFilterTitle: "サーチ検索・ターゲットフィルター",
    quickStats: "量子模擬取引統計",
    detailTitle: "特定通貨シミュレーションボード",
    orderBookTitle: "模擬板情報オーダーブック (5档)",
    indicatorsTitle: "エンジン生成インジケータ",
    rsiLabel: "相対力指数 RSI (14 ticks)",
    macdLabel: "MACD ダイバージェンス信号",
    volume24h: "模擬24時間取引量",
    compareHeadline: "複数コイン相対成長アリーナ",
    compareSub: "15周期前の一番初期の価格を基準としパーセンテージ成長を1枚のグラフに統合して対決させます。(上限4通貨)",
    noSelectedCompare: "相場一覧、あるいは下の選択枠から「比較対象」をチェック（最大4個）すると、ここに連動折れ線グラフが描画されます！",
    metricCategory: "セクター分類",
    metricRSI: "RSI状態",
    metric1m: "1分騰落率",
    metric5m: "5分騰落率",
    metric24h: "24時間比較",
    metricHoldings: "保有高",
    clearCompare: "比較一覧をクリア",
    configSub: "下部エンジン速度、手数料比率、マルチ言語のオーバーライド変更が行えます。",
    optLatency: "ブロック心拍更新速度",
    optFee: "取引コミッション料率 (%)",
    optLeverage: "レバレッジ拡大倍率",
    btnReset: "初期資本 $100,000 を再充填",
    btnAirdrop: "緊急資金 $15,000 エアドロップ請求",
    notifyReset: "エアドロップが決済処理されました。模擬台帳が正常に初期化されました。",
    langLabel: "システムインターフェース言語",
    themeLabel: "ディスプレイモード切り替え"
  }
};

const Sparkline: React.FC<{ history: number[]; isPositive: boolean }> = ({ history, isPositive }) => {
  if (!history || history.length < 2) return null;
  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const points = history.map((val, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - (((val - min) / range) * (height - 6) + 3);
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const fillColor = isPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';
  const fillPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg className="w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polygon fill={fillColor} points={fillPoints} />
      <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const VortexApp: React.FC = () => {
  const { lang, setLang, dark, setDark } = useShell();
  const currentLocale = (lang === 'en' || lang === 'zh' || lang === 'ja') ? lang : 'zh';
  const trans = VORTEX_I18N[currentLocale] || VORTEX_I18N['zh'];

  // Root layout selected tab — driven by the URL so every tab click is a real
  // route (/vortex/market, /vortex/settings, …). Sub-state (coin / view / filter)
  // rides in the query string so it too is reflected in the address bar.
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const pathSeg = location.pathname.replace(/^\/vortex\/?/, '').split('/')[0];
  const activeTab: VortexTab = (VORTEX_TABS as readonly string[]).includes(pathSeg)
    ? (pathSeg as VortexTab)
    : 'market';
  const setActiveTab = (tab: VortexTab) => navigate(`/vortex/${tab}`);

  // /vortex with no sub-route → land on the market tab so the URL always names a page.
  useEffect(() => {
    if (!pathSeg) navigate('/vortex/market', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathSeg]);

  /** Set/replace one query param (keeps the others), reflected in the URL. */
  const setQueryParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set(key, value);
      return p;
    }, { replace: true });
  };

  // Multi-coin compare lists (max 4 IDs)
  const [compareIds, setCompareIds] = useState<string[]>(['btc', 'eth', 'sol']);

  // Toast stack
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (text: string, type: 'success' | 'info' | 'warning' | 'star' = 'info') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Primary states
  const [initDone, setInitDone] = useState(false);
  const [coins, setCoins] = useState<CoinAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Market category filter — reflected in the URL as ?cat=<category>.
  const selectedCategory = searchParams.get('cat') || 'all';
  const setSelectedCategory = (v: string) => setQueryParam('cat', v);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('vortex_bookmarks');
    return saved ? JSON.parse(saved) : ['btc', 'eth', 'sol'];
  });
  const [onlyShowBookmarked, setOnlyShowBookmarked] = useState(false);

  // Filter trend models toggle
  const [filterRising1m, setFilterRising1m] = useState(false);
  const [filterRising5m, setFilterRising5m] = useState(false);

  // Active individual coin — reflected in the URL as ?coin=<id>.
  const activeCoinId = searchParams.get('coin') || 'btc';
  const setActiveCoinId = (v: string) => setQueryParam('coin', v);

  // Layout View Mode (standard list vs high-density grid) — URL ?view=list|matrix.
  const viewMode: 'list' | 'matrix' = searchParams.get('view') === 'list' ? 'list' : 'matrix';
  const setViewMode = (v: 'list' | 'matrix') => setQueryParam('view', v);

  // Slider controls and transaction costs simulator configuration
  const [tickSpeed, setTickSpeed] = useState<number>(4500); // 4.5s heart beat default
  const [feePercent, setFeePercent] = useState<number>(0.1); // 0.1% cost 
  const [leverage, setLeverage] = useState<number>(5); // 5x leverage default factor

  // Ledger account variables
  const [cash, setCash] = useState<number>(() => {
    const saved = localStorage.getItem('vortex_crypto_cash');
    return saved ? parseFloat(saved) : 100000;
  });
  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = localStorage.getItem('vortex_crypto_positions');
    return saved ? JSON.parse(saved) : [
      { id: 'btc', symbol: 'BTC', quantity: 0.5, entryPrice: 66400, currentPrice: 68420, leverage: 5 },
      { id: 'eth', symbol: 'ETH', quantity: 2.2, entryPrice: 3350, currentPrice: 3512, leverage: 5 }
    ];
  });
  const [historyTrades, setHistoryTrades] = useState<HistoricTrade[]>(() => {
    const saved = localStorage.getItem('vortex_crypto_history');
    return saved ? JSON.parse(saved) : [
      { id: 'h1', symbol: 'BTC', type: 'BUY', amount: 33200, quantity: 0.5, price: 66400, pnl: 0, leverage: 5, time: '12:15' },
      { id: 'h2', symbol: 'ETH', type: 'BUY', amount: 7370, quantity: 2.2, price: 3350, pnl: 0, leverage: 5, time: '13:00' }
    ];
  });

  // Trade ticket form state
  const [tradeAmount, setTradeAmount] = useState<number>(5000);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');

  // Live heart rate
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoTickEnabled, setAutoTickEnabled] = useState<boolean>(true);

  // Order Book depth dynamic variables (regenerated every tick for high frequency effect)
  const [depthSeed, setDepthSeed] = useState<number>(0.8);

  // Populate coins assets with supplemental custom ones to make > 200
  useEffect(() => {
    const saved = localStorage.getItem('vortex_simulated_coins');
    if (saved) {
      try {
        setCoins(JSON.parse(saved));
        setInitDone(true);
        return;
      } catch (e) {}
    }

    const categories = ['L1', 'L2', 'DeFi', 'AI', 'Meme', 'Web3', 'DePIN', 'Payment', 'Oracle'];
    const generated: CoinAsset[] = [];

    // Base ones
    BASE_COINS.forEach(c => {
      const f1m = 1 + (Math.random() * 0.007 - 0.0033);
      const f5m = 1 + (Math.random() * 0.015 - 0.007);
      const f5h = 1 + (Math.random() * 0.06 - 0.027);
      const f24h = 1 + (Math.random() * 0.16 - 0.075);
      generated.push({
        id: c.symbol.toLowerCase(),
        symbol: c.symbol,
        name: c.name,
        category: c.category,
        price: c.price,
        price1mAgo: c.price / f1m,
        price5mAgo: c.price / f5m,
        price5hAgo: c.price / f5h,
        price24hAgo: c.price / f24h,
        history: Array.from({ length: 15 }, (_, i) => c.price * (1 + (Math.sin(i / 2) * 0.02) + (Math.random() * 0.014 - 0.007)))
      });
    });

    // Suppplement to exceed 205 tickers
    const prefixes = ['NEX', 'VORT', 'SOLO', 'ZEAL', 'ALPH', 'COSM', 'GRAV', 'HELI', 'LUMI', 'TERR', 'PULS', 'SPARK', 'FORG', 'AURA', 'SYN', 'NEUR', 'OCT', 'TIT', 'MET', 'ZEN', 'BLU', 'NEO', 'KRA', 'PHY'];
    const suffixes = ['FI', 'NET', 'CHAIN', 'LABS', 'FLOW', 'QUANT', 'BASE', 'AXIS', 'VORTEX', 'CAP', 'MINT', 'BLOCK', 'WEB', 'EDGE', 'SEC', 'X', 'LINK', 'ONE', 'HUB'];

    while (generated.length < 210) {
      const pref = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suff = suffixes[Math.floor(Math.random() * suffixes.length)];
      const tag = `${pref}${suff}`;
      if (generated.some(g => g.symbol === tag)) continue;

      const cat = categories[Math.floor(Math.random() * categories.length)];
      const startPrice = Math.random() < 0.15 ? Math.random() * 0.08 + 0.0001 :
                         Math.random() < 0.4 ? Math.random() * 2.5 + 0.1 :
                         Math.random() * 220 + 3;

      const f1m = 1 + (Math.random() * 0.01 - 0.0048);
      const f5m = 1 + (Math.random() * 0.022 - 0.01);
      const f5h = 1 + (Math.random() * 0.08 - 0.035);
      const f24h = 1 + (Math.random() * 0.22 - 0.1);

      generated.push({
        id: tag.toLowerCase(),
        symbol: tag,
        name: `${tag} Global Protocol`,
        category: cat,
        price: startPrice,
        price1mAgo: startPrice / f1m,
        price5mAgo: startPrice / f5m,
        price5hAgo: startPrice / f5h,
        price24hAgo: startPrice / f24h,
        history: Array.from({ length: 15 }, (_, i) => startPrice * (1 + (Math.cos(i / 3) * 0.03) + (Math.random() * 0.02 - 0.01)))
      });
    }

    setCoins(generated);
    localStorage.setItem('vortex_simulated_coins', JSON.stringify(generated));
    setInitDone(true);
  }, []);

  // Sync balances and positions values
  useEffect(() => {
    if (initDone) {
      localStorage.setItem('vortex_crypto_cash', cash.toString());
      localStorage.setItem('vortex_crypto_positions', JSON.stringify(positions));
      localStorage.setItem('vortex_crypto_history', JSON.stringify(historyTrades));
    }
  }, [cash, positions, historyTrades, initDone]);

  // Synchronous tick engine
  useEffect(() => {
    if (!autoTickEnabled || coins.length === 0) return;

    const interval = setInterval(() => {
      setDepthSeed(Math.random());
      setCoins(prev => {
        const mutated = prev.map(c => {
          // Brownian micro movements based on categoric volatility rating
          const modifier = c.category === 'Meme' ? 0.018 : c.category === 'AI' ? 0.009 : 0.0045;
          const range = Math.random() * modifier * 2 - modifier;
          const nextPrice = Math.max(0.0000001, c.price * (1 + range));
          const adjustedHistory = [...c.history.slice(1), nextPrice];

          // Drift past checkpoints periodically to ensure interval data updates
          const d1m = c.price1mAgo * (1 + (Math.random() * 0.002 - 0.001));
          const d5m = c.price5mAgo * (1 + (Math.random() * 0.003 - 0.0015));
          const d5h = c.price5hAgo * (1 + (Math.random() * 0.004 - 0.002));
          const d24h = c.price24hAgo * (1 + (Math.random() * 0.006 - 0.003));

          return {
            ...c,
            price: nextPrice,
            price1mAgo: d1m,
            price5mAgo: d5m,
            price5hAgo: d5h,
            price24hAgo: d24h,
            history: adjustedHistory
          };
        });
        localStorage.setItem('vortex_simulated_coins', JSON.stringify(mutated));
        return mutated;
      });
      setLastUpdated(new Date());
    }, tickSpeed);

    return () => clearInterval(interval);
  }, [autoTickEnabled, coins.length, tickSpeed]);

  // Derived indicators calculations
  const indicators = useMemo(() => {
    if (!activeCoinId || coins.length === 0) return { rsi: 50, trend: 'NEUTRAL', macdHeight: 0 };
    const cur = coins.find(c => c.id === activeCoinId);
    if (!cur || !cur.history || cur.history.length < 5) return { rsi: 50, trend: 'NEUTRAL', macdHeight: 0 };

    // Simply simulate RSI indicator bound based on historical arrays
    let up = 0;
    let down = 0;
    for (let i = 1; i < cur.history.length; i++) {
      const diff = cur.history[i] - cur.history[i - 1];
      if (diff > 0) up += diff;
      else down += Math.abs(diff);
    }
    const rs = up / (down || 1);
    const rsi = Math.round(100 - (100 / (1 + rs)));
    const trend = rsi > 64 ? 'OVERBOUGHT' : rsi < 36 ? 'OVERSOLD' : 'NEUTRAL';

    // MACD drift calculation representation
    const macdHeight = (cur.price - cur.price1mAgo) / (cur.price * 0.002);

    return { rsi, trend, macdHeight };
  }, [coins, activeCoinId]);

  // Derived limit depth arrays buy & ask orders book representation
  const orderBook = useMemo(() => {
    if (!activeCoinId || coins.length === 0) return { bids: [], asks: [] };
    const target = coins.find(c => c.id === activeCoinId);
    if (!target) return { bids: [], asks: [] };

    const bids: { price: number; amount: number; total: number }[] = [];
    const asks: { price: number; amount: number; total: number }[] = [];

    let bidAcc = 0;
    let askAcc = 0;

    for (let i = 1; i <= 5; i++) {
      // Bids representing lower pending blocks
      const bp = target.price * (1 - i * 0.0007);
      const bSize = (Math.sin(depthSeed + i) * 1.5 + 2) * (target.price > 1000 ? 0.2 : target.price > 10 ? 10 : 2000);
      bidAcc += bSize;
      bids.push({ price: bp, amount: Math.max(0.001, bSize), total: bidAcc });

      // Asks representing higher pending blocks
      const ap = target.price * (1 + i * 0.00065);
      const aSize = (Math.cos(depthSeed - i) * 1.5 + 2.1) * (target.price > 1000 ? 0.21 : target.price > 10 ? 11 : 2100);
      askAcc += aSize;
      asks.push({ price: ap, amount: Math.max(0.001, aSize), total: askAcc });
    }

    return { bids, asks: asks.reverse() }; // Asks descend downwards to spot
  }, [coins, activeCoinId, depthSeed]);

  // Selectable filters lists
  const categoriesList = useMemo(() => {
    if (coins.length === 0) return [];
    return ['all', ...Array.from(new Set(coins.map(c => c.category)))];
  }, [coins]);

  // Toggle favorite bookmark state
  const handleToggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
    addToast(bookmarkedIds.includes(id) ? "Target removed from watch bookmarks." : "Target added to watch bookmarks.", 'star');
  };

  // Toggle selected coins inside Compare Arena list
  const handleToggleCompareId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= 4) {
          addToast("Sandbox compares index restricted to maximum of 4 concurrent tokens!", 'warning');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // Filter tickers listing
  const filteredCoins = useMemo(() => {
    return coins.filter(coin => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matches = coin.symbol.toLowerCase().includes(q) || 
                        coin.name.toLowerCase().includes(q) ||
                        coin.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (selectedCategory !== 'all' && coin.category !== selectedCategory) {
        return false;
      }

      if (onlyShowBookmarked && !bookmarkedIds.includes(coin.id)) {
        return false;
      }

      if (filterRising1m && coin.price <= coin.price1mAgo) {
        return false;
      }

      if (filterRising5m && coin.price <= coin.price5mAgo) {
        return false;
      }

      return true;
    });
  }, [coins, searchQuery, selectedCategory, onlyShowBookmarked, bookmarkedIds, filterRising1m, filterRising5m]);

  // Asset sum valuation calculations
  const portfolioSummary = useMemo(() => {
    let holdingsTotal = 0;
    let costBasisTotal = 0;

    positions.forEach(pos => {
      const liveC = coins.find(c => c.id === pos.id);
      const currentPrice = liveC ? liveC.price : pos.currentPrice;
      const originalValue = pos.quantity * pos.entryPrice;
      const currentValue = pos.quantity * currentPrice;
      
      holdingsTotal += currentValue;
      costBasisTotal += originalValue;
    });

    const netWorth = cash + holdingsTotal;
    const totalPnL = holdingsTotal - costBasisTotal;
    const realizedNet = historyTrades.reduce((acc, t) => acc + t.pnl, 0);

    return {
      netWorth,
      holdingsTotal,
      totalPnL,
      realizedNet
    };
  }, [cash, positions, coins, historyTrades]);

  // Selected coin for orders card
  const activeCoin = useMemo(() => {
    return coins.find(c => c.id === activeCoinId) || coins[0] || null;
  }, [coins, activeCoinId]);

  // Execute trade transaction
  const executeSimulatedTrade = (type: 'BUY' | 'SELL') => {
    if (!activeCoin) return;
    if (tradeAmount <= 0) return;

    const commissionFactor = 1 + (type === 'BUY' ? (feePercent / 100) : -(feePercent / 100));

    if (type === 'BUY') {
      const realCost = tradeAmount;
      if (cash < realCost) {
        addToast(trans.insufficientFunds, 'warning');
        return;
      }

      const allocatedForTokens = realCost / commissionFactor;
      // Received tokens under leverage (leverage multiplies buying power)
      const tokenQuantity = (allocatedForTokens * leverage) / activeCoin.price;

      setCash(prev => prev - realCost);
      setPositions(prev => {
        const existIdx = prev.findIndex(p => p.id === activeCoin.id);
        if (existIdx > -1) {
          const res = [...prev];
          const matched = res[existIdx];
          const combinedQty = matched.quantity + tokenQuantity;
          const weightedPrice = ((matched.quantity * matched.entryPrice) + (tokenQuantity * activeCoin.price)) / combinedQty;
          res[existIdx] = {
            ...matched,
            quantity: combinedQty,
            entryPrice: weightedPrice,
            currentPrice: activeCoin.price,
            leverage
          };
          return res;
        } else {
          return [...prev, {
            id: activeCoin.id,
            symbol: activeCoin.symbol,
            quantity: tokenQuantity,
            entryPrice: activeCoin.price,
            currentPrice: activeCoin.price,
            leverage
          }];
        }
      });

      // Append trade history logs
      setHistoryTrades(prev => [
        {
          id: 'tx-' + Math.random().toString(36).substring(2, 6) + Date.now(),
          symbol: activeCoin.symbol,
          type: 'BUY',
          amount: realCost,
          quantity: tokenQuantity,
          price: activeCoin.price,
          pnl: 0,
          leverage,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ]);

      addToast(`${trans.orderSuccess} ${type} ${tokenQuantity.toFixed(4)} ${activeCoin.symbol} (Leverage: ${leverage}x)`, 'success');
    } else {
      // Selling / Liquidating specific quantity mapping to allocation value
      const targetPos = positions.find(p => p.id === activeCoin.id);
      if (!targetPos) {
        addToast("No current active position of this asset found in simulated portfolio!", 'warning');
        return;
      }

      const totalValueHeld = targetPos.quantity * activeCoin.price;
      const pctToSell = Math.min(1, tradeAmount / totalValueHeld);
      if (pctToSell <= 0) return;

      const soldQuantity = targetPos.quantity * pctToSell;
      const initialBasisSold = soldQuantity * targetPos.entryPrice;
      const proceedsRaw = soldQuantity * activeCoin.price;
      const realProceedsRefunded = proceedsRaw / commissionFactor;

      // Realized profit calculation factoring margin configuration
      const pnlRealized = realProceedsRefunded - initialBasisSold;

      setCash(prev => prev + realProceedsRefunded);
      setPositions(prev => {
        return prev.map(p => {
          if (p.id === activeCoin.id) {
            return {
              ...p,
              quantity: p.quantity - soldQuantity
            };
          }
          return p;
        }).filter(p => p.quantity > 0.0001);
      });

      setHistoryTrades(prev => [
        {
          id: 'tx-' + Math.random().toString(36).substring(2, 6) + Date.now(),
          symbol: activeCoin.symbol,
          type: 'SELL',
          amount: realProceedsRefunded,
          quantity: soldQuantity,
          price: activeCoin.price,
          pnl: pnlRealized,
          leverage: targetPos.leverage,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ]);

      addToast(`Liquidated ${soldQuantity.toFixed(4)} ${activeCoin.symbol} generating $${realProceedsRefunded.toFixed(2)} USDT proceeds.`, 'success');
    }
  };

  // Liquidation trigger
  const handleLiquidateWholePosition = (pos: Position) => {
    const freshData = coins.find(c => c.id === pos.id);
    const sellPrice = freshData ? freshData.price : pos.currentPrice;
    const rawWorth = pos.quantity * sellPrice;
    
    const commissionDeducted = rawWorth * (1 - (feePercent / 100));
    const basisCost = pos.quantity * pos.entryPrice;
    const profit = commissionDeducted - basisCost;

    setCash(prev => prev + commissionDeducted);
    setPositions(prev => prev.filter(p => p.id !== pos.id));
    setHistoryTrades(prev => [
      {
        id: 'tx-' + Math.random().toString(36).substring(2, 6) + Date.now(),
        symbol: pos.symbol,
        type: 'SELL',
        amount: commissionDeducted,
        quantity: pos.quantity,
        price: sellPrice,
        pnl: profit,
        leverage: pos.leverage,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev
    ]);

    addToast(`Position ${pos.symbol} liquidated instantly at execution rate $${sellPrice.toFixed(4)}.`, 'info');
  };

  // Reset states
  const triggerPortfolioReset = () => {
    setCash(100000);
    setPositions([]);
    setHistoryTrades([]);
    localStorage.removeItem('vortex_crypto_cash');
    localStorage.removeItem('vortex_crypto_positions');
    localStorage.removeItem('vortex_crypto_history');
    addToast(trans.notifyReset, 'success');
  };

  // Inject sample balance air-drop
  const triggerAirdrop = () => {
    setCash(prev => prev + 15000);
    addToast("Successfully deposited complimentary +$15,000 USDT mock margin!", 'success');
  };

  return (
    <div className={`min-h-screen pb-20 transition-colors duration-350 ${
      dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Toast alert system stack */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 border pointer-events-auto text-xs ${
                dark 
                  ? 'bg-slate-900/95 border-emerald-500/20 text-slate-200 shadow-emerald-500/5' 
                  : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/5'
              }`}
            >
              <div className="p-1 px-1.5 bg-indigo-500/10 text-indigo-400 rounded-md font-bold">
                *
              </div>
              <p className="font-semibold leading-relaxed pr-2">{t.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modern High-contrast atmospheric dashboard banner */}
      <div className="relative border-b border-white/5 py-8 px-6 lg:px-8 overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white">
        {/* Abstract glowing graphics */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="flex items-center gap-1 text-[10px] tracking-widest font-bold uppercase py-1 px-2.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono">
                <Compass className="w-3.5 h-3.5 animate-spin animate-duration-3000" />
                Vortex Quant Sandbox L4
              </span>
              <span className="text-[10px] tracking-widest font-bold uppercase py-1 px-2.5 rounded-full bg-indigo-500/15 text-indigo-400 font-mono">
                {coins.length}+ Assets online
              </span>
            </div>

            <h1 className="text-3px font-extrabold tracking-tight text-white flex items-center gap-2 flex-wrap">
              <span className="bg-gradient-to-r from-emerald-450 to-teal-400 bg-clip-text text-transparent">
                {trans.title}
              </span>
              <span className="text-sm font-mono text-slate-400 border border-slate-800 px-2 py-0.5 rounded-md">V2.4</span>
            </h1>
            <p className="text-xs text-slate-450 mt-1.5 font-medium leading-relaxed max-w-2xl">
              {trans.subtitle}
            </p>
          </div>

          {/* Connected heartbeat clock */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-lg">
            <div>
              <p className="text-[9px] uppercase font-mono text-zinc-400 tracking-wider flex items-center gap-1 justify-end">
                <Activity className="w-3 h-3 text-emerald-400" />
                {trans.updatedAt}
              </p>
              <p className="text-xs font-mono font-bold text-indigo-400 mt-0.5 text-right">
                {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
            
            <button
              onClick={() => {
                setAutoTickEnabled(v => !v);
                addToast(autoTickEnabled ? "Auto heart rate paused." : "Auto heart rate resumed.", 'info');
              }}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                autoTickEnabled 
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                  : 'bg-zinc-500/10 border-zinc-500/10 text-zinc-400'
              }`}
              title="Pause Ticker Engine"
            >
              {autoTickEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Glassmorphism navigation dock toggler */}
      <div className={`sticky top-0 z-40 border-b ${
        dark ? 'bg-slate-950/80 border-white/5' : 'bg-white/90 border-slate-200'
      } backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between py-2 overflow-x-auto no-scrollbar">
          
          <div className="flex items-center gap-1">
            {[
              { id: 'market', label: trans.tabMarket, icon: Compass },
              { id: 'compare', label: trans.tabCompare, icon: SlidersHorizontal },
              { id: 'ledger', label: trans.tabLedger, icon: Briefcase },
              { id: 'okx-backtest', label: trans.tabOkx, icon: Database },
              { id: 'settings', label: trans.tabSettings, icon: Settings },
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? dark
                        ? 'text-white'
                        : 'text-slate-900 bg-slate-100'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-500' : ''}`} />
                  <span>{tab.label}</span>
                  {isSelected && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Language Toggle */}
            <div className="flex items-center bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl p-0.5 shadow-inner">
              {[
                { code: 'zh', short: '中' },
                { code: 'en', short: 'EN' },
                { code: 'ja', short: '日' }
              ].map(item => {
                const isActive = lang === item.code;
                return (
                  <button
                    key={item.code}
                    onClick={() => {
                      setLang(item.code);
                      addToast(item.code === 'zh' ? "已切换至中文界面" : item.code === 'ja' ? "日本語に切り替えました" : "Interface switched to English", 'info');
                    }}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400'
                    }`}
                  >
                    {item.short}
                  </button>
                );
              })}
            </div>

            {/* Quick Theme Toggle */}
            <button
              onClick={() => {
                const draftDark = !dark;
                setDark(draftDark);
                addToast(draftDark ? "Atmospheric Cyber (Dark) Mode" : "Clean Corporate (Light) Mode", 'success');
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                dark 
                  ? 'bg-white/5 border-white/5 text-amber-400 hover:bg-white/10' 
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200 shadow-sm'
              }`}
              title={dark ? "Clean Corporate (Light) Mode" : "Atmospheric Cyber (Dark) Mode"}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Quick status values */}
            <div className="hidden sm:flex flex-col text-right font-mono text-[10px] text-slate-500 dark:text-slate-400">
              <span className={`font-bold text-xs ${dark ? 'text-slate-400' : 'text-slate-800'}`}>
                ${portfolioSummary.netWorth.toLocaleString(undefined, { maximumFractionDigits: 1 })} USDT
              </span>
              <span>Available Cash: ${cash.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
            
            <div className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[9px] uppercase font-bold hidden md:block">
              SANDBOX SIM ACTIVE
            </div>
          </div>

        </div>
      </div>

      {/* Main core portfolio stats tiles banner */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          <div className={`p-4.5 rounded-2xl border ${
            dark ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200'
          } shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-bold">{trans.totalWealth}</span>
                <Wallet className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-slate-800 dark:text-slate-100 mt-2">
                ${portfolioSummary.netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[9px] text-zinc-500 font-mono mt-2 uppercase">Estimate holding + cash net worth</p>
          </div>

          <div className={`p-4.5 rounded-2xl border ${
            dark ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200'
          } shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-bold">{trans.availableCash}</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-emerald-500 mt-2">
                ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[9px] text-emerald-600 font-bold font-mono mt-2 uppercase">100% liquifiable margin balance</p>
          </div>

          <div className={`p-4.5 rounded-2xl border ${
            dark ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200'
          } shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-bold">{trans.holdingValue}</span>
                <Coins className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-slate-800 dark:text-slate-100 mt-2">
                ${portfolioSummary.holdingsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[9px] text-indigo-500 font-mono mt-2 uppercase">Spot tokens evaluated in real-time</p>
          </div>

          <div className={`p-4.5 rounded-2xl border ${
            dark ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200'
          } shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-bold">{trans.unrealizedPnL}</span>
                <span className={`text-[10px] font-bold py-0.5 px-2 rounded ${
                  portfolioSummary.totalPnL >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                }`}>
                  {portfolioSummary.totalPnL >= 0 ? '+' : ''}
                  {((portfolioSummary.totalPnL / (portfolioSummary.holdingsTotal || 100000)) * 100).toFixed(2)}%
                </span>
              </div>
              <p className={`text-2xl font-black font-mono tracking-tight mt-2 ${
                portfolioSummary.totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {portfolioSummary.totalPnL >= 0 ? '+' : ''}
                ${portfolioSummary.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[9px] text-zinc-500 font-mono mt-2">
              REALIZED PROFIT NET: <span className={portfolioSummary.realizedNet >= 0 ? 'text-emerald-500' : 'text-rose-500'}>${portfolioSummary.realizedNet.toFixed(2)}</span>
            </p>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <AnimatePresence mode="wait">
          
          {/* ====== TAB 1: MARKET VIEW FLIGHTS ====== */}
          {activeTab === 'market' && (
            <motion.div
              key="market"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left filter options & lists directory column */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Advanced filter engine card */}
                <div className={`p-4.5 rounded-2xl border ${
                  dark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
                } relative`}>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                    {trans.searchFilterTitle}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Keyboard search element */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={trans.searchPlaceholder}
                        className={`w-full text-xs font-semibold pl-9 pr-8 py-2.5 rounded-xl border focus:outline-none transition ${
                          dark 
                            ? 'bg-slate-950/70 border-white/5 text-slate-100 focus:border-indigo-500/50' 
                            : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-indigo-500/50'
                        }`}
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-zinc-500 hover:text-indigo-450"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {/* Sector filter */}
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer ${
                          dark 
                            ? 'bg-slate-950 border-white/5 text-slate-200' 
                            : 'bg-slate-100 border-slate-200 text-slate-900'
                        }`}
                      >
                        {categoriesList.map(cat => (
                          <option key={cat} value={cat}>
                            {cat === 'all' ? trans.categoryAll : `${cat} Sector`}
                          </option>
                        ))}
                      </select>

                      {/* Watch bookmarks toggler filter */}
                      <button
                        onClick={() => setOnlyShowBookmarked(v => !v)}
                        className={`px-3.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition duration-200 cursor-pointer ${
                          onlyShowBookmarked
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400'
                            : dark
                              ? 'bg-slate-950/50 border-white/5 text-zinc-400 hover:border-slate-700'
                              : 'bg-transparent border-slate-200 text-zinc-650 hover:bg-slate-100'
                        }`}
                        title={trans.onlyBookmarked}
                      >
                        {onlyShowBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        <span className="hidden sm:inline">Star</span>
                      </button>
                    </div>

                  </div>

                  {/* Interval filters quick block */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/5">
                    <button
                      onClick={() => setFilterRising1m(v => !v)}
                      className={`py-2 px-3.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        filterRising1m
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : dark 
                            ? 'bg-slate-950/40 border-white/5 text-zinc-400 hover:bg-slate-900'
                            : 'bg-transparent border-slate-200 text-zinc-650 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{trans.filter1m}</span>
                      {filterRising1m && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>

                    <button
                      onClick={() => setFilterRising5m(v => !v)}
                      className={`py-2 px-3.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        filterRising5m
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : dark 
                            ? 'bg-slate-950/40 border-white/5 text-zinc-400 hover:bg-slate-900'
                            : 'bg-transparent border-slate-200 text-zinc-650 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{trans.filter5m}</span>
                      {filterRising5m && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>

                    <div className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 font-semibold">
                      <span>Matches:</span>
                      <span className="font-black text-indigo-400">{filteredCoins.length} / {coins.length}</span>
                    </div>
                  </div>
                </div>

                {/* Primary tickers dynamic grid */}
                <div className={`rounded-2xl border overflow-hidden ${
                  dark ? 'bg-slate-900/20 border-white/5' : 'bg-white border-slate-250'
                }`}>
                  <div className="p-4 border-b border-white/5 bg-slate-900/5 flex items-center justify-between flex-wrap gap-3 text-slate-400 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span>{trans.tblToken}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">({filteredCoins.length} filtered)</span>
                    </div>

                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/5 gap-1 shadow-inner">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`py-1 px-2.5 rounded-lg text-[10px] font-mono tracking-tight font-black transition-all cursor-pointer ${
                          viewMode === 'list'
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-350 bg-transparent border border-transparent'
                        }`}
                      >
                        List View
                      </button>
                      <button
                        onClick={() => setViewMode('matrix')}
                        className={`py-1 px-2.5 rounded-lg text-[10px] font-mono tracking-tight font-black transition-all cursor-pointer ${
                          viewMode === 'matrix'
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-350 bg-transparent border border-transparent'
                        }`}
                      >
                        Live Wall (200+ Trends)
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[640px] overflow-y-auto no-scrollbar">
                    {viewMode === 'matrix' ? (
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filteredCoins.map((coin) => {
                          const isFocused = coin.id === activeCoinId;
                          const isBookmarked = bookmarkedIds.includes(coin.id);
                          const isSelectedCompare = compareIds.includes(coin.id);
                          const delta24h = (coin.price - coin.price24hAgo) / coin.price24hAgo * 100;

                          return (
                            <div
                              key={coin.id}
                              onClick={() => setActiveCoinId(coin.id)}
                              className={`p-3 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between h-32 group cursor-pointer ${
                                isFocused
                                  ? dark
                                    ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/5'
                                    : 'bg-indigo-50 border-indigo-400'
                                  : dark
                                    ? 'bg-slate-950/60 border-white/5 hover:border-slate-800 hover:bg-slate-950'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {/* Top row: Star bookmark + Symbol */}
                              <div className="flex items-center justify-between gap-1 w-full">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className="font-extrabold text-xs font-mono tracking-tight text-slate-250 dark:text-slate-100 truncate">
                                    {coin.symbol}
                                  </span>
                                  <span className={`text-[8px] px-1 py-0.5 rounded uppercase font-bold scale-90 ${
                                    dark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {coin.category}
                                  </span>
                                </div>
                                
                                <span className={`text-[10px] font-mono font-bold shrink-0 ${
                                  delta24h >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  {delta24h >= 0 ? '+' : ''}{delta24h.toFixed(1)}%
                                </span>
                              </div>

                              {/* Real-time high frequency Sparkline graph */}
                              <div className="h-10 my-2 w-full relative flex items-center justify-center bg-slate-900/5 p-1 rounded-lg">
                                <Sparkline history={coin.history} isPositive={delta24h >= 0} />
                              </div>

                              {/* Footer: Price */}
                              <div className="flex items-center justify-between text-[10px] font-mono w-full">
                                <button
                                  onClick={(e) => handleToggleBookmark(coin.id, e)}
                                  className={`p-1 rounded text-zinc-550 hover:text-amber-500 transition-colors ${
                                    isBookmarked ? 'text-amber-500' : ''
                                  }`}
                                >
                                  ★
                                </button>
                                <span className="font-black text-slate-200 dark:text-slate-200 text-xs">
                                  ${coin.price > 100
                                    ? coin.price.toFixed(2)
                                    : coin.price > 1
                                      ? coin.price.toFixed(3)
                                      : coin.price.toFixed(5)
                                  }
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {filteredCoins.map((coin, index) => {
                          const isFocused = coin.id === activeCoinId;
                          const isBookmarked = bookmarkedIds.includes(coin.id);
                          const isSelectedCompare = compareIds.includes(coin.id);

                          const delta1m = (coin.price - coin.price1mAgo) / coin.price1mAgo * 100;
                          const delta5m = (coin.price - coin.price5mAgo) / coin.price5mAgo * 100;
                          const delta24h = (coin.price - coin.price24hAgo) / coin.price24hAgo * 100;

                          return (
                            <div
                              key={coin.id}
                              onClick={() => setActiveCoinId(coin.id)}
                              className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 cursor-pointer ${
                                isFocused
                                  ? dark
                                    ? 'bg-indigo-500/10 border-l-4 border-indigo-500'
                                    : 'bg-indigo-50 border-l-4 border-indigo-500'
                                  : dark
                                    ? 'hover:bg-white/5'
                                    : 'hover:bg-slate-100/50'
                              }`}
                            >
                              {/* Left attributes cell */}
                              <div className="flex items-center gap-3 min-w-[200px]">
                                {/* Star watcher */}
                                <button
                                  onClick={(e) => handleToggleBookmark(coin.id, e)}
                                  className={`p-1.5 rounded-lg border transition ${
                                    isBookmarked 
                                      ? 'bg-amber-500/10 border-amber-550/20 text-amber-500' 
                                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-400'
                                  }`}
                                >
                                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                                </button>

                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-sm font-mono tracking-tight text-slate-250 dark:text-slate-150">
                                      {coin.symbol}
                                    </span>
                                    <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-bold ${
                                      dark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {coin.category}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-550 line-clamp-1 mt-0.5">{coin.name}</span>
                                </div>
                              </div>

                              {/* Dynamic Spot price + 1m/5m/24h comparisons */}
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 items-center text-right">
                                
                                <div>
                                  <span className="text-[9px] text-zinc-500 font-mono block md:hidden">Spot price:</span>
                                  <span className="font-mono font-black text-xs text-slate-250 dark:text-slate-150">
                                    ${coin.price > 100
                                      ? coin.price.toFixed(2)
                                      : coin.price > 1
                                        ? coin.price.toFixed(4)
                                        : coin.price.toFixed(6)
                                    }
                                  </span>
                                </div>

                                {/* Live inline Sparkline trend in list row */}
                                <div className="hidden lg:block h-6 px-4">
                                  <Sparkline history={coin.history} isPositive={delta24h >= 0} />
                                </div>

                                <div>
                                  <span className="text-[9px] text-zinc-500 font-mono block md:hidden">1m gain:</span>
                                  <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold ${
                                    delta1m >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                  }`}>
                                    {delta1m >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                    {delta1m.toFixed(2)}%
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[9px] text-zinc-500 font-mono block md:hidden">5m gain:</span>
                                  <span className={`text-xs font-mono font-bold ${
                                    delta5m >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                  }`}>
                                    {delta5m >= 0 ? '+' : ''}{delta5m.toFixed(2)}%
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[9px] text-zinc-500 font-mono block md:hidden">24h comparison:</span>
                                  <span className={`text-xs font-mono font-bold ${
                                    delta24h >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                  }`}>
                                    {delta24h >= 0 ? '+' : ''}{delta24h.toFixed(1)}%
                                  </span>
                                </div>

                              </div>

                              {/* Compare checking trigger */}
                              <div className="flex items-center justify-end md:pl-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => handleToggleCompareId(coin.id, e)}
                                  className={`p-1 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 transition ${
                                    isSelectedCompare
                                      ? 'bg-indigo-500/10 border-indigo-550/30 text-indigo-400'
                                      : dark
                                        ? 'bg-transparent border-white/5 text-slate-500 hover:text-slate-350'
                                        : 'bg-transparent border-slate-205 text-slate-600 hover:bg-slate-50'
                                  }`}
                                  title="Compare target in super overlay"
                                >
                                  {isSelectedCompare ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                  <span className="hidden xl:inline">Compare</span>
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}

                    {filteredCoins.length === 0 && (
                      <div className="p-12 text-center text-xs font-mono text-zinc-500">
                        No digital assets matches active search configuration. Clear filters to explore!
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right column detailed information box & live depth order book */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Micro trend charts */}
                {activeCoin && (
                  <div className={`p-4.5 rounded-2xl border ${
                    dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200'
                  }`}>
                    
                    <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                      <div>
                        <span className="text-[9px] text-indigo-400 font-mono uppercase tracking-widest font-black">
                          {activeCoin.category} Sector • Ticker Spotlight
                        </span>
                        <h4 className="font-extrabold text-lg font-mono text-slate-100 dark:text-slate-100">
                          {activeCoin.symbol} / USDT
                        </h4>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-mono">{activeCoin.name}</p>
                        <span className="text-xs font-mono font-extrabold text-indigo-500">
                          ${activeCoin.price.toFixed(activeCoin.price > 100 ? 2 : 4)}
                        </span>
                      </div>
                    </div>

                    {/* Single Coin simulated heart SVG Wave */}
                    <div className="h-24 w-full relative">
                      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                        <defs>
                          <linearGradient id={`spot-${activeCoin.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {activeCoin.history && activeCoin.history.length > 1 && (() => {
                          const max = Math.max(...activeCoin.history);
                          const min = Math.min(...activeCoin.history);
                          const range = max - min || 1;

                          const pts = activeCoin.history.map((val, i) => {
                            const x = (i / (activeCoin.history.length - 1)) * 340;
                            const y = 90 - (((val - min) / range) * 75 + 10);
                            return `${x},${y}`;
                          }).join(' ');

                          const basePts = `0,96 ${pts} 340,96`;
                          return (
                            <>
                              <polyline fill={`url(#spot-${activeCoin.id})`} points={basePts} />
                              <polyline fill="none" stroke="#10b981" strokeWidth="2" points={pts} />
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-2 border-t border-white/5 mt-3">
                      <span>15 Hart Ticks Ago</span>
                      <span>Asset live performance profile</span>
                      <span>Spot Now</span>
                    </div>

                  </div>
                )}

                {/* Simulated Order Book Drawer/Component */}
                {activeCoin && (
                  <div className={`p-4.5 rounded-2xl border ${
                    dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-205'
                  }`}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      {trans.orderBookTitle} (Depth)
                    </h3>

                    {/* Order depth book list wrapper */}
                    <div className="space-y-1 font-mono text-[11px]">
                      
                      {/* ASKS (SELLS) */}
                      <div className="space-y-0.5">
                        {orderBook.asks.map((ask, idx) => {
                          const maxTotal = Math.max(...orderBook.asks.map(a => a.total), ...orderBook.bids.map(b => b.total)) || 1;
                          const ratio = (ask.total / maxTotal) * 100;
                          return (
                            <div key={`ask-${idx}`} className="relative py-0.5 flex items-center justify-between hover:bg-rose-500/5 px-2 rounded-md">
                              <div className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none" style={{ width: `${ratio}%` }} />
                              <span className="text-rose-500 font-bold">${ask.price.toFixed(activeCoin.price > 100 ? 2 : 4)}</span>
                              <span className="text-zinc-400 z-10">{ask.amount.toFixed(2)}</span>
                              <span className="text-zinc-550 text-[10px] hidden md:inline z-10">{ask.total.toFixed(1)}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Current Spot line */}
                      <div className="py-2.5 my-1.5 border-y border-dashed border-white/5 text-center flex items-center justify-between px-2 bg-slate-900/10">
                        <span className="text-xs font-extrabold text-slate-350 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-indigo-400" />
                          Spot rate:
                        </span>
                        <span className="font-extrabold text-indigo-400 tracking-tight">
                          ${activeCoin.price.toFixed(activeCoin.price > 100 ? 2 : 4)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                          ▲ {((activeCoin.price - activeCoin.price1mAgo) / activeCoin.price1mAgo * 100).toFixed(3)}%
                        </span>
                      </div>

                      {/* BIDS (BUYS) */}
                      <div className="space-y-0.5">
                        {orderBook.bids.map((bid, idx) => {
                          const maxTotal = Math.max(...orderBook.asks.map(a => a.total), ...orderBook.bids.map(b => b.total)) || 1;
                          const ratio = (bid.total / maxTotal) * 100;
                          return (
                            <div key={`bid-${idx}`} className="relative py-0.5 flex items-center justify-between hover:bg-emerald-500/5 px-2 rounded-md">
                              <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none" style={{ width: `${ratio}%` }} />
                              <span className="text-emerald-500 font-bold">${bid.price.toFixed(activeCoin.price > 100 ? 2 : 4)}</span>
                              <span className="text-zinc-400 z-10">{bid.amount.toFixed(2)}</span>
                              <span className="text-zinc-550 text-[10px] hidden md:inline z-10">{bid.total.toFixed(1)}</span>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                )}

                {/* Sub-engine indicator panel */}
                {activeCoin && (
                  <div className={`p-4.5 rounded-2xl border ${
                    dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-205'
                  }`}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-2">
                      <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                      {trans.indicatorsTitle}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                      
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                        <span className="text-zinc-500 block text-[10px]">{trans.rsiLabel}</span>
                        <span className={`text-base font-black tracking-tight block mt-1.5 ${
                          indicators.rsi > 64 ? 'text-amber-500' : indicators.rsi < 36 ? 'text-cyan-500' : 'text-slate-200 dark:text-slate-100'
                        }`}>
                          {indicators.rsi} ({indicators.trend})
                        </span>
                        <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${indicators.rsi}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                        <span className="text-zinc-500 block text-[10px]">{trans.macdLabel}</span>
                        <span className={`text-base font-black tracking-tight block mt-1.5 ${
                          indicators.macdHeight >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {indicators.macdHeight >= 0 ? 'BUY SIGNAL' : 'SELL SIGNAL'}
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-1">Convergence drift: {indicators.macdHeight.toFixed(4)}</p>
                      </div>

                    </div>
                  </div>
                )}

                {/* Form quick execution cabinet */}
                {activeCoin && (
                  <div className={`p-5 rounded-2xl border ${
                    dark ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-450 border-b border-white/5 pb-2.5 mb-4 flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                      {trans.actionTrade}
                    </h3>

                    {/* Order Side switch */}
                    <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-950 p-1 rounded-xl">
                      <button
                        onClick={() => setTradeType('BUY')}
                        className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          tradeType === 'BUY'
                            ? 'bg-emerald-500 text-white shadow-lg'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        BUY / LONG
                      </button>

                      <button
                        onClick={() => setTradeType('SELL')}
                        className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          tradeType === 'SELL'
                            ? 'bg-rose-500 text-white shadow-lg'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        SELL / SHORT
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Max size config */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                          <span>{trans.amountUSDT}</span>
                          <span>Cash: ${cash.toFixed(2)}</span>
                        </div>

                        <div className="relative mt-2">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-550 font-mono font-bold">$</span>
                          <input
                            type="number"
                            min="1"
                            value={tradeAmount}
                            onChange={(e) => setTradeAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                            className={`w-full text-xs font-black pl-7 pr-16 py-2.5 rounded-xl border focus:outline-none focus:border-indigo-500 font-mono ${
                              dark 
                                ? 'bg-slate-950 border-white/5 text-slate-100' 
                                : 'bg-slate-100 border-slate-200 text-slate-900'
                            }`}
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 font-bold">USDT</span>
                        </div>

                        {/* Speed keys */}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {[1000, 5000, 10000, 25000].map(val => (
                            <button
                              key={val}
                              onClick={() => setTradeAmount(val)}
                              className={`py-1 rounded-lg text-[9px] font-mono font-bold border transition cursor-pointer ${
                                tradeAmount === val
                                  ? 'bg-indigo-500/15 border-indigo-550/30 text-indigo-400'
                                  : dark
                                    ? 'bg-transparent border-white/5 text-zinc-600 hover:border-zinc-400'
                                    : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              ${val}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Config leverage row */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                          <span>{trans.optLeverage}</span>
                          <span className="font-bold text-indigo-400">{leverage}x Cross Margin</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                          {[1, 5, 10, 20].map(lev => (
                            <button
                              key={lev}
                              onClick={() => setLeverage(lev)}
                              className={`py-1 text-[10px] font-mono font-bold border rounded-lg transition cursor-pointer ${
                                leverage === lev
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                                  : dark
                                    ? 'bg-transparent border-white/5 text-zinc-650'
                                    : 'bg-transparent border-slate-200 text-slate-605'
                              }`}
                            >
                              {lev}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl border flex items-center justify-between font-mono text-xs ${
                        dark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-100 border-slate-205'
                      }`}>
                        <span className="text-zinc-500 font-bold">{trans.quantity}</span>
                        <span className="font-extrabold text-indigo-400">
                          {((tradeAmount * leverage) / activeCoin.price).toFixed(5)} {activeCoin.symbol}
                        </span>
                      </div>

                      <button
                        onClick={() => executeSimulatedTrade(tradeType)}
                        className={`w-full py-3 rounded-xl text-xs font-black tracking-widest uppercase shadow-lg transition active:scale-[0.98] cursor-pointer ${
                          tradeType === 'BUY'
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10'
                            : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10'
                        }`}
                      >
                        {tradeType === 'BUY' ? trans.actionBuy : trans.actionSell}
                      </button>

                    </div>
                  </div>
                )}
                
              </div>
            </motion.div>
          )}

          {/* ====== TAB 2: COMPARE ARENA FLIGHTS ====== */}
          {activeTab === 'compare' && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className={`p-6 rounded-2xl border ${
                dark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
              }`}>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">{trans.compareHeadline}</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">{trans.compareSub}</p>
                  </div>

                  {compareIds.length > 0 && (
                    <button
                      onClick={() => {
                        setCompareIds([]);
                        addToast("Cleared sandbox comparisons lineup.", 'info');
                      }}
                      className="text-xs font-bold text-rose-550 border border-rose-500/20 py-1.5 px-3 rounded-xl hover:bg-rose-500/10 cursor-pointer"
                    >
                      {trans.clearCompare}
                    </button>
                  )}
                </div>

                {/* Overlaid percentage rendering line SVG stack */}
                {compareIds.length > 0 ? (
                  <div className="space-y-6">
                    
                    {/* Normalized index overlay graph */}
                    <div className={`p-4 rounded-xl border relative h-64 ${
                      dark ? 'bg-slate-950/70 border-white/5' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <div className="absolute top-2 left-3 text-[9px] uppercase font-mono text-indigo-400 font-black">
                        Normalized cumulative growth (%) comparing last 15 ticks
                      </div>

                      {/* 0% Baseline axis */}
                      <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-500/20 pointer-events-none" />

                      <svg className="w-full h-full overflow-visible pointer-events-none" viewBox="0 0 500 220" preserveAspectRatio="none">
                        {compareIds.map((id, index) => {
                          const coin = coins.find(c => c.id === id);
                          if (!coin || !coin.history || coin.history.length < 2) return null;

                          // Color schemes
                          const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e'];
                          const activeColor = colors[index % colors.length];

                          // Percentage gains normalize
                          const basePrice = coin.history[0] || 1;
                          const normHistory = coin.history.map(val => ((val - basePrice) / basePrice) * 100);

                          const minVal = Math.min(...normHistory, -5);
                          const maxVal = Math.max(...normHistory, 5);
                          const valRange = maxVal - minVal || 1;

                          const pts = normHistory.map((val, tickIdx) => {
                            const x = (tickIdx / (normHistory.length - 1)) * 500;
                            const y = 200 - (((val - minVal) / valRange) * 170 + 15);
                            return `${x},${y}`;
                          }).join(' ');

                          return (
                            <polyline
                              key={id}
                              fill="none"
                              stroke={activeColor}
                              strokeWidth="3.5"
                              points={pts}
                              className="transition-all duration-300"
                            />
                          );
                        })}
                      </svg>

                      {/* Graph legend boxes */}
                      <div className="absolute bottom-2 flex flex-wrap gap-4 px-2">
                        {compareIds.map((id, index) => {
                          const coin = coins.find(c => c.id === id);
                          if (!coin) return null;
                          const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e'];
                          const activeColor = colors[index % colors.length];
                          const base = coin.history[0] || 1;
                          const finalReturn = ((coin.price - base) / base) * 100;

                          return (
                            <div key={id} className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColor }} />
                              <span className="text-zinc-300">{coin.symbol}</span>
                              <span className={finalReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                {finalReturn >= 0 ? '+' : ''}{finalReturn.toFixed(2)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Side-by-side spec directory evaluation matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                      {compareIds.map((id, index) => {
                        const coin = coins.find(c => c.id === id);
                        if (!coin) return null;

                        const colors = ['border-indigo-500/30', 'border-emerald-500/30', 'border-amber-500/30', 'border-rose-500/30'];
                        const activeBorderClass = colors[index % colors.length];
                        const holding = positions.find(p => p.id === coin.id);

                        const ratio1m = (coin.price - coin.price1mAgo) / coin.price1mAgo * 100;
                        const ratio5m = (coin.price - coin.price5mAgo) / coin.price5mAgo * 100;
                        const ratio24h = (coin.price - coin.price24hAgo) / coin.price24hAgo * 100;

                        return (
                          <div 
                            key={id} 
                            onClick={() => setActiveCoinId(coin.id)}
                            className={`p-4 rounded-xl border bg-slate-900/10 cursor-pointer hover:scale-[1.01] transition-all relative ${activeBorderClass}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black font-mono text-slate-100">{coin.symbol}</span>
                              <span className="text-[10px] text-zinc-550 font-bold p-1 rounded bg-white/5 uppercase">
                                {coin.category}
                              </span>
                            </div>

                            <div className="space-y-2 text-xs font-mono pt-2 border-t border-white/5">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">{trans.tblPrice}</span>
                                <span className="font-extrabold text-slate-300">${coin.price.toFixed(coin.price > 10 ? 2 : 5)}</span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-zinc-500">{trans.metricCategory}</span>
                                <span className="text-zinc-350">{coin.category}</span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-zinc-500">1m Drift</span>
                                <span className={ratio1m >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                                  {ratio1m >= 0 ? '+' : ''}{ratio1m.toFixed(2)}%
                                </span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-zinc-500">5m Drift</span>
                                <span className={ratio5m >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                                  {ratio5m >= 0 ? '+' : ''}{ratio5m.toFixed(2)}%
                                </span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-zinc-500">24h Drift</span>
                                <span className={ratio24h >= 0 ? 'text-emerald-555 font-bold' : 'text-rose-500 font-bold'}>
                                  {ratio24h >= 0 ? '+' : ''}{ratio24h.toFixed(1)}%
                                </span>
                              </div>

                              <div className="flex justify-between pt-2 border-t border-white/5 text-[10px]">
                                <span className="text-zinc-500">Active Exposure</span>
                                <span className="text-indigo-400 font-black">
                                  {holding ? `${holding.quantity.toFixed(3)} ${coin.symbol}` : 'None'}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCompareId(coin.id);
                              }}
                              className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 font-black text-[10px]"
                              title="Discard"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-16 text-xs text-zinc-500 flex flex-col items-center gap-3">
                    <Info className="w-8 h-8 text-indigo-450" />
                    <p className="max-w-md leading-relaxed">{trans.noSelectedCompare}</p>
                  </div>
                )}

              </div>

              {/* Directory checklist board inside Compare */}
              <div className={`p-4.5 rounded-2xl border ${
                dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200'
              }`}>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-3.5 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                  Quick checklist generator (Max 4 concurrent tokens selected)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {coins.slice(0, 36).map(c => {
                    const isChecked = compareIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleToggleCompareId(c.id)}
                        className={`py-2 px-3 text-xs font-mono font-bold rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
                            : dark
                              ? 'bg-slate-950/40 border-white/5 text-zinc-500 hover:border-slate-800'
                              : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{c.symbol}</span>
                        {isChecked ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          )}

          {/* ====== TAB 3: ACCOUNT LEDGERS EXPOSURES ====== */}
          {activeTab === 'ledger' && (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >

              {/* Real OKX-API account vs the local simulated account (clearly distinguished) */}
              <OkxAccountPanel
                dark={dark}
                lang={currentLocale}
                simCash={cash}
                simPositionsCount={positions.length}
                simEquity={portfolioSummary.netWorth}
              />

              {/* Positions exposures terminal monitor */}
              <div className={`p-6 rounded-2xl border ${
                dark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
              }`}>
                <h2 className="text-base font-black tracking-tight mb-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    {trans.currentHoldings}
                  </span>
                  
                  <span className="text-xs font-mono text-slate-500">
                    Exposure leverage modifier limits preset: {leverage}x
                  </span>
                </h2>

                <div className="divide-y divide-white/5">
                  {positions.map(pos => {
                    const fresh = coins.find(c => c.id === pos.id);
                    const currentPrice = fresh ? fresh.price : pos.currentPrice;
                    const evaluation = pos.quantity * currentPrice;
                    const expenditure = pos.quantity * pos.entryPrice;
                    
                    const yieldVal = evaluation - expenditure;
                    const roiRatio = (yieldVal / expenditure) * 100;

                    return (
                      <div key={pos.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-base tracking-tight text-slate-100">{pos.symbol}</span>
                            <span className="py-0.5 px-1.5 rounded-md bg-white/5 text-[9px] font-mono text-zinc-500 uppercase">
                              Spot exposure
                            </span>
                            <span className="py-0.5 px-1.5 rounded-md bg-amber-500/10 text-[9px] font-mono text-amber-500 font-bold">
                              {pos.leverage}x Leverage cross
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 font-mono text-xs text-zinc-500">
                            <div>
                              <span>{trans.colSize}:</span>
                              <span className="block font-black text-slate-350 mt-0.5">{pos.quantity.toFixed(4)}</span>
                            </div>

                            <div>
                              <span>{trans.colEntry}:</span>
                              <span className="block font-bold mt-0.5">${pos.entryPrice.toFixed(4)}</span>
                            </div>

                            <div>
                              <span>{trans.colCurrent}:</span>
                              <span className="block font-bold mt-0.5 text-indigo-400">${currentPrice.toFixed(4)}</span>
                            </div>

                            <div>
                              <span>Total Value:</span>
                              <span className="block font-black text-slate-200 mt-0.5">${evaluation.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Yield returns & Liquidation button */}
                        <div className="flex md:flex-col items-end gap-3 justify-between md:justify-center">
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-500 uppercase font-mono">Simulated Yield</p>
                            <span className={`text-base font-mono font-black ${yieldVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {yieldVal >= 0 ? '+' : ''}${yieldVal.toFixed(2)}
                            </span>
                            <span className={`block text-[11px] font-mono ${yieldVal >= 0 ? 'text-emerald-500/80' : 'text-rose-505/80'}`}>
                              ({roiRatio.toFixed(2)}%)
                            </span>
                          </div>

                          <button
                            onClick={() => handleLiquidateWholePosition(pos)}
                            className="py-1.5 px-4 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
                          >
                            {trans.closeBtn}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {positions.length === 0 && (
                    <div className="text-center py-12 text-xs font-mono text-zinc-500">
                      {trans.noHoldings}
                    </div>
                  )}
                </div>
              </div>

              {/* Settlement History audit records ledger */}
              <div className={`p-6 rounded-2xl border ${
                dark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    {trans.historyTitle} ({historyTrades.length} entries)
                  </h3>

                  {historyTrades.length > 0 && (
                    <button
                      onClick={() => {
                        setHistoryTrades([]);
                        addToast("Simulated audit transactional trails cleared.", 'info');
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                  {historyTrades.map(trade => (
                    <div 
                      key={trade.id} 
                      className={`p-3.5 rounded-xl border font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        dark ? 'bg-slate-950/40 border-white/5' : 'bg-slate-100 border-slate-200/80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`py-0.5 px-2 rounded font-extrabold text-[9px] ${
                          trade.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-450' : 'bg-rose-500/15 text-rose-450'
                        }`}>
                          {trade.type}
                        </span>

                        <span className="font-extrabold text-slate-250 dark:text-slate-100">{trade.symbol}</span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-zinc-500">Qty:</span>
                        <span className="font-semibold text-zinc-350">{trade.quantity.toFixed(4)}</span>
                        <span className="text-zinc-500">@ Price:</span>
                        <span className="font-bold text-zinc-350">${trade.price.toFixed(4)}</span>
                        
                        {trade.leverage > 1 && (
                          <span className="px-1 bg-amber-500/10 text-[9px] text-amber-500 rounded font-semibold">
                            {trade.leverage}x
                          </span>
                        )}
                      </div>

                      <div className="text-right flex items-center sm:justify-end gap-3 text-zinc-500">
                        {trade.pnl !== 0 && (
                          <span className={`font-bold ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} return
                          </span>
                        )}
                        <span>{trade.time}</span>
                      </div>
                    </div>
                  ))}

                  {historyTrades.length === 0 && (
                    <p className="text-center py-6 text-xs text-zinc-500">No transactional audits found.</p>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* ====== TAB 4: SETTINGS PARAMETERS ====== */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start"
            >
              {/* OKX quant settings — rate limits / usage / database / KEY / pre-open (full width) */}
              <div className="md:col-span-2">
                <OkxQuantPanel dark={dark} lang={currentLocale} />
              </div>

              {/* Left Settings modifiers */}
              <div className={`p-6 rounded-2xl border ${
                dark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
              } space-y-6`}>
                <div>
                  <h2 className="text-base font-black tracking-tight">Vortex Sandboxed Engine Customizers</h2>
                  <p className="text-xs text-zinc-550 mt-1">{trans.configSub}</p>
                </div>

                {/* HEARTBEAT PRICE SPEED */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 flex justify-between">
                    <span>{trans.optLatency}</span>
                    <span className="font-mono text-indigo-400">{(tickSpeed / 1000).toFixed(1)}s period</span>
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="15000"
                    step="500"
                    value={tickSpeed}
                    onChange={(e) => setTickSpeed(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-505"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                    <span>1.0s Speed (Aggressive block updates)</span>
                    <span>15.0s Speed (Slow drift)</span>
                  </div>
                </div>

                {/* TRANSACTION commission fee selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 flex justify-between">
                    <span>{trans.optFee}</span>
                    <span className="font-mono text-indigo-400">{feePercent}% per trade</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 0.05, 0.1, 0.25].map(fee => (
                      <button
                        key={fee}
                        onClick={() => setFeePercent(fee)}
                        className={`py-2 text-xs font-bold font-mono border rounded-xl transition ${
                          feePercent === fee
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                            : dark
                              ? 'bg-transparent border-white/5 text-zinc-500'
                              : 'bg-transparent border-slate-200 text-slate-600'
                        }`}
                      >
                        {fee === 0 ? 'Fee-free' : `${fee}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Initial balance multipliers reset & deposit injection */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <span className="text-xs font-bold text-slate-400 block mb-2">Private simulated funding command tools</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={triggerAirdrop}
                      className="py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {trans.btnAirdrop}
                    </button>

                    <button
                      onClick={triggerPortfolioReset}
                      className="py-2.5 px-4 bg-rose-500/20 hover:bg-rose-500 text-rose-450 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      {trans.btnReset}
                    </button>
                  </div>
                </div>

              </div>

              {/* Right panel visuals modifiers */}
              <div className={`p-6 rounded-2xl border ${
                dark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
              } space-y-6`}>
                
                <div>
                  <h3 className="text-sm font-black text-slate-205">Visual and Multi-National Settings</h3>
                  <p className="text-xs text-zinc-550 mt-1">Configure language files translations and dark styling matrices.</p>
                </div>

                {/* LANG CONTROLS */}
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-400 block">{trans.langLabel}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { code: 'en', label: '🇺🇸 English' },
                      { code: 'zh', label: '🇨🇳 中文' },
                      { code: 'ja', label: '🇯🇵 日本語' },
                    ].map(item => {
                      const isActive = lang === item.code;
                      return (
                        <button
                          key={item.code}
                          onClick={() => setLang(item.code)}
                          className={`py-3 text-xs font-sans font-bold border rounded-xl transition ${
                            isActive
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                              : dark
                                ? 'bg-transparent border-white/5 text-zinc-550'
                                : 'bg-transparent border-slate-200 text-slate-650'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* THEME CONTROLS */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <span className="text-xs font-bold text-slate-400 block">{trans.themeLabel}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDark(true)}
                      className={`py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition ${
                        dark
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-extrabold'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <Pause className="w-4 h-4 fill-indigo-400 text-transparent" />
                      Atmospheric Cyber (Dark)
                    </button>

                    <button
                      onClick={() => setDark(false)}
                      className={`py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition ${
                        !dark
                          ? 'bg-slate-200 border-slate-300 text-slate-900 font-extrabold'
                          : 'border-white/5 text-slate-500'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-slate-900 text-transparent" />
                      Clean Corporate (Light)
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ====== TAB: OKX BACKTEST (pycore market-data service) ====== */}
          {activeTab === 'okx-backtest' && (
            <motion.div
              key="okx-backtest"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <OkxBacktestPanel dark={dark} lang={currentLocale} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};

export default VortexApp;
