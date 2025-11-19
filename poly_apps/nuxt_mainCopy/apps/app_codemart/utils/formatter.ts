/**
 * CodeMart Formatter Utility Service
 * Centralized formatting functions to eliminate duplication across components
 * Supports: Numbers, Currency, Dates, Relative Time, and specialized formatting
 */

interface FormatterOptions {
  locale?: string;
  currency?: string;
  timezone?: string;
}

const DEFAULT_OPTIONS: FormatterOptions = {
  locale: 'zh-CN',
  currency: '¥',
  timezone: 'Asia/Shanghai',
};

export class CodeMartFormatter {
  private options: FormatterOptions;

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString(this.options.locale || 'zh-CN');
  }

  formatCurrency(amount: number | null | undefined, customCurrency?: string): string {
    if (amount === null || amount === undefined) return `${this.options.currency}0`;
    const formatted = this.formatNumber(amount);
    const currency = customCurrency || this.options.currency || '¥';
    return `${currency}${formatted}`;
  }

  formatDate(
    date: string | Date | null | undefined,
    format?: 'short' | 'long' | 'full'
  ): string {
    if (!date) return '-';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';

    const locale = this.options.locale || 'zh-CN';

    switch (format) {
      case 'long':
        return dateObj.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'full':
        return dateObj.toLocaleString(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      case 'short':
      default:
        return dateObj.toLocaleDateString(locale);
    }
  }

  formatRelativeTime(
    date: string | Date | null | undefined,
    nowDate?: Date
  ): string {
    if (!date) return '-';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';

    const now = nowDate || new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return `${diffSeconds}秒前`;
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    }

    if (diffHours < 24) {
      return `${diffHours}小时前`;
    }

    if (diffDays < 7) {
      return `${diffDays}天前`;
    }

    if (diffWeeks < 4) {
      return `${diffWeeks}周前`;
    }

    if (diffMonths < 12) {
      return `${diffMonths}个月前`;
    }

    return `${diffYears}年前`;
  }

  formatTime(
    date: string | Date | null | undefined,
    includeSeconds?: boolean
  ): string {
    if (!date) return '-';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';

    return dateObj.toLocaleTimeString(this.options.locale || 'zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    });
  }

  formatDateTime(
    date: string | Date | null | undefined,
    includeTime?: boolean
  ): string {
    if (!date) return '-';

    if (includeTime) {
      return this.formatDate(date, 'full');
    }

    return this.formatDate(date, 'short');
  }

  formatYearsOfExperience(years: number | null | undefined): string {
    if (years === null || years === undefined || years === 0) {
      return '1年以下';
    }

    if (years < 1) {
      const months = Math.round(years * 12);
      return `${months}个月`;
    }

    return `${years}年`;
  }

  formatPercentage(value: number | null | undefined, decimals: number = 0): string {
    if (value === null || value === undefined) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
  }

  formatPhoneNumber(phone: string | null | undefined): string {
    if (!phone) return '-';

    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }

    return phone;
  }

  formatEmail(email: string | null | undefined): string {
    if (!email) return '-';

    const parts = email.split('@');
    if (parts.length !== 2) return email;

    const [localPart, domain] = parts;
    if (localPart.length <= 3) {
      return email;
    }

    const masked = localPart.substring(0, 3) + '****';
    return `${masked}@${domain}`;
  }

  formatDuration(
    milliseconds: number | null | undefined,
    units?: 'short' | 'long'
  ): string {
    if (milliseconds === null || milliseconds === undefined || milliseconds === 0) {
      return '-';
    }

    const isLong = units === 'long';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}${isLong ? '小时' : 'h'}`);
    }

    if (minutes > 0) {
      parts.push(`${minutes}${isLong ? '分钟' : 'm'}`);
    }

    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}${isLong ? '秒' : 's'}`);
    }

    return parts.join(' ');
  }

  formatFileSize(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  formatString(
    value: string | null | undefined,
    maxLength?: number,
    ellipsis?: string
  ): string {
    if (!value) return '-';

    if (maxLength && value.length > maxLength) {
      return value.substring(0, maxLength) + (ellipsis || '...');
    }

    return value;
  }

  truncate(
    text: string | null | undefined,
    maxLength: number,
    ellipsis: string = '...'
  ): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + ellipsis;
  }

  capitalize(str: string | null | undefined): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  uppercase(str: string | null | undefined): string {
    return (str || '').toUpperCase();
  }

  lowercase(str: string | null | undefined): string {
    return (str || '').toLowerCase();
  }

  slugify(str: string | null | undefined): string {
    if (!str) return '';

    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  formatUserRole(role: string | null | undefined): string {
    const roleMap: Record<string, string> = {
      'client': '客户',
      'developer': '开发者',
      'architect': '框架师',
      'reviewer': '点评者',
      'admin': '管理员',
    };

    return roleMap[role?.toLowerCase() || ''] || role || '-';
  }

  formatProjectStatus(status: string | null | undefined): string {
    const statusMap: Record<string, string> = {
      'draft': '草稿',
      'open': '招标中',
      'in_progress': '进行中',
      'paused': '暂停',
      'completed': '已完成',
      'cancelled': '已取消',
      'archived': '已归档',
    };

    return statusMap[status?.toLowerCase() || ''] || status || '-';
  }

  formatTaskStatus(status: string | null | undefined): string {
    const statusMap: Record<string, string> = {
      'open': '开放中',
      'assigned': '已分配',
      'in_progress': '进行中',
      'submitted': '已提交',
      'under_review': '审核中',
      'approved': '已批准',
      'rejected': '已驳回',
      'completed': '已完成',
    };

    return statusMap[status?.toLowerCase() || ''] || status || '-';
  }

  formatPaymentStatus(status: string | null | undefined): string {
    const statusMap: Record<string, string> = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'failed': '失败',
      'cancelled': '已取消',
      'refunded': '已退款',
    };

    return statusMap[status?.toLowerCase() || ''] || status || '-';
  }
}

export const createFormatter = (options?: Partial<FormatterOptions>) => {
  return new CodeMartFormatter(options);
};

export const formatter = createFormatter();

export default CodeMartFormatter;
