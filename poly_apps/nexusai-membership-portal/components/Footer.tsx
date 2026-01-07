import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';

const Footer: React.FC = () => {
  const { t } = useAppContext();

  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: t.product || 'Product',
      links: [
        { name: t.modelPricingTitle || 'Model Pricing', path: '/pricing' },
        { name: t.subscribeTitle || 'Subscribe Center', path: '/subscribe' },
        { name: t.docsTitle || 'Documentation', path: '/docs' },
      ],
    },
    {
      title: t.company || 'Company',
      links: [
        { name: t.about || 'About Us', path: '#' },
        { name: t.contact || 'Contact', path: '#' },
        { name: t.privacy || 'Privacy Policy', path: '#' },
      ],
    },
    {
      title: t.resources || 'Resources',
      links: [
        { name: t.apiDocs || 'API Documentation', path: '/docs' },
        { name: t.support || 'Support', path: '#' },
        { name: t.status || 'Status', path: '#' },
      ],
    },
  ];

  return (
    <footer className="border-t dark:border-white/5 border-slate-200 mt-20">
      <div className="max-w-[1700px] mx-auto px-6 sm:px-12 md:px-20 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Section */}
          <div className="col-span-1">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center font-bold italic text-white shadow-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-extrabold text-xl tracking-tighter dark:text-white text-slate-900">
                  toprouter<span className="text-blue-500">.cn</span>
                </span>
              </div>
            </div>
            <p className="text-sm dark:text-slate-400 text-slate-600 leading-relaxed">
              {t.footerDescription || 'TopRouter Infrastructure, providing enterprise-grade multi-model acceleration services for AI applications.'}
            </p>
          </div>

          {/* Links Sections */}
          {footerLinks.map((section, idx) => (
            <div key={idx}>
              <h4 className="text-sm font-black uppercase tracking-wider mb-6 dark:text-slate-300 text-slate-700">
                {section.title}
              </h4>
              <ul className="space-y-4">
                {section.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <Link
                      to={link.path}
                      className="text-sm dark:text-slate-400 text-slate-600 hover:text-blue-500 transition-colors font-medium"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t dark:border-white/5 border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs dark:text-slate-500 text-slate-500">
            © {currentYear} toprouter.cn. {t.allRightsReserved || 'All rights reserved.'}
          </p>
          <div className="flex items-center gap-6 text-xs dark:text-slate-500 text-slate-500">
            <span>{t.infrastructureVersion || 'TopRouter Infrastructure V3.0'}</span>
            <span className="text-green-500 font-bold">●</span>
            <span>{t.healthStatus || '99.98% HEALTH'}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

