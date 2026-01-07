
import React from 'react';
import { useAppContext } from '../App';
import { Icons } from '../constants';

interface ModelPrice {
  name: string;
  inputPrice: string;
  outputPrice: string;
  description: string;
}

const ModelPricingPage = () => {
  const { t } = useAppContext();
  
  // Model pricing data
  const models: ModelPrice[] = [
    { name: t.modelClaudeSonnet, inputPrice: '$3.00', outputPrice: '$15.00', description: t.modelDescClaude },
    { name: t.modelGpt4o, inputPrice: '$2.50', outputPrice: '$10.00', description: t.modelDescGpt4o },
    { name: t.modelGeminiPro, inputPrice: '$0.50', outputPrice: '$1.50', description: t.modelDescGemini },
    { name: t.modelDeepSeekV3, inputPrice: '$0.14', outputPrice: '$0.56', description: t.modelDescDeepSeek },
    { name: t.modelLlama31, inputPrice: '$0.30', outputPrice: '$0.30', description: t.modelDescLlama },
  ];

  return (
    <div className="min-h-screen p-6 sm:p-12 md:p-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black mb-6 tracking-tighter italic">{t.modelPricingTitle}</h1>
          <p className="dark:text-slate-400 text-slate-500 text-xl font-medium">{t.modelPricingDescription}</p>
        </div>

        <div className="glass rounded-[4rem] overflow-hidden border-white/5 shadow-2xl">
          <table className="w-full text-left">
            <thead className="dark:bg-white/5 bg-slate-50 border-b dark:border-white/5 border-slate-200">
              <tr className="text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-500">
                <th className="px-12 py-10 italic">{t.modelName}</th>
                <th className="px-12 py-10 italic">{t.inputPrice}</th>
                <th className="px-12 py-10 italic">{t.outputPrice}</th>
                <th className="px-12 py-10 italic">{t.modelDescription || 'Description'}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5 divide-slate-100 font-medium">
              {models.map((model, idx) => (
                <tr key={idx} className="dark:hover:bg-white/[0.02] hover:bg-slate-50/50 transition-colors group">
                  <td className="px-12 py-10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                        <Icons.Cpu />
                      </div>
                      <span className="text-base font-black italic">{model.name}</span>
                    </div>
                  </td>
                  <td className="px-12 py-10">
                    <span className="text-lg font-black text-blue-500">{model.inputPrice}</span>
                    <span className="text-xs text-slate-500 ml-2">{t.perToken}</span>
                  </td>
                  <td className="px-12 py-10">
                    <span className="text-lg font-black text-purple-500">{model.outputPrice}</span>
                    <span className="text-xs text-slate-500 ml-2">{t.perToken}</span>
                  </td>
                  <td className="px-12 py-10 text-sm text-slate-500 dark:text-slate-400">{model.description || t.modelDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModelPricingPage;

