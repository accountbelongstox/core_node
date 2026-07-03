/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, PinduoduoAccount, AccountStats, LicenseState } from '@/lib/types';
import {
  generateMockOrders, BASE_PDD_ACCOUNTS, INITIAL_STATS
} from './data';
import { AccountPanel } from './components/AccountPanel';
import { OrderCard } from './components/OrderCard';
import { LogisticsModal } from './components/LogisticsModal';
import { OrderFormModal } from './components/OrderFormModal';
import { ChatSimulator } from './components/ChatSimulator';
import { ReconciliationModal } from './components/ReconciliationModal';
import { i18n, Language } from './i18n';

// Real extension wiring (no-op friendly in plain web preview).
import {
  inExtension,
  getLicense, submitSuperCode, loginMember, clearLicense,
  listAccounts, captureActiveTab, bindAccount, removeAccount, setActiveAccount,
  getCachedOrders, syncOrders, refundOrders,
  patchSettings,
} from '@/lib/dashboardBridge';
import { downloadCsv } from '@/lib/exportCsv';
import { MASTER_CODES } from '@/lib/superCode';

import {
  Search, Plus, Filter, RotateCcw, FileSpreadsheet,
  CheckSquare, Square, ClipboardCheck, Trash2, Key,
  X, HelpCircle, Calendar, Sparkles, Check, AlertCircle,
  TrendingUp, ArrowDownLeft, Receipt, Upload, Play,
  Cpu, Activity, Languages, Sun, Moon,
  RefreshCw, UserPlus, LogIn, LogOut, ShieldCheck, Loader2, Server
} from 'lucide-react';

// Dynamic date helpers (local time). Keep the default window anchored to the
// real current date so freshly synced orders and today-based mock data both show.
const fmtDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
};
const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
};

