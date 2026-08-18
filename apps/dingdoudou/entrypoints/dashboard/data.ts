/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, PinduoduoAccount, AccountStats } from '@/lib/types';

// Let's create an elegant data bank.
// The user explicitly defined one specific order, which we will place at the very top.
export const BASE_PDD_ACCOUNTS: PinduoduoAccount[] = [
  {
    id: 'pdd_01',
    pddUserId: 'pdd_01',
    name: '蓦然回首',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
    bindTime: '2026/05/20 14:30',
    status: 'ACTIVE'
  },
  {
    id: 'pdd_02',
    pddUserId: 'pdd_02',
    name: '星河璀璨',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    bindTime: '2026/06/01 10:12',
    status: 'ACTIVE'
  },
  {
    id: 'pdd_03',
    pddUserId: 'pdd_03',
    name: '往事随风',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    bindTime: '2026/06/15 16:45',
    status: 'ACTIVE'
  }
];

export const INITIAL_STATS: AccountStats = {
  edition: 'DDK-FREE-FOREVER',
  pddBindedCount: 1,
  pddMaxBinds: 1000000000,
  maxOrdersLimit: 1000000000,
  remainingDays: '不限',
  balance: 999999,
  paymentType: '支付宝',
  rebatePercent: 20
};

// Main static user defined order
const FIRST_ORDER: Order = {
  id: '260621-473725725041660',
  accountName: '蓦然回首',
  productName: '史丹利中心冲样冲定位冲子冲销圆锥冲尖头冲子钉冲金属敲击定位',
  productImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=240',
  specName: '圆锥冲2*138mm',
  quantity: 2,
  unitPrice: 13.83,
  orderAmount: 26.28, // user specified override, can think of it as heavily discounted
  productId: '776924384645',
  specId: '1758124063182',
  orderTime: '2026/06/21 09:03:08',
  status: '待收货',
  storeName: 'STANLEY史丹利因珀特专卖店',
  recipientName: '299 环亚梁菲菲 299',
  recipientPhone: '18024087406',
  recipientAddress: '广东省佛山市南海区里水镇甘焦怡和二路SPA888中坦云仓299梁菲菲299',
  expressCompany: '韵达快递',
  expressNumber: '465441954454324',
  shippingTime: '2026/06/21 11:33:39',
  latestTrack: '商家已发货，正在通知韵达快递取件',
  trackingDetails: [
    { time: '2026/06/21 11:33:45', description: '【韵达快递】商家已发货，正在通知快递员取件' },
    { time: '2026/06/21 11:33:39', description: '【系统信息】您的订单已成功分配韵达快递单号 465441954454324' },
    { time: '2026/06/21 09:10:00', description: '【拼多多】商家已接单，准备进行商品包装' },
    { time: '2026/06/21 09:03:08', description: '【系统信息】买家已成功付款并完成拼单，支付金额 ¥26.28' }
  ],
  invoiceStatus: '未申请',
  groupBuyUrl: 'https://mobile.yangkeduo.com/group.html?group_order_id=260621-473725725041660'
};

const SECOND_ORDER: Order = {
  id: '260620-883719204918231',
  accountName: '蓦然回首',
  productName: '世达(SATA)五金工具工业级多功能剥线钳电工压接剥线压线钳子',
  productImage: 'https://images.unsplash.com/photo-1540103711724-eb18534c4416?auto=format&fit=crop&q=80&w=240',
  specName: '8英寸多功能精品款',
  quantity: 1,
  unitPrice: 58.00,
  orderAmount: 48.00, // discount
  productId: '458129038411',
  specId: '2938120489128',
  orderTime: '2026/06/20 18:22:15',
  status: '待发货',
  storeName: 'SATA世达工具官方旗舰店',
  recipientName: '299 环亚梁菲菲 299',
  recipientPhone: '18024087406',
  recipientAddress: '广东省佛山市南海区里水镇甘焦怡和二路SPA888中坦云仓299梁菲菲299',
  invoiceStatus: '未申请',
  groupBuyUrl: 'https://mobile.yangkeduo.com/group.html?group_order_id=260620-883719204918231',
  trackingDetails: [
    { time: '2026/06/20 18:25:00', description: '【拼多多】订单已成团，等待商家发货' },
    { time: '2026/06/20 18:22:15', description: '【系统信息】买家已付款并拼团成功' }
  ]
};

