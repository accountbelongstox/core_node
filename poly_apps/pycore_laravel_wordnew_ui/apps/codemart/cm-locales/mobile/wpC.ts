import { defineMobileLocale } from './defineMobileLocale';

/** Work package C: wallet, verification, profile, settings, admin-lite. */
export const cmMobileWpC = defineMobileLocale(
  {
    settings: {
      preferences: 'Preferences',
      account: 'Account',
      security: 'Security',
    },
    c: {
      copy: 'Copy',
      copied: 'Copied',
      done: 'Done',
      topUp: 'Add funds',
      withdraw: 'Withdraw',
      pay: 'Pay',
      takePhoto: 'Take photo',
      chooseFile: 'Choose file',
      adminNotes: 'Notes from our team',
      depositDetailTitle: 'Deposit #{{id}}',
      admin: {
        more: 'More console tools',
        webPage: 'Opens the full web page',
        consoleHint: 'Approvals and platform queues',
        policyEditHint: 'Platform rules are read-only on the phone. Open the web console to edit them.',
        openWebConsole: 'Open the web console',
      },
    },
  },
  {
    settings: {
      preferences: '偏好',
      account: '账号',
      security: '安全',
    },
    c: {
      copy: '复制',
      copied: '已复制',
      done: '完成',
      topUp: '充值',
      withdraw: '提现',
      pay: '付款',
      takePhoto: '拍照',
      chooseFile: '从相册选择',
      adminNotes: '平台备注',
      depositDetailTitle: '保证金 #{{id}}',
      admin: {
        more: '更多管理工具',
        webPage: '在完整网页中打开',
        consoleHint: '审批与平台待办队列',
        policyEditHint: '手机上只能查看平台规则，如需修改请打开网页版管理台。',
        openWebConsole: '打开网页版管理台',
      },
    },
  },
);
