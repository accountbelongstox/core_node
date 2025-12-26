import React, { useState } from 'react';
import { MessageSquare, Phone, HelpCircle, ChevronDown, Send } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const CustomerService: React.FC = () => {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const { t } = useLanguage();

  return (
    <div className="min-h-screen pb-24 bg-mil-base transition-colors duration-300">
       {/* Page Header */}
       <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="bg-tac-orange/10 dark:bg-tac-orange/20 p-2 rounded-full border border-tac-orange/30 dark:border-tac-orange/50">
                <HelpCircle className="w-6 h-6 text-tac-orange" />
            </div>
            <div>
                <h1 className="text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-white">{t.service.title}</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{t.service.subtitle}</p>
            </div>
          </div>
       </div>

       <div className="p-4 space-y-6">
          {/* Direct Actions */}
          <div className="grid grid-cols-2 gap-4">
              <button className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-4 rounded-sm flex flex-col items-center gap-2 hover:border-tac-orange transition-colors group shadow-sm dark:shadow-none">
                  <MessageSquare className="w-8 h-8 text-slate-400 group-hover:text-tac-orange transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider text-mil-base">{t.service.live_chat}</span>
                  <span className="text-[10px] text-green-500 font-mono">● {t.service.online}</span>
              </button>
              <button className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-4 rounded-sm flex flex-col items-center gap-2 hover:border-tac-orange transition-colors group shadow-sm dark:shadow-none">
                  <Phone className="w-8 h-8 text-slate-400 group-hover:text-tac-orange transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider text-mil-base">{t.service.voice}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{t.service.wait}</span>
              </button>
          </div>

          {/* Quick Contact Form */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-sm">
             <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                <Send className="w-3 h-3 text-tac-orange" /> {t.service.dispatch}
             </h3>
             <div className="space-y-3">
                <input type="text" placeholder={t.service.subject} className="w-full bg-white dark:bg-mil-base border border-slate-300 dark:border-slate-700 p-2 text-xs rounded-sm focus:border-tac-orange outline-none text-mil-base placeholder-slate-400" />
                <textarea placeholder={t.service.content} rows={3} className="w-full bg-white dark:bg-mil-base border border-slate-300 dark:border-slate-700 p-2 text-xs rounded-sm focus:border-tac-orange outline-none resize-none text-mil-base placeholder-slate-400"></textarea>
                <button className="w-full bg-slate-800 dark:bg-slate-800 hover:bg-tac-orange hover:text-white border border-slate-600 dark:border-slate-600 text-white dark:text-slate-300 py-2 text-xs font-bold uppercase tracking-wider transition-colors">
                    {t.service.send}
                </button>
             </div>
          </div>

          {/* FAQ Section */}
          <div>
              <h3 className="text-xs font-mono text-slate-500 uppercase mb-3 pl-2 border-l-2 border-slate-300 dark:border-slate-700">{t.service.faq}</h3>
              <div className="space-y-2">
                  {t.service.faqs.map((faq: any, index: number) => (
                      <div key={index} className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 rounded-sm overflow-hidden shadow-sm dark:shadow-none">
                          <button 
                            onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                            className="w-full flex items-center justify-between p-3 text-left"
                          >
                              <span className="text-xs font-bold text-mil-base">{faq.q}</span>
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${activeFaq === index ? 'rotate-180' : ''}`} />
                          </button>
                          {activeFaq === index && (
                              <div className="p-3 pt-0 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/30 leading-relaxed">
                                  {faq.a}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
       </div>
    </div>
  );
};

export default CustomerService;