const THIRD_ORDER: Order = {
  id: '260619-338274910283749',
  accountName: '星河璀璨',
  productName: '德力西电气(DELIXI)双色双重高绝缘电工胶带耐高温阻燃PVC胶布',
  productImage: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&q=80&w=240',
  specName: '红黄蓝绿黑白 6卷装',
  quantity: 1,
  unitPrice: 12.90,
  orderAmount: 11.90,
  productId: '662910394811',
  specId: '992810483210',
  orderTime: '2026/06/19 14:15:30',
  status: '已签收',
  storeName: '德力西工具旗舰店',
  recipientName: '299 环亚梁菲菲 299',
  recipientPhone: '18024087406',
  recipientAddress: '广东省佛山市南海区里水镇甘焦怡和二路SPA888中坦云仓299梁菲菲299',
  expressCompany: '圆通速递',
  expressNumber: 'YT8819203948110',
  shippingTime: '2026/06/19 16:30:00',
  latestTrack: '快件已在 怡和二路中坦云仓 签收，投递员：小刘(15544332211)',
  trackingDetails: [
    { time: '2026/06/20 12:00:00', description: '【圆通速递】快件已由 怡和二路中坦云仓 签收，感谢使用圆通快递！' },
    { time: '2026/06/20 08:30:00', description: '【圆通速递】广东省佛山市南海区里水镇甘焦网点 派件中，派件员：小刘(15544332211)' },
    { time: '2026/06/19 19:15:00', description: '【圆通速递】快件已到达 佛山转运中心' },
    { time: '2026/06/19 16:30:00', description: '【圆通速递】商家已发货，快递员正全速赶往网点' }
  ],
  invoiceStatus: '已申请',
  groupBuyUrl: 'https://mobile.yangkeduo.com/group.html?group_order_id=260619-338274910283749'
};

const FOURTH_ORDER: Order = {
  id: '260618-228374921029381',
  accountName: '星河璀璨',
  productName: '蓝星汽车水箱防冻液 1L装 红色-25℃ 四季通用发动机冷却液',
  productImage: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=240',
  specName: '高品质红色-25度 1L',
  quantity: 3,
  unitPrice: 19.90,
  orderAmount: 55.00,
  productId: '883920194812',
  specId: '3819204918239',
  orderTime: '2026/06/18 10:05:12',
  status: '已签收',
  storeName: '蓝星汽车养护用品专营店',
  recipientName: '305 顺丰丰泰张小龙 305',
  recipientPhone: '13812345678',
  recipientAddress: '上海市浦东新区张江高科技园区博云路2号889仓张小龙',
  expressCompany: '顺丰速运',
  expressNumber: 'SF10293810293',
  shippingTime: '2026/06/18 12:15:00',
  latestTrack: '您的快件已投递至快递柜，请凭取件码取件',
  trackingDetails: [
    { time: '2026/06/19 10:11:00', description: '【顺丰速运】快件已送达快递柜，请凭密码 5892 取件' },
    { time: '2026/06/19 04:30:00', description: '【顺丰速运】快件已到达 上海张江集散中心' },
    { time: '2026/06/18 12:15:00', description: '【顺丰速运】商家已发货，已通知顺丰上门取件' }
  ],
  invoiceStatus: '未申请',
  groupBuyUrl: 'https://mobile.yangkeduo.com/group.html?group_order_id=260618-228374921029381'
};

const FIFTH_ORDER: Order = {
  id: '260621-998274819028312',
  accountName: '往事随风',
  productName: '三只松鼠坚果礼盒1335g/8袋 端午中秋坚果大礼包健康坚果零食',
  productImage: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&q=80&w=240',
  specName: '松鼠风尚大礼包 1335g',
  quantity: 1,
  unitPrice: 69.00,
  orderAmount: 65.00,
  productId: '112938102938',
  specId: '5582910391238',
  orderTime: '2026/06/21 15:44:22',
  status: '已退款',
  storeName: '三只松鼠官方旗舰店',
  recipientName: '122 极兔云配王林 122',
  recipientPhone: '15988887766',
  recipientAddress: '浙江省杭州市余杭区仓前街道欧美金融城5幢王林',
  expressCompany: '极兔速递',
  expressNumber: 'JT992810394811',
  shippingTime: '2026/06/21 16:00:00',
  latestTrack: '退款成功，原路返回支付宝 ¥65.00',
  trackingDetails: [
    { time: '2026/06/21 18:20:00', description: '【拼多多】退款操作成功，款项已原路退回至支付账户。' },
    { time: '2026/06/21 18:00:00', description: '【商家客服】经协商一致，商家批准买家极速退款申请' },
    { time: '2026/06/21 17:35:00', description: '【系统信息】买家发起了“仅退款”申请，原因：买错了/不想要了' }
  ],
  invoiceStatus: '未申请',
  groupBuyUrl: 'https://mobile.yangkeduo.com/group.html?group_order_id=260621-998274819028312'
};