export default function App() {
  // Are we running inside the actual extension (vs. a plain web preview)?
  const ext = inExtension();

  // State Initialization
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('dingduoduo_lang_v2') as Language) || 'zh';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('dingduoduo_theme_v2') as 'light' | 'dark') || 'dark';
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [accounts, setAccounts] = useState<PinduoduoAccount[]>([]);
  const [activePDDAccount, setActivePDDAccount] = useState<PinduoduoAccount | null>(null);
  const [stats, setStats] = useState<AccountStats>(INITIAL_STATS);

  // Licensing / activation gate
  const [license, setLicense] = useState<LicenseState | null>(null);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [gateTab, setGateTab] = useState<'super' | 'backend'>('super');
  const [superCodeInput, setSuperCodeInput] = useState('');
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:9000');
  const [backendUser, setBackendUser] = useState('');
  const [backendPass, setBackendPass] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  // Extension async ops
  const [capturing, setCapturing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | Order['status']>('全部');
  const [recipientFilter, setRecipientFilter] = useState('全部');
  const [startDate, setStartDate] = useState(() => daysAgoStr(30));
  const [endDate, setEndDate] = useState(() => tomorrowStr());
  const [filterPreset, setFilterPreset] = useState<'近3天' | '今天' | '近7天' | '自定义'>('自定义');

  // Interactive popup modals
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [chattingOrder, setChattingOrder] = useState<Order | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Custom Toasts and loaders
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [batchActionProgress, setBatchActionProgress] = useState<number | null>(null);
  const [batchActionLabel, setBatchActionLabel] = useState('');
  const [alipayModal, setAlipayModal] = useState<{ isOpen: boolean; orderIdText: string; totalAmount: number; orderIds: string[] }>({
    isOpen: false,
    orderIdText: '',
    totalAmount: 0,
    orderIds: []
  });

  // Audit Split Mode Toggle (订单核对)
  const [auditMode, setAuditMode] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);

  // Localization context helper
  const t = i18n[lang];

  // Theme Sync on start and changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dingduoduo_theme_v2', theme);
    if (ext) patchSettings({ theme }).catch(() => {});
  }, [theme]);

  // Language Sync
  useEffect(() => {
    localStorage.setItem('dingduoduo_lang_v2', lang);
    if (ext) patchSettings({ lang }).catch(() => {});
  }, [lang]);

  // License bootstrap: inside the extension we must pass the activation gate first.
  useEffect(() => {
    if (!ext) {
      setLicenseChecked(true);
      return;
    }
    (async () => {
      try {
        setLicense(await getLicense());
      } catch {
        setLicense(null);
      }
      setLicenseChecked(true);
    })();
  }, []);

  // Web-preview bootstrap: localStorage or mock generators (NOT used in extension).
  useEffect(() => {
    if (ext) return;

    const savedOrders = localStorage.getItem('dingduoduo_orders_v2');
    const savedAccounts = localStorage.getItem('dingduoduo_accounts_v2');
    const savedStats = localStorage.getItem('dingduoduo_stats_v2');

    if (savedOrders) {
      setOrders(JSON.parse(savedOrders));
    } else {
      const generated = generateMockOrders();
      setOrders(generated);
      localStorage.setItem('dingduoduo_orders_v2', JSON.stringify(generated));
    }

    if (savedAccounts) {
      const parsedAcc = JSON.parse(savedAccounts);
      setAccounts(parsedAcc);
      setActivePDDAccount(parsedAcc[0] || null);
    } else {
      setAccounts(BASE_PDD_ACCOUNTS);
      setActivePDDAccount(BASE_PDD_ACCOUNTS[0]);
      localStorage.setItem('dingduoduo_accounts_v2', JSON.stringify(BASE_PDD_ACCOUNTS));
    }

    if (savedStats) {
      setStats(JSON.parse(savedStats));
    } else {
      setStats(INITIAL_STATS);
    }
  }, []);

  // Extension data loader: once a license is active, load real accounts + cached orders.
  useEffect(() => {
    if (!ext) return;
    if (!license || license.mode === 'locked') return;
    (async () => {
      try {
        const payload = await listAccounts();
        setAccounts(payload.accounts);
        const active =
          payload.accounts.find((a) => a.pddUserId === payload.activePddUserId) ||
          payload.accounts[0] ||
          null;
        setActivePDDAccount(active);
        const cached = await getCachedOrders(active?.pddUserId);
        setOrders(cached);
      } catch {
        // ignore — gate already passed, panel simply shows no accounts yet
      }
    })();
  }, [ext, license]);

  // Save changes helper (web-preview persistence; harmless in extension).
  const saveOrdersToStorage = (updatedOrders: Order[]) => {
    setOrders(updatedOrders);
    if (!ext) localStorage.setItem('dingduoduo_orders_v2', JSON.stringify(updatedOrders));
  };

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // --- Activation gate handlers ---
  const handleSubmitSuper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superCodeInput.trim()) {
      setGateError(lang === 'zh' ? '请输入超级码' : 'Please enter a super-code');
      return;
    }
    setGateBusy(true);
    setGateError(null);
    try {
      const lic = await submitSuperCode(superCodeInput.trim());
      setLicense(lic);
      showToast(lang === 'zh' ? '超级码激活成功，全功能已解锁！' : 'Super-code activated. Full access unlocked!', 'success');
    } catch (err) {
      setGateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGateBusy(false);
    }
  };

  const handleLoginMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendUrl.trim() || !backendUser.trim()) {
      setGateError(lang === 'zh' ? '请填写后台地址与账号' : 'Please provide the backend address and account');
      return;
    }
    setGateBusy(true);
    setGateError(null);
    try {
      const lic = await loginMember(backendUrl.trim(), backendUser.trim(), backendPass);
      setLicense(lic);
      showToast(lang === 'zh' ? '会员登录成功！' : 'Member login succeeded!', 'success');
    } catch (err) {
      setGateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGateBusy(false);
    }
  };

  const handleExitLicense = async () => {
    try {
      await clearLicense();
    } catch {
      // ignore
    }
    setLicense(null);
    setSuperCodeInput('');
    showToast(lang === 'zh' ? '已退出授权' : 'License cleared', 'info');
  };

  // --- Account binding (real capture) ---
  const handleCaptureBind = async () => {
    setCapturing(true);
    try {
      const cap = await captureActiveTab();
      const payload = await bindAccount(cap.pddUserId, cap.accessToken, cap.nickname, cap.avatar);
      setAccounts(payload.accounts);
      const active =
        payload.accounts.find((a) => a.pddUserId === payload.activePddUserId) ||
        payload.accounts.find((a) => a.pddUserId === cap.pddUserId) ||
        payload.accounts[0] ||
        null;
      setActivePDDAccount(active);
      if (active) setOrders(await getCachedOrders(active.pddUserId));
      showToast(
        lang === 'zh'
          ? `已捕获并绑定拼多多账号：${active?.name || cap.pddUserId}`
          : `Captured & bound PDD account: ${active?.name || cap.pddUserId}`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCapturing(false);
    }
  };

  // Account switch
  const handleSelectAccount = async (acc: PinduoduoAccount) => {
    setActivePDDAccount(acc);
    showToast(
      lang === 'zh'
        ? `已切换拼多多渠道：${acc.name}`
        : `Switched store channel: ${acc.name}`,
      'info'
    );
    if (ext) {
      try {
        await setActiveAccount(acc.pddUserId);
        setOrders(await getCachedOrders(acc.pddUserId));
      } catch {
        // ignore
      }
    }
  };

  // Sync orders for the active account from Pinduoduo.
  const handleSyncOrders = async () => {
    if (!activePDDAccount) {
      showToast(lang === 'zh' ? '请先绑定并选择一个拼多多账号！' : 'Please bind and select an account first!', 'error');
      return;
    }
    setSyncing(true);
    setBatchActionLabel(lang === 'zh' ? '正在从拼多多同步订单数据...' : 'Syncing order data from Pinduoduo...');
    setBatchActionProgress(10);
    try {
      for (let p = 30; p <= 80; p += 25) {
        await new Promise((r) => setTimeout(r, 90));
        setBatchActionProgress(p);
      }
      const result = await syncOrders(activePDDAccount.pddUserId);
      setBatchActionProgress(100);
      setOrders(result.orders);
      showToast(
        lang === 'zh'
          ? `同步完成：已拉取 ${result.fetched} 笔订单！`
          : `Sync complete: fetched ${result.fetched} orders!`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSyncing(false);
      setTimeout(() => setBatchActionProgress(null), 300);
    }
  };

  // Preset Date range modifier
  const handleDatePreset = (preset: '近3天' | '今天' | '近7天' | '全部时间') => {
    if (preset === '近3天') {
      setStartDate(daysAgoStr(2));
      setEndDate(tomorrowStr());
      setFilterPreset('近3天');
    } else if (preset === '今天') {
      setStartDate(fmtDate(new Date()));
      setEndDate(tomorrowStr());
      setFilterPreset('今天');
    } else if (preset === '近7天') {
      setStartDate(daysAgoStr(6));
      setEndDate(tomorrowStr());
      setFilterPreset('近7天');
    } else {
      setStartDate(daysAgoStr(30));
      setEndDate(tomorrowStr());
      setFilterPreset('自定义');
    }
    showToast(`${lang === 'zh' ? '起止时间已变更为' : 'Date range updated to'} ${preset}`, 'info');
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('全部');
    setRecipientFilter('全部');
    setStartDate(daysAgoStr(30));
    setEndDate(tomorrowStr());
    setFilterPreset('自定义');
    showToast(t.resetFilters, 'info');
  };

  // Search filter query logic
  const filteredOrders = orders.filter((o) => {
    // Check status
    if (statusFilter !== '全部' && o.status !== statusFilter) return false;

    // Check custom accounts filter - only show orders bound to active PDD account if exists
    if (activePDDAccount && o.accountName !== activePDDAccount.name) return false;

    // Check Recipient
    if (recipientFilter !== '全部' && !o.recipientName.includes(recipientFilter)) return false;

    // Check Dates
    const orderDate = new Date(o.orderTime.replace(/\//g, '-'));
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    endObj.setHours(23, 59, 59, 999);

    if (orderDate < startObj || orderDate > endObj) return false;

    // Check Keyword Matcher
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        o.recipientName.toLowerCase().includes(q) ||
        o.recipientPhone.includes(q) ||
        o.recipientAddress.toLowerCase().includes(q) ||
        (o.expressNumber && o.expressNumber.includes(q)) ||
        o.id.includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.storeName.toLowerCase().includes(q) ||
        o.status.includes(q);

      if (!match) return false;
    }

    return true;
  });

  // Calculate distinct recipients for summary metrics (已查到 X 笔，收件人 Y 人)
  const recipientSet = new Set(filteredOrders.map(o => o.recipientName));
  const distinctRecipientsCount = recipientSet.size;

  // Selection managers
  const handleToggleSelectAll = (checked: boolean) => {
    const targetIds = new Set(filteredOrders.map(o => o.id));
    const nextOrders = orders.map(o => {
      if (targetIds.has(o.id)) {
        return { ...o, selected: checked };
      }
      return o;
    });
    saveOrdersToStorage(nextOrders);
  };

  const handleSelectOne = (id: string, select: boolean) => {
    const next = orders.map(o => o.id === id ? { ...o, selected: select } : o);
    saveOrdersToStorage(next);
  };

  // Add individual manual model
  const handleAddNewOrder = (partial: Partial<Order>) => {
    const todayStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/-/g, '/');
    const orderId = `${new Date().toLocaleDateString('zh-CN').replace(/\//g, '').slice(2)}-${Math.floor(Math.random() * 900000000000 + 100000000000)}`;

    const newOrder: Order = {
      id: orderId,
      accountName: partial.accountName || '蓦然回首',
      productName: partial.productName || '未命名商品',
      productImage: 'https://images.unsplash.com/photo-1540103711724-eb18534c4416?auto=format&fit=crop&q=80&w=240',
      specName: partial.specName || '规格1',
      quantity: partial.quantity || 1,
      unitPrice: partial.unitPrice || 0,
      orderAmount: partial.orderAmount || 0,
      productId: partial.productId || '0',
      specId: partial.specId || '0',
      orderTime: todayStr,
      status: partial.status || '待发货',
      storeName: partial.storeName || '商家服务店',
      recipientName: partial.recipientName || '299 Liang Feifei 299',
      recipientPhone: partial.recipientPhone || '18024087406',
      recipientAddress: partial.recipientAddress || '广东省佛山市甘焦二路云仓',
      invoiceStatus: '未申请',
      groupBuyUrl: `https://mobile.yangkeduo.com/group.html?group_order_id=${orderId}`
    };

    saveOrdersToStorage([newOrder, ...orders]);
    setShowOrderForm(false);
    showToast(lang === 'zh' ? '快件拼单已录入并成功并入终端！' : 'Sales order generated and injected successfully!', 'success');
  };

  // Copy with dynamic text helper
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(
      lang === 'zh'
        ? `✔ 复制成功: 已记录[${label}]`
        : `✔ Copied successfully: [${label}]`,
      'success'
    );
  };

  // Batch actions triggerers with simulated loading bar mechanics
  const handleBatchAction = async (action: 'order' | 'pay' | 'refund' | 'express' | 'invoice') => {
    const selected = orders.filter(o => o.selected && o.accountName === activePDDAccount?.name);

    if (selected.length === 0) {
      showToast(
        lang === 'zh'
          ? '请先打勾选择当前拼多多渠道账号底下的订单再同步！'
          : 'Please select orders belonging to current active account first!',
        'error'
      );
      return;
    }

    if (action === 'pay') {
      // payment trigger: open native customized alipay prompt
      const totalSum = selected.reduce((acc, o) => acc + o.orderAmount, 0);
      setAlipayModal({
        isOpen: true,
        orderIdText: selected.map(s => s.id.slice(-6)).join(', '),
        totalAmount: totalSum,
        orderIds: selected.map(s => s.id)
      });
      return;
    }

    // Progression runner
    const labelMapping = {
      zh: {
        'order': '正在协调拼多多官方服务打包同步下单并录入单号...',
        'refund': '正在向商家和拼多多财务极速同步退单审核...',
        'express': '正在上传用户反向寄回的退件运单凭据...',
        'invoice': '正在同步系统PDF发票并分配公章打单文件...'
      },
      en: {
        'order': 'Syncing carrier gateway for bulk ordering & courier collection...',
        'refund': 'Coordinating swift PDD merchant payment refund channel...',
        'express': 'Uploading reverse shipping logistics references...',
        'invoice': 'Drafting official electronic copy invoices...'
      }
    };

    setBatchActionLabel(labelMapping[lang][action as keyof typeof labelMapping['zh']]);
    setBatchActionProgress(5);

    for (let p = 15; p <= 100; p += 15) {
      await new Promise(r => setTimeout(r, 110));
      setBatchActionProgress(p);
    }

    // Update state based on finalized batch
    let updated = [...orders];
    if (action === 'order') {
      updated = orders.map(o => {
        if (o.selected && o.accountName === activePDDAccount?.name) {
          const expressNum = '465' + Math.floor(Math.random() * 8999999 + 10000000000);
          return {
            ...o,
            status: '待收货' as const,
            expressCompany: o.expressCompany || '韵达快递',
            expressNumber: o.expressNumber || expressNum,
            shippingTime: o.shippingTime || '2026/06/21 11:33:39',
            latestTrack: o.latestTrack || (lang === 'zh' ? '快件已被中转分拨包好，等待干线运输装运' : 'Dispatched from Hub Central Hub, heading to target delivery station'),
            trackingDetails: [
              { time: '2026/06/21 12:00:00', description: lang === 'zh' ? '【韵达快递】揽货揽件成功，准备干运。' : '【Yunda Courier】Weighed and packaged smoothly.' }
            ]
          };
        }
        return o;
      });
      showToast(
        lang === 'zh'
          ? `已批量向平台下单 ${selected.length} 笔订单，包裹出库！`
          : `Successfully completed dispatch on ${selected.length} orders!`,
        'success'
      );
    } else if (action === 'refund') {
      // Real refund against Pinduoduo when running inside the extension.
      let refundedIds = selected.map(s => s.id);
      if (ext && activePDDAccount) {
        try {
          refundedIds = await refundOrders(activePDDAccount.pddUserId, selected.map(s => s.id));
        } catch (err) {
          showToast(err instanceof Error ? err.message : String(err), 'error');
          setBatchActionProgress(null);
          return;
        }
      }
      const refundedSet = new Set(refundedIds);
      updated = orders.map(o => {
        if (refundedSet.has(o.id)) {
          return {
            ...o,
            status: '已退款' as const,
            latestTrack: lang === 'zh' ? '退款完成，已通过买家渠道返还到支付宝元宝余额' : 'Refund request approved. Funds settled to Alipay balance.'
          };
        }
        return o;
      });
      showToast(
        lang === 'zh'
          ? `极速办理安全售后：${refundedSet.size} 笔款项原路返还！`
          : `Refund processed successfully on ${refundedSet.size} transactions!`,
        'success'
      );
    } else if (action === 'express') {
      updated = orders.map(o => {
        if (o.selected && o.accountName === activePDDAccount?.name) {
          return {
            ...o,
            expressCompany: '圆通速递',
            expressNumber: 'YT' + Math.floor(Math.random() * 900000000 + 10000000000),
            latestTrack: lang === 'zh' ? '已上传买家反向返回寄付物流单' : 'Reverse shipping details uploaded and synced to buyer profile'
          };
        }
        return o;
      });
      showToast(
        lang === 'zh'
          ? `上传退件成功！共更新 ${selected.length} 笔运输属性！`
          : `Synchronized outer logistics references on ${selected.length} reverse parcels!`,
        'success'
      );
    } else if (action === 'invoice') {
      updated = orders.map(o => {
        if (o.selected && o.accountName === activePDDAccount?.name) {
          return {
            ...o,
            invoiceStatus: '已申请' as const
          };
        }
        return o;
      });
      showToast(
        lang === 'zh'
          ? `发票申请已批量提交！涉及 ${selected.length} 笔。`
          : `Bulk invoice requests drafted for ${selected.length} records!`,
        'success'
      );
    }

    saveOrdersToStorage(updated);
    setBatchActionProgress(null);
  };

  // Complete Alipay check simulation
  const handleCompleteAlipay = () => {
    const updated = orders.map(o => {
      if (alipayModal.orderIds.includes(o.id)) {
        return {
          ...o,
          status: '待发货' as const
        };
      }
      return o;
    });
    saveOrdersToStorage(updated);
    setAlipayModal({ isOpen: false, orderIdText: '', totalAmount: 0, orderIds: [] });
    showToast(
      lang === 'zh'
        ? '付款完成！所选付款单据进入 [待发货] 库房拣选程序！'
        : 'Payment settled on secure gateway! Package in queue for shipment.',
      'success'
    );
  };

  // Individual Logistics Refresher
  const handleRefreshSingleLogistics = (id: string) => {
    const updated = orders.map(o => {
      if (o.id === id) {
        const generatedNum = o.expressNumber || ('465' + Math.floor(Math.random() * 89999 + 4543240000));
        return {
          ...o,
          status: '待收货' as const,
          expressCompany: o.expressCompany || '韵达快递',
          expressNumber: generatedNum,
          shippingTime: o.shippingTime || '2026/06/21 11:33:39',
          latestTrack: lang === 'zh' ? '派件小哥出发，今日快件将极速送达甘焦云仓！' : 'Out for courier delivery. Estimating arrival today!',
          trackingDetails: [
            { time: '2026/06/21 11:50:00', description: lang === 'zh' ? '智能加急服务已覆盖，派送时段已规划到位' : 'Express delivery logistics prior route mapped.' }
          ]
        };
      }
      return o;
    });
    saveOrdersToStorage(updated);
    showToast(
      lang === 'zh'
        ? `单码 ${id.slice(-6)} 物流实时状态同步刷新完毕。`
        : `Logistics status updated for ID ${id.slice(-6)}.`,
      'success'
    );
  };

  // Invoice Application
  const handleApplySingleInvoice = (id: string) => {
    const updated = orders.map(o => {
      if (o.id === id) {
        const nextStatus = o.invoiceStatus === '未申请' ? '已申请' : o.invoiceStatus === '已申请' ? '已下载' : '已申请';
        return { ...o, invoiceStatus: nextStatus as any };
      }
      return o;
    });
    saveOrdersToStorage(updated);
    showToast(
      lang === 'zh'
        ? '发票变更状态已记录归档！'
        : 'Electronic invoice metadata adjusted successfully!',
      'success'
    );
  };

  // Re-order group buy
  const handleReGroupBuy = (order: Order) => {
    showToast(
      lang === 'zh'
        ? `即将向 ${order.storeName} 发起重新拼团下单登记...`
        : `Initiating buy-back flow on ${order.storeName} listing...`,
      'info'
    );
    setShowOrderForm(true);
  };

  // Delete Selection
  const handleDeleteSelection = () => {
    const targets = orders.filter(o => o.selected && o.accountName === activePDDAccount?.name);
    if (targets.length === 0) {
      showToast(
        lang === 'zh'
          ? '未选择任何属于当前拼多多账号的订单进行删除！'
          : 'Please select orders belonging to current account to remove!',
        'error'
      );
      return;
    }
    const confirmMsg = lang === 'zh'
      ? `彻底清除安全警告：确定要从本地永久抹除这 ${targets.length} 笔订单记录吗？本步骤不可撤销。`
      : `Warning: Are you sure you want to permanently delete these ${targets.length} selected orders from console?`;

    if (window.confirm(confirmMsg)) {
      const remaining = orders.filter(o => !(o.selected && o.accountName === activePDDAccount?.name));
      saveOrdersToStorage(remaining);
      showToast(
        lang === 'zh'
          ? `成功剪除 ${targets.length} 条销售凭单记录。`
          : `Securely scrubbed ${targets.length} order entries.`,
        'success'
      );
    }
  };

  // Pinduoduo accounts binding modification (web-preview / manual local add)
  const handleAddNewPDDAccount = (name: string) => {
    const syntheticId = `local_${Date.now()}`;
    const newAcc: PinduoduoAccount = {
      id: `pdd_${syntheticId}`,
      pddUserId: syntheticId,
      name,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      bindTime: new Date().toLocaleDateString('zh-CN'),
      status: 'ACTIVE'
    };
    const nextAccs = [...accounts, newAcc];
    setAccounts(nextAccs);
    setActivePDDAccount(newAcc);
    if (!ext) localStorage.setItem('dingduoduo_accounts_v2', JSON.stringify(nextAccs));
    showToast(
      lang === 'zh'
        ? `拼多多多开新通道 ${name} 绑定入网成功！`
        : `Successfully registered new store channel: ${name}`,
      'success'
    );
  };

  const handleDeleteAccount = async (id: string) => {
    const target = accounts.find(a => a.id === id);
    if (ext && target) {
      try {
        const payload = await removeAccount(target.pddUserId);
        setAccounts(payload.accounts);
        const active =
          payload.accounts.find((a) => a.pddUserId === payload.activePddUserId) ||
          payload.accounts[0] ||
          null;
        setActivePDDAccount(active);
        setOrders(active ? await getCachedOrders(active.pddUserId) : []);
        showToast(lang === 'zh' ? '销售渠道通道解约解除绑定成功。' : 'Disassociated store channel mapping successfully.', 'info');
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
      return;
    }
    if (accounts.length <= 1) return;
    const remaining = accounts.filter(a => a.id !== id);
    setAccounts(remaining);
    setActivePDDAccount(remaining[0]);
    localStorage.setItem('dingduoduo_accounts_v2', JSON.stringify(remaining));
    showToast(
      lang === 'zh'
        ? '销售渠道通道解约解除绑定成功。'
        : 'Disassociated store channel mapping successfully.',
      'info'
    );
  };

  // CSV One click Export Orders
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast(
        lang === 'zh' ? '无可导出的订单记录！' : 'No records match current query filtering criteria',
        'error'
      );
      return;
    }

    const filename = `${lang === 'zh' ? '订多多_PDD数据导出' : 'Dingduoduo_Rec_Export'}_${startDate}_to_${endDate}.csv`;
    downloadCsv(filteredOrders, lang, filename);

    showToast(
      lang === 'zh'
        ? `极速对账导出成功：已下载 ${filteredOrders.length} 笔表格文件！`
        : `Successfully compiled the CSV sheet containing ${filteredOrders.length} records!`,
      'success'
    );
  };

  // Modify password modal handler
  const handleModifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      showToast(lang === 'zh' ? '新密码不能为空！' : 'New credential must not be blank!', 'error');
      return;
    }
    showToast(
      lang === 'zh'
        ? '密码更新安全节点已重写归档！'
        : 'Secured PIN rewritten dynamically.',
      'success'
    );
    setPasswordModalOpen(false);
    setOldPassword('');
    setNewPassword('');
  };

  // --- Activation gate state derivations ---
  const licenseLabel =
    license?.label ||
    (license?.mode === 'super' ? '超级码' : license?.mode === 'member' ? '会员' : '未授权');
  const gateOpen = ext && licenseChecked && (!license || license.mode === 'locked');

  // While the extension is resolving the stored license, hold a small splash.
  if (ext && !licenseChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          {lang === 'zh' ? '正在校验授权...' : 'Verifying license...'}
        </div>
      </div>
    );
  }

  // Activation gate — must unlock before the dashboard renders.
  if (gateOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-slate-800 dark:text-slate-100">
        <div className="w-full max-w-md bg-white/55 dark:bg-slate-900/55 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">

          {/* Brand header */}
          <div className="px-6 py-5 border-b border-black/5 dark:border-white/10 flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-650 rounded-xl flex items-center justify-center shadow-md border border-white/20">
              <span className="text-white font-black text-sm tracking-tighter">多</span>
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-wide">{t.title}</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-500" />
                {lang === 'zh' ? '授权验证 · 解锁后台' : 'Activation required'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-black/5 dark:border-white/10">
            <button
              onClick={() => { setGateTab('super'); setGateError(null); }}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                gateTab === 'super'
                  ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border-b-2 border-blue-500'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              {lang === 'zh' ? '超级码' : 'Super Code'}
            </button>
            <button
              onClick={() => { setGateTab('backend'); setGateError(null); }}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                gateTab === 'backend'
                  ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border-b-2 border-blue-500'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              {lang === 'zh' ? '连接后台' : 'Backend'}
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {gateTab === 'super' ? (
              <form onSubmit={handleSubmitSuper} className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                  {lang === 'zh' ? '超级码' : 'Super Code'}
                </label>
                <input
                  type="text"
                  value={superCodeInput}
                  onChange={(e) => setSuperCodeInput(e.target.value)}
                  placeholder="DDK-XXXX-XXXXXX"
                  className="w-full text-sm font-mono tracking-wider bg-white dark:bg-black/40 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {lang === 'zh'
                    ? '无网络可用，输入超级码即可全功能离线使用'
                    : 'Works fully offline — a valid super-code unlocks every feature with no backend.'}
                </p>
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600 leading-relaxed">
                  {Array.from(MASTER_CODES).join('  ·  ')}
                </p>
                {gateError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {gateError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={gateBusy}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer border-none shadow-md shadow-blue-500/15 transition-all"
                >
                  {gateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  {lang === 'zh' ? '激活' : 'Activate'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginMember} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {lang === 'zh' ? '后台地址' : 'Backend Address'}
                  </label>
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder="http://127.0.0.1:9000"
                    className="w-full text-xs font-mono bg-white dark:bg-black/40 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {lang === 'zh' ? '账号' : 'Account'}
                  </label>
                  <input
                    type="text"
                    value={backendUser}
                    onChange={(e) => setBackendUser(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-black/40 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {lang === 'zh' ? '密码' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={backendPass}
                    onChange={(e) => setBackendPass(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-black/40 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                {gateError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {gateError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={gateBusy}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer border-none shadow-md shadow-blue-500/15 transition-all"
                >
                  {gateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {lang === 'zh' ? '登录' : 'Login'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-100 flex flex-col font-sans relative selection:bg-blue-500/30">

      {/* Toast Alert bar */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-55 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-sm max-w-sm transition-all duration-150 transform translate-y-0 ${
          toastMessage.type === 'success' ? 'bg-emerald-100/90 dark:bg-emerald-950/80 border-emerald-500/35 text-emerald-800 dark:text-emerald-355' :
          toastMessage.type === 'error' ? 'bg-rose-100/90 dark:bg-rose-950/80 border-rose-500/35 text-rose-800 dark:text-rose-355' :
          'bg-slate-100/95 dark:bg-slate-900/80 border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-205'
        }`}>
          <Sparkles className="w-4 h-4 flex-shrink-0 animate-spin text-blue-500 dark:text-blue-400" />
          <span className="font-bold font-sans">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner Navigation bar */}
      <nav id="header-navigation" className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border-b border-black/5 dark:border-white/10 sticky top-0 z-30 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">

            {/* Title Identity */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-650 rounded-xl flex items-center justify-center shadow-md border border-white/20">
                <span className="text-white font-black text-sm tracking-tighter">多</span>
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-wide flex items-center gap-1">
                  {t.title}
                  <span className="text-[10px] bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/20 dark:border-blue-500/30 px-1.5 py-0.5 rounded-md font-mono tracking-wider font-semibold">DDK PRO</span>
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.subtitle}</p>
              </div>
            </div>

            {/* Quick Interactive Widgets (Theme, Language switches) */}
            <div className="flex items-center gap-3">

              {/* License badge + exit (extension only) */}
              {ext && (
                <div className="flex items-center gap-2 mr-1">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                    license && license.mode !== 'locked'
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25'
                      : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-black/10 dark:border-white/10'
                  }`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {licenseLabel}
                  </span>
                  {license && license.mode !== 'locked' && (
                    <button
                      id="exit-license-btn"
                      onClick={handleExitLicense}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 flex items-center gap-1 transition-all cursor-pointer"
                      title={lang === 'zh' ? '退出授权' : 'Clear License'}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {lang === 'zh' ? '退出授权' : 'Exit'}
                    </button>
                  )}
                </div>
              )}

              {/* Platform status indicator */}
              <div className="hidden md:flex items-center gap-2.5 text-xs mr-3">
                <div className="bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-black/5 dark:border-white/5 font-mono text-slate-600 dark:text-slate-300 shadow-inner">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>{lang === 'zh' ? 'API网关:' : 'Gateway:'} <span className="text-emerald-600 dark:text-emerald-400 font-bold">{lang === 'zh' ? '安全' : 'SECURE'}</span></span>
                </div>
                <div className="bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-black/5 dark:border-white/5 font-mono text-slate-600 dark:text-slate-300 shadow-inner">
                  <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <span>{lang === 'zh' ? '极速同步' : 'Fast Sync'}</span>
                </div>
              </div>

              {/* Language Switch */}
              <button
                id="language-switch"
                onClick={() => {
                  setLang(lang === 'zh' ? 'en' : 'zh');
                  showToast(lang === 'zh' ? 'Language switched to English' : '已切换至中文终端界面', 'info');
                }}
                className="p-2 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Switch Language"
              >
                <Languages className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black tracking-wider uppercase font-mono">{lang === 'zh' ? 'EN' : '中文'}</span>
              </button>

              {/* Theme Switch */}
              <button
                id="theme-switch"
                onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                }}
                className="p-2 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title="Toggle visual style"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-500 animate-[spin_8s_linear_infinite]" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-650" />
                )}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Side: Sidebar Stats panel (cols-span-3) */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-20">

          {/* Capture & bind the currently logged-in Pinduoduo account (extension only) */}
          {ext && (
            <button
              id="capture-bind-btn"
              onClick={handleCaptureBind}
              disabled={capturing}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/15 border-none transition-all cursor-pointer"
            >
              {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {lang === 'zh' ? '+ 捕获并绑定当前拼多多账号' : '+ Capture & Bind Current PDD Account'}
            </button>
          )}

          <AccountPanel
            stats={stats}
            accounts={accounts}
            activeAccount={activePDDAccount}
            onSelectAccount={handleSelectAccount}
            onModifyPassword={() => setPasswordModalOpen(true)}
            onLogout={() => {
              if (window.confirm(lang === 'zh' ? '确定要注销当前的订多多后台会话吗？' : 'Confirm leaving current secure session?')) {
                showToast(lang === 'zh' ? '已注销！可随时重新刷新数据。' : 'Offline safety locked.', 'info');
              }
            }}
            onAdjustBalance={(nb) => {
              const updatedStats = { ...stats, balance: nb };
              setStats(updatedStats);
              localStorage.setItem('dingduoduo_stats_v2', JSON.stringify(updatedStats));
              showToast(
                lang === 'zh'
                  ? '钱包模拟金额资产配置成功！'
                  : 'Account assets configured successfully!',
                'success'
              );
            }}
            onAddNewAccount={handleAddNewPDDAccount}
            onDeleteAccount={handleDeleteAccount}
            lang={lang}
          />

          {/* Quick Stats Panel */}
          <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-xl space-y-3 text-slate-800 dark:text-slate-200 transition-all duration-150">
            <h3 className="text-xs font-bold text-slate-805 dark:text-slate-300 tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              {t.stats}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-b border-black/5 dark:border-white/5 pb-1.5">
                <span>{lang === 'zh' ? '我的拼多多渠道' : 'Channels'}</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{accounts.length} {lang === 'zh' ? '多开' : 'Stores'}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-505 dark:text-slate-400 border-b border-black/5 dark:border-white/5 pb-1.5">
                <span>{lang === 'zh' ? '系统关联总订单' : 'All Orders'}</span>
                <span className="font-bold text-slate-801 dark:text-slate-205">{orders.length} {t.unit}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-505 dark:text-slate-400">
                <span>{lang === 'zh' ? '当前符合搜索' : 'Matches Query'}</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-black">{filteredOrders.length} / {orders.length} {t.unit}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-md shadow-emerald-500/20" />
              <span className="text-[10px] text-slate-450 dark:text-slate-500 leading-snug">{lang === 'zh' ? '所有数据网关及多开端口就绪' : 'All secure micro tunnels fully operational'}</span>
            </div>
          </div>

        </div>

        {/* Right Side: Primary Orders database & Filters */}
        <div className="lg:col-span-9 space-y-4">

          {/* Order Search & Advanced filters card */}
          <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl p-5 shadow-xl space-y-4 text-slate-800 dark:text-slate-100 transition-all duration-300">

            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/15 pb-3">
              <h3 className="text-sm font-bold text-slate-805 dark:text-white flex items-center gap-2">
                <Filter className="w-4.5 h-4.5 text-blue-500 dark:text-blue-400" />
                {lang === 'zh' ? '高级快件订单过滤及中转仓精确检索' : 'Advanced Transfer Warehousing Filter'}
              </h3>
              <div className="flex gap-2">
                <button
                  id="reset-filters-btn"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-350 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  {lang === 'zh' ? '重置' : 'Reset'}
                </button>
              </div>
            </div>

            {/* Keyword Input search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-3 bg-white/70 dark:bg-black/30 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              />
            </div>

            {/* Inline filters grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">

              {/* Date Ranges Picker */}
              <div className="md:col-span-6 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-bold">{t.startDate}</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setFilterPreset('自定义');
                      }}
                      className="w-full text-xs bg-white/80 dark:bg-black/30 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-bold">{t.endDate}</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setFilterPreset('自定义');
                      }}
                      className="w-full text-xs bg-white/80 dark:bg-black/30 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Date Presets Pickers */}
              <div className="md:col-span-3">
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-bold">{t.datePreset}</label>
                <div className="flex gap-1.5">
                  {([
                    { key: '近3天', trans: t.preset3days },
                    { key: '今天', trans: t.presetToday },
                    { key: '近7天', trans: t.preset7days }
                  ] as const).map((pst) => (
                    <button
                      key={pst.key}
                      onClick={() => handleDatePreset(pst.key)}
                      className={`flex-1 py-2 text-[11px] font-bold border rounded-lg transition-all cursor-pointer ${
                        filterPreset === pst.key
                          ? 'bg-blue-500/10 dark:bg-blue-600/30 border-blue-400/40 text-blue-600 dark:text-blue-300'
                          : 'bg-white/60 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-350 hover:bg-white dark:hover:bg-white/10'
                      }`}
                    >
                      {pst.trans}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient select filter */}
              <div className="md:col-span-3">
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-bold">{lang === 'zh' ? '仓储收件分流定位' : 'Warehousing Routing Target'}</label>
                <select
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  className="w-full text-xs bg-white/85 dark:bg-black/30 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans cursor-pointer [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-800 dark:[&>option]:text-slate-100"
                >
                  <option value="全部">{t.allRecipients}</option>
                  <option value="梁菲菲">299 {lang === 'zh' ? '环亚梁菲菲' : 'Liang Feifei'} 299</option>
                  <option value="张小龙">305 {lang === 'zh' ? '顺丰丰泰张小龙' : 'Zhang Xiaolong'} 305</option>
                  <option value="王林">122 {lang === 'zh' ? '极兔云配王林' : 'Wang Lin'} 122</option>
                </select>
              </div>

            </div>

            {/* Status tab switcher */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/5 dark:border-white/10">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-2.5 font-bold">{lang === 'zh' ? '快速状态切片:' : 'Quick Status Shift:'}</span>
              {(['全部', '待支付', '待发货', '待收货', '已签收', '已退款'] as const).map((st) => {
                const count = orders.filter(o => {
                  if (activePDDAccount && o.accountName !== activePDDAccount.name) return false;
                  return st === '全部' || o.status === st;
                }).length;
                return (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-505/40 text-blue-600 dark:text-blue-300 shadow-sm'
                        : 'bg-white/60 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {st === '全部' ? t.allStatus : (t[st] || st)} <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Core toolbar and Export operations Area */}
          <div className="bg-gradient-to-r from-blue-501 to-indigo-501 dark:from-blue-600/15 dark:to-indigo-600/10 border border-blue-500/20 text-slate-800 dark:text-slate-100 rounded-2xl p-5 shadow-xl space-y-4 transition-all duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-sm font-black tracking-wide flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {t.exportReport}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {t.exportTooltip}. {lang === 'zh' ? '当前工作渠道网关账号' : 'Current context working account'}: <strong className="underline text-blue-600 dark:text-blue-305 font-black">[{activePDDAccount?.name}]</strong>.
                </p>
              </div>
              <div className="flex w-full md:w-auto items-center gap-2">
                {ext && (
                  <button
                    id="sync-orders-btn"
                    onClick={handleSyncOrders}
                    disabled={syncing}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 border-none transition-transform hover:scale-[1.02] cursor-pointer"
                  >
                    <RefreshCw className={`w-4.5 h-4.5 ${syncing ? 'animate-spin' : ''}`} />
                    {lang === 'zh' ? '同步订单' : 'Sync Orders'}
                  </button>
                )}
                <button
                  id="export-csv-btn"
                  onClick={handleExportCSV}
                  className="flex-1 md:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 border-none transition-transform hover:scale-[1.02] cursor-pointer"
                >
                  <Upload className="w-4.5 h-4.5 animate-pulse" />
                  {lang === 'zh' ? `一键导出 ${filteredOrders.length} 笔销售单` : `Export ${filteredOrders.length} Selected Orders`}
                </button>
              </div>
            </div>

            <div className="bg-black/5 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-sans font-medium">
                {lang === 'zh' ? (
                  <>已查到 <strong className="text-blue-600 dark:text-blue-400 text-sm font-black font-mono">{filteredOrders.length}</strong> 笔拼货记录，涵盖收件地址 <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-black">{distinctRecipientsCount}</strong> 位中转人</>
                ) : (
                  <>Found <strong className="text-blue-400 text-sm font-black font-mono">{filteredOrders.length}</strong> parcels, matching <strong className="text-emerald-400 text-sm font-black">{distinctRecipientsCount}</strong> central delivery hubs</>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="open-reconcile-btn"
                  onClick={() => setShowReconcile(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border bg-blue-600 hover:bg-blue-500 text-white border-blue-500/40 shadow-sm"
                  title={lang === 'zh' ? '批量录入快递单号与已同步订单双向核对' : 'Bidirectional tracking-number reconciliation'}
                >
                  <ClipboardCheck className="w-4 h-4" />
                  {lang === 'zh' ? '订单核算' : 'Reconcile'}
                </button>
                <button
                  id="toggle-audit-btn"
                  onClick={() => setAuditMode(!auditMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                    auditMode
                      ? 'bg-blue-500/20 border-blue-505/30 text-blue-600 dark:text-blue-300'
                      : 'bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100'
                  }`}
                  title="Cross-compare shipping metrics to prevent double delivery"
                >
                  <ClipboardCheck className="w-4 h-4 text-blue-500" />
                  {auditMode ? (lang === 'zh' ? '解散核对面板' : 'Close Audit Rail') : (lang === 'zh' ? '开启转运标记核对' : 'Audit Warehouses')}
                </button>
              </div>
            </div>
          </div>

          {/* Split Screen Side-by-side Audit Mode Panel */}
          {auditMode && (
            <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl p-5 shadow-xl space-y-4 text-slate-800 dark:text-slate-100 transition-all duration-300">
              <div className="flex items-center gap-2 text-slate-850 dark:text-white">
                <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
                  {lang === 'zh' ? '转运分拨仓及承运包裹分布配比核查' : 'Hub Parcel SLA Distribution Audit'}
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                {lang === 'zh' ? '正在核对活跃销售渠道账号' : 'Analyzing parcel weight ratios for'} <strong className="text-blue-600 dark:text-blue-300">[{activePDDAccount?.name}]</strong>. {lang === 'zh' ? '选择特定收货人将立即进行列表切片快照:' : 'Select any routing target below to filter the grid snapshot immediately:'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: '299 环亚梁菲菲 299', short: '梁菲菲', color: 'border-blue-500/10' },
                  { name: '顺丰丰泰张小龙 305', short: '张小龙', color: 'border-emerald-500/10' },
                  { name: '122 极兔云配王林 122', short: '王林', color: 'border-indigo-500/10' }
                ].map((rec) => {
                  const itemsCount = orders.filter(o => o.accountName === activePDDAccount?.name && o.recipientName.includes(rec.short)).length;
                  const isFiltered = recipientFilter === rec.short;
                  return (
                    <div
                      key={rec.name}
                      onClick={() => setRecipientFilter(rec.short)}
                      className={`cursor-pointer p-3.5 border rounded-xl transition-all ${
                        isFiltered
                          ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500 text-blue-650 dark:text-blue-300 shadow-md scale-[1.03]'
                          : 'bg-white/70 dark:bg-black/20 border-black/10 dark:border-white/5 text-slate-700 dark:text-slate-350 hover:bg-white dark:hover:bg-black/30'
                      }`}
                    >
                      <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-205 line-clamp-1">{rec.name}</h5>
                      <div className="mt-2.5 flex justify-between items-end">
                        <span className="text-[10px] text-slate-500">{lang === 'zh' ? '已配运单数' : 'Active Parcels'}</span>
                        <strong className="text-base font-extrabold text-slate-800 dark:text-slate-100 font-mono">{itemsCount} {t.unit}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Batch operations Actions bar */}
          <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800 dark:text-slate-100 transition-all duration-300">

            {/* Multi-select check all */}
            <div className="flex items-center gap-2">
              <input
                id="select-all-checkbox"
                type="checkbox"
                checked={filteredOrders.length > 0 && filteredOrders.every(o => o.selected)}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-black/20 dark:border-white/20 bg-white dark:bg-black/40 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                {t.batchActions} : <strong className="text-blue-600 dark:text-white text-sm font-extrabold font-mono">{orders.filter(o => o.selected && o.accountName === activePDDAccount?.name).length}</strong> {t.unit}
              </span>
            </div>

            {/* Batch actions buttons list */}
            <div className="flex flex-wrap items-center gap-2">

              <button
                onClick={() => handleBatchAction('order')}
                className="px-3.5 py-1.5 bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 dark:hover:bg-blue-500/25 text-blue-600 dark:text-blue-300 rounded-lg hover:border-blue-500/40 font-bold border border-blue-500/20 dark:border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer"
                title={t.batchOrderTooltip}
              >
                <Play className="w-3.5 h-3.5" />
                {t.batchOrder}
              </button>

              <button
                onClick={() => handleBatchAction('pay')}
                className="px-3.5 py-1.5 bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/20 dark:hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 rounded-lg hover:border-amber-500/40 border border-amber-500/20 dark:border-amber-500/30 font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={t.batchPayTooltip}
              >
                <Receipt className="w-3.5 h-3.5" />
                {t.batchPay}
              </button>

              <button
                onClick={() => handleBatchAction('express')}
                className="px-3.5 py-1.5 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg hover:border-black/25 dark:hover:border-white/20 border border-black/10 dark:border-white/10 font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={t.batchExpressTooltip}
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                {t.batchExpress}
              </button>

              <button
                onClick={() => handleBatchAction('refund')}
                className="px-3.5 py-1.5 bg-rose-500/10 dark:bg-rose-500/15 hover:bg-rose-500/20 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 rounded-lg hover:border-rose-500/40 border border-rose-500/20 dark:border-rose-500/30 font-bold transition-all cursor-pointer"
                title={t.batchRefundTooltip}
              >
                {t.batchRefund}
              </button>

              <button
                onClick={() => handleBatchAction('invoice')}
                className="px-3.5 py-1.5 bg-cyan-500/1o dark:bg-cyan-500/15 hover:bg-cyan-500/20 dark:hover:bg-cyan-500/25 text-cyan-605 dark:text-cyan-300 rounded-lg hover:border-cyan-500/40 border border-cyan-500/20 dark:border-cyan-500/30 font-bold transition-all cursor-pointer"
              >
                {lang === 'zh' ? '批量开专票' : 'Batch Invoice'}
              </button>

              <button
                id="add-order-btn"
                onClick={() => setShowOrderForm(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-blue-500/15 border-none"
              >
                <Plus className="w-4 h-4 animate-bounce" />
                {t.manualAdd}
              </button>

              <button
                onClick={handleDeleteSelection}
                className="px-2.5 py-1.5 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-black/10 dark:border-white/5 rounded-lg transition-all cursor-pointer"
                title={t.batchDelete}
              >
                <Trash2 className="w-4 h-4" />
              </button>

            </div>

          </div>

          {/* Progress bar animation loop for bulk sync process */}
          {batchActionProgress !== null && (
            <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-xl space-y-2 animate-pulse text-slate-800 dark:text-slate-100">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-500 animate-spin" />
                  {batchActionLabel}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 font-extrabold">{batchActionProgress}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-650 transition-all duration-150"
                  style={{ width: `${batchActionProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Orders Listing area */}
          <div className="space-y-4">

            <div className="flex justify-between items-center text-xs">
              <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                {t.tableTitle} ({filteredOrders.length})
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t.currentRange} {startDate} ~ {endDate}
              </p>
            </div>

            {filteredOrders.length > 0 ? (
              <div className="space-y-4">
                {filteredOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onSelect={handleSelectOne}
                    onRefreshLogistics={handleRefreshSingleLogistics}
                    onOpenDetails={(ord) => setSelectedOrderDetails(ord)}
                    onApplyInvoice={handleApplySingleInvoice}
                    onReplayGroupBuy={handleReGroupBuy}
                    onContactSupport={(ord) => setChattingOrder(ord)}
                    onCopyText={handleCopyText}
                    lang={lang}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white/45 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 rounded-2xl p-12 text-center space-y-3 backdrop-blur-2xl text-slate-805 dark:text-slate-100">
                <div className="w-16 h-16 bg-blue-500/10 dark:bg-blue-500/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
                  <Search className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.noRecords}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 max-w-sm mx-auto leading-relaxed font-medium">
                    {t.noRecordsDesc}
                  </p>
                </div>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer border-none shadow-md shadow-blue-500/10"
                >
                  {lang === 'zh' ? '回扫重置条件' : 'Clear Filters'}
                </button>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer id="footer-identity" className="bg-transparent border-t border-black/5 dark:border-white/10 mt-12 py-8 text-center text-xs text-slate-500 space-y-1">
        <p>{t.copyright}</p>
        <p className="font-mono text-[10px] text-slate-650 dark:text-slate-600">{t.pddMarket} • V2.6.4 • React 19 • Tailwind CSS 4</p>
      </footer>

      {/* POPUP MODALS INTERFACES */}

      {/* Mod 1: Logistics & Details modal */}
      <LogisticsModal
        order={selectedOrderDetails}
        onClose={() => setSelectedOrderDetails(null)}
        onCopyText={handleCopyText}
        lang={lang}
      />

      {/* Mod 2: Order Manual Entry modal */}
      {showOrderForm && (
        <OrderFormModal
          accounts={accounts.map(a => a.name)}
          onClose={() => setShowOrderForm(false)}
          onSave={handleAddNewOrder}
          lang={lang}
        />
      )}

      {/* Mod 3: Live chat dialog support */}
      <ChatSimulator
        order={chattingOrder}
        onClose={() => setChattingOrder(null)}
        lang={lang}
      />

      {/* Mod 3b: Order reconciliation (订单核算) */}
      <ReconciliationModal
        open={showReconcile}
        onClose={() => setShowReconcile(false)}
        lang={lang}
        fallbackOrders={orders}
      />

      {/* Mod 4: Change Password modal */}
      {passwordModalOpen && (
        <div id="password-modal" className="fixed inset-0 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleModifyPassword}
            className="bg-white/80 dark:bg-slate-900/95 rounded-2xl p-6 max-w-sm w-full border border-white/50 dark:border-white/15 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100 backdrop-blur-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-black/5 dark:border-white/10 pb-2">
              <h4 className="text-sm font-black text-slate-805 dark:text-white flex items-center gap-1.5">
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {t.changePassTitle}
              </h4>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-500 dark:text-slate-400 mb-1">{t.oldPass}</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-black/45 text-slate-800 dark:text-slate-150 border border-black/10 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder={t.oldPassPlaceholder}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 dark:text-slate-400 mb-1">{t.newPass}</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-black/45 text-slate-800 dark:text-slate-150 border border-black/10 dark:border-white/10 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder={t.newPassPlaceholder}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="px-3 py-1.5 border border-black/15 dark:border-white/10 text-xs text-slate-600 dark:text-slate-350 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer font-bold"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg cursor-pointer shadow-md shadow-blue-600/10 border-none"
              >
                {t.confirmUpdate}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mod 5: Alipay Batch checkout simulation popup */}
      {alipayModal.isOpen && (
        <div id="alipay-modal" className="fixed inset-0 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans">
          <div
            className="bg-white/80 dark:bg-slate-900 border border-white/50 dark:border-white/15 text-slate-800 dark:text-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-black/5 dark:border-white/10 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                {t.alipayTitle}
              </h4>
              <button
                type="button"
                onClick={() => setAlipayModal({ isOpen: false, orderIdText: '', totalAmount: 0, orderIds: [] })}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/5 dark:bg-black/30 text-slate-800 dark:text-slate-100 p-4 rounded-xl space-y-3.5 text-center border border-black/5 dark:border-white/5 shadow-inner">
              <div>
                <p className="text-[10px] text-slate-500 font-bold tracking-wide">{t.mergeOrderAbbr}</p>
                <p className="text-xs font-extrabold font-mono text-slate-700 dark:text-slate-205 leading-snug line-clamp-1">{alipayModal.orderIdText}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 font-bold tracking-wide">{t.payableAmount}</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-450 font-sans">
                  ¥{alipayModal.totalAmount.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="border-t border-dashed border-black/10 dark:border-white/10 pt-3 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-450">
                <span>{lang === 'zh' ? '多开关联账号' : 'Gateway Account'}: {activePDDAccount?.name}</span>
                <span>{t.channelRate} 20% commission</span>
              </div>
            </div>

            <div className="bg-blue-500/5 dark:bg-blue-950/40 p-3 rounded-lg text-[10px] text-blue-800 dark:text-slate-405 border border-blue-500/10 dark:border-blue-900/20 flex items-start gap-1.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>{t.alipayNote}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAlipayModal({ isOpen: false, orderIdText: '', totalAmount: 0, orderIds: [] })}
                className="px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 rounded-lg transition-colors font-bold cursor-pointer"
              >
                {t.walletCancel}
              </button>
              <button
                type="button"
                onClick={handleCompleteAlipay}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-extrabold rounded-xl transition-transform cursor-pointer shadow-lg shadow-emerald-500/15 border-none"
              >
                {t.payNow}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
