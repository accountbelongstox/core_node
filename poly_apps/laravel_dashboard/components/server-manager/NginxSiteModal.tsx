import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { NginxSite, NginxSiteCreateRequest, Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { commonClasses } from '../../styles/theme';

interface NginxSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NginxSiteCreateRequest) => Promise<void>;
  site?: NginxSite | null;
  lang?: Language;
}

const NginxSiteModal: React.FC<NginxSiteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  site,
  lang = 'en'
}) => {
  const t = TRANSLATIONS[lang].server.nginx;
  const isEdit = !!site;

  const [formData, setFormData] = useState<NginxSiteCreateRequest>({
    site_name: '',
    domain: '',
    site_type: 'laravel',
    www_dir: '/www/wwwroot/',
    php_mode: 'php-fpm',
    swoole_port: undefined,
    ssl_enabled: false
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (site) {
      setFormData({
        site_name: site.site_name,
        domain: site.domain,
        site_type: site.site_type || 'laravel',
        www_dir: site.www_dir || '/www/wwwroot/',
        php_mode: site.php_mode || 'php-fpm',
        swoole_port: site.swoole_port,
        ssl_enabled: site.ssl_enabled || false
      });
    } else {
      setFormData({
        site_name: '',
        domain: '',
        site_type: 'laravel',
        www_dir: '/www/wwwroot/',
        php_mode: 'php-fpm',
        swoole_port: undefined,
        ssl_enabled: false
      });
    }
  }, [site]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save site:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof NginxSiteCreateRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`${commonClasses.card} w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? t.update : t.create_site}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t.site_name}</label>
            <input
              type="text"
              required
              value={formData.site_name}
              onChange={(e) => handleChange('site_name', e.target.value)}
              disabled={isEdit}
              className={commonClasses.input}
              placeholder="example_com"
            />
            <p className="text-xs text-slate-500 mt-1">Config file name (no spaces or special characters)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t.domain}</label>
            <input
              type="text"
              required
              value={formData.domain}
              onChange={(e) => handleChange('domain', e.target.value)}
              className={commonClasses.input}
              placeholder="example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t.site_type}</label>
            <select
              value={formData.site_type}
              onChange={(e) => handleChange('site_type', e.target.value)}
              className={commonClasses.input}
            >
              <option value="laravel">Laravel</option>
              <option value="static">Static</option>
              <option value="proxy">Reverse Proxy</option>
              <option value="swoole">Swoole</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t.www_dir}</label>
            <input
              type="text"
              required
              value={formData.www_dir}
              onChange={(e) => handleChange('www_dir', e.target.value)}
              className={commonClasses.input}
              placeholder="/www/wwwroot/example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t.php_mode}</label>
            <select
              value={formData.php_mode}
              onChange={(e) => handleChange('php_mode', e.target.value)}
              className={commonClasses.input}
            >
              <option value="php-fpm">PHP-FPM</option>
              <option value="swoole">Swoole</option>
              <option value="none">None (Static)</option>
            </select>
          </div>

          {formData.php_mode === 'swoole' && (
            <div>
              <label className="block text-sm font-medium mb-2">{t.swoole_port}</label>
              <input
                type="number"
                value={formData.swoole_port || ''}
                onChange={(e) => handleChange('swoole_port', parseInt(e.target.value) || undefined)}
                className={commonClasses.input}
                placeholder="9501"
                min="1024"
                max="65535"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ssl_enabled"
              checked={formData.ssl_enabled}
              onChange={(e) => handleChange('ssl_enabled', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="ssl_enabled" className="text-sm font-medium">{t.ssl_enabled}</label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : (isEdit ? t.update : t.create)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NginxSiteModal;