// Generate an elegant, comprehensive collection of 127 items representing 3 main recipients
// so filters operate in a high-fidelity environment.
export function generateMockOrders(): Order[] {
  const baseList: Order[] = [
    FIRST_ORDER,
    SECOND_ORDER,
    THIRD_ORDER,
    FOURTH_ORDER,
    FIFTH_ORDER
  ];

  const productTemplates = [
    { name: '绿联(UGREEN) Type-C数据线 5A超极速快充线 1.5米灰色双弯头', price: 15.9, store: '绿联数码官方旗舰店', cat: '数码' },
    { name: '晨光(M&G) GP-380大容量经典按动中性笔 0.5mm 黑色 12支装', price: 18.8, store: '晨光办公文具专卖店', cat: '办公' },
    { name: '公牛(BULL) 国标1.8米插线板接线板防过载五孔插座多功能插排', price: 39.0, store: '公牛电工五金专卖店', cat: '五金' },
    { name: '维达(Vinda) 超韧3层细韧抽纸 130抽*24包整箱装 湿水不易破', price: 45.9, store: '维达纸业官方旗舰店', cat: '日用' },
    { name: '飞利浦(PHILIPS) 螺口LED灯泡 卧室护眼超亮 12W 暖黄光', price: 22.5, store: '飞利浦光源官方直营店', cat: '家居' },
    { name: '特步(XTEP) 男鞋夏季透气网面轻便跑步鞋 休闲极速阿飞慢跑鞋', price: 139.0, store: '特步官方体育鞋类旗舰店', cat: '服装' },
    { name: '鲁花(LUHUA) 5S压榨一级花生油 5L 物理压榨经典浓香中国味道', price: 149.0, store: '鲁花粮油官方旗舰店', cat: '食品' }
  ];

  const recipients = [
    { name: '299 环亚梁菲菲 299', phone: '18024087406', addr: '广东省佛山市南海区里水镇甘焦怡和二路SPA888中坦云仓299梁菲菲299' },
    { name: '305 顺丰丰泰张小龙 305', phone: '13812345678', addr: '上海市浦东新区张江高科技园区博云路2号889仓张小龙' },
    { name: '122 极兔云配王林 122', phone: '15988887766', addr: '浙江省杭州市余杭区仓前街道欧美金融城5幢王林' }
  ];

  const accounts = ['蓦然回首', '星河璀璨', '往事随风'];
  const statuses: Order['status'][] = ['待支付', '待发货', '待收货', '已签收', '已退款'];
  const expresses = [
    { company: '韵达快递', code: '465' },
    { company: '圆通速递', code: 'YT' },
    { company: '顺丰速运', code: 'SF' },
    { company: '极兔速递', code: 'JT' },
    { company: '申通快递', code: 'ST' }
  ];

  // We want to fill up exactly to 127 items, ensuring that recipient proportions match
  // 127 items total, with 3 recipients.
  let currentCount = baseList.length;

  for (let i = 0; i < 122; i++) {
    const template = productTemplates[i % productTemplates.length];
    const rec = recipients[i % recipients.length];
    const acc = accounts[i % accounts.length];
    const status = statuses[i % statuses.length];
    const qty = (i % 2) + 1;
    const finalPrice = template.price;
    const amount = Number((finalPrice * qty - (i % 3) * 2).toFixed(2));

    const offsetDays = i % 10;
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - offsetDays);
    const dateStr = orderDate.toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/-/g, '/');

    const express = expresses[i % expresses.length];
    const expressNum = express.code + Math.floor(Math.random() * 899999999999 + 100000000000);

    baseList.push({
      id: `${260621 - offsetDays}-${Math.floor(100000000000000 + Math.random() * 900000000000000)}`,
      accountName: acc,
      productName: template.name,
      productImage: `https://images.unsplash.com/photo-${1581092160607 + (i % 10) * 1000}?auto=format&fit=crop&q=80&w=240`,
      specName: `规格模型-${i % 4 + 1}`,
      quantity: qty,
      unitPrice: finalPrice,
      orderAmount: amount > 0 ? amount : finalPrice,
      productId: String(776924384600 + i),
      specId: String(1758124063000 + i),
      orderTime: dateStr,
      status: status,
      storeName: template.store,
      recipientName: rec.name,
      recipientPhone: rec.phone,
      recipientAddress: rec.addr,
      expressCompany: status !== '待支付' && status !== '待发货' ? express.company : undefined,
      expressNumber: status !== '待支付' && status !== '待发货' ? expressNum : undefined,
      shippingTime: status !== '待支付' && status !== '待发货' ? dateStr : undefined,
      latestTrack: status === '已签收' ? '快件派送完成，买家已确认签收' : status === '待收货' ? '快件运输中，正发往目的派送点' : undefined,
      invoiceStatus: i % 5 === 0 ? '已申请' : '未申请',
      groupBuyUrl: `https://mobile.yangkeduo.com/group.html?group_order_id=${i}`
    });
  }

  return baseList;
}
