import { DocumentBody } from './components/DocumentBody';
import { Printer, Download, Disc } from 'lucide-react';

export default function App() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen bg-night-black">
      {/* Floating Header */}
      <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center no-print bg-night-black/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <Disc className="text-neon-purple w-6 h-6" />
          <span className="font-display text-xs tracking-[0.4em] text-white">PHANTOM.LABS</span>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={handlePrint}
            className="group relative px-6 py-2 overflow-hidden rounded border border-neon-purple/50 text-xs font-display tracking-widest text-white hover:text-night-black transition-colors cursor-pointer"
          >
            <div className="absolute inset-0 bg-neon-purple translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-out"></div>
            <span className="relative z-10 flex items-center gap-2">
              <Printer className="w-3 h-3" /> PRINT DOC
            </span>
          </button>
          <button className="bg-white text-night-black px-6 py-2 rounded text-xs font-display font-bold tracking-widest flex items-center gap-2 hover:bg-neon-cyan transition-colors cursor-pointer">
            <Download className="w-3 h-3" /> EXPORT
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="pt-24">
        <DocumentBody />
      </div>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-0 left-0 w-full px-8 py-4 no-print flex justify-between items-center text-[9px] font-display tracking-widest text-zinc-600 border-t border-white/5 bg-night-black/80 backdrop-blur-md">
        <div className="flex gap-6">
          <span>LATENCY: 12MS</span>
          <span>UPTIME: 100%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-neon-purple rounded-full"></div>
          <span>ENCRYPTED_SESSION_ACTIVE</span>
        </div>
      </div>
    </div>
  );
}

