import React from 'react';
import { MobileLayout, Header, GlassCard, Input } from '../components/Shared';
import { useStore } from '../store';
import { Sparkles, Send } from 'lucide-react';

const AIAssistant: React.FC = () => {
  const { t } = useStore();

  return (
    <MobileLayout>
      <Header title={t('tab.ai')} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
        
        <GlassCard style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, background: 'linear-gradient(135deg, #a855f7, #ec4899)', borderRadius: '50%', color: 'white' }}>
                <Sparkles size={24} />
            </div>
            <div>
                <h3 style={{ fontWeight: 700 }}>Guardian AI</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>I can help analyze safety reports.</p>
            </div>
        </GlassCard>

        <div style={{ flex: 1 }}>
            {/* Empty State */}
            <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.6 }}>
                <p>Ask me about family safety trends or daily reports.</p>
            </div>
        </div>

        <div className="chat-input-area" style={{ borderRadius: 24, margin: '0 -20px -20px -20px', border: 'none' }}>
           <Input 
             placeholder="Ask AI..." 
             style={{ borderRadius: 24, paddingLeft: 20 }}
           />
           <button style={{ padding: 10, background: 'var(--primary-color)', borderRadius: '50%', color: 'white' }}>
             <Send size={20} />
           </button>
        </div>

      </div>
    </MobileLayout>
  );
};

export default AIAssistant;