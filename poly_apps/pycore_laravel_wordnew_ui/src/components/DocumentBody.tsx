import { Terminal, CheckCircle2, AlertCircle, Info, FileText, Zap, Music, Disc } from 'lucide-react';

export function DocumentBody() {
  return (
    <main className="min-h-screen bg-night-black py-12 px-4 no-scrollbar">
      <div className="flex flex-col items-center">
        
        {/* Page 1: Cover */}
        <section className="doc-page overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple opacity-10 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-pink opacity-10 blur-[100px]"></div>
          
          <div className="h-full flex flex-col justify-between relative z-10">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <Disc className="text-neon-purple w-8 h-8" />
                <span className="font-display text-sm tracking-widest text-neon-purple">PHANTOM LABS</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-display text-zinc-500 uppercase tracking-[0.3em]">Confidential Protocol</p>
                <p className="text-xs font-mono text-zinc-400">REF: 2026.05.19_X</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="font-display text-7xl font-black leading-[0.9] tracking-tighter uppercase text-white neon-text-purple">
                  DIGITAL<br />
                  <span className="text-neon-purple">NOIR</span><br />
                  ARCH
                </h1>
              </div>
              <div className="w-24 h-1 bg-neon-purple shadow-[0_0_10px_#BC13FE]"></div>
              <p className="max-w-md text-sm font-light text-zinc-400 leading-relaxed tracking-wide">
                SYSTEM ARCHITECTURE & PRODUCT DESIGN GUIDELINES FOR THE NEXT GENERATION OF IMMERSIVE INTERFACES. 
                STRICTLY FOR INTERNAL USE ONLY.
              </p>
            </div>

            <div className="flex justify-between items-end border-t border-zinc-800 pt-8">
              <div className="flex gap-4">
                 {[1, 2, 3].map(i => (
                   <div key={i} className="w-1.5 h-1.5 bg-neon-purple rounded-full opacity-30"></div>
                 ))}
              </div>
              <p className="text-[10px] font-display tracking-widest text-zinc-500">EST. 2026 / NEO-TOKYO</p>
            </div>
          </div>
        </section>

        {/* Page 2: Design Language */}
        <section className="doc-page">
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold tracking-widest border-l-4 border-neon-purple pl-6">
                I. VISUAL IDENTITY
              </h2>
              <span className="text-xs font-mono text-zinc-600">PAGE 02</span>
            </div>

            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="aspect-square bg-[#0D0D0D] border border-zinc-800 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-neon-purple/20 to-transparent"></div>
                  <Zap className="w-12 h-12 text-neon-purple" />
                </div>
                <h3 className="font-display text-xs font-bold tracking-wider text-neon-purple">NEON HIERARCHY</h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-light">
                  Use luminance to define interaction depth. The primary action must glow, secondary elements fade into the darkness of the grid.
                </p>
              </div>

              <div className="space-y-4">
                <div className="aspect-square bg-[#0D0D0D] border border-zinc-800 flex items-center justify-center relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-bl from-neon-pink/10 to-transparent"></div>
                   <Music className="w-12 h-12 text-neon-pink" />
                </div>
                <h3 className="font-display text-xs font-bold tracking-wider text-neon-pink">VIBRATION ENGINE</h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-light">
                  Haptic feedback rhythms should mimic 4/4 time signatures to maintain user immersion in the high-fidelity ecosystem.
                </p>
              </div>
            </div>

            <div className="p-8 bg-[#0D0D0D] border border-zinc-800 rounded-lg relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Disc className="w-20 h-20 rotate-45" />
               </div>
               <h4 className="font-display text-[10px] font-bold text-zinc-400 mb-4 tracking-widest">COLOR PALETTE PROFILES</h4>
               <div className="flex gap-2">
                 {['#BC13FE', '#FF00E4', '#00F3FF', '#1A1A1A', '#050505'].map(color => (
                   <div key={color} className="flex-1 h-12 rounded border border-white/5" style={{ background: color }}></div>
                 ))}
               </div>
            </div>
          </div>
        </section>

        {/* Page 3: Technical Specs */}
        <section className="doc-page">
          <div className="space-y-12 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold tracking-widest border-l-4 border-neon-cyan pl-6">
                II. CORE MODEL
              </h2>
              <span className="text-xs font-mono text-zinc-600">PAGE 03</span>
            </div>

            <div className="flex-grow space-y-8">
              <div className="border border-zinc-800 rounded-lg bg-[#0D0D0D] p-1 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-900/50">
                      <th className="px-6 py-4 text-[9px] font-display text-zinc-500 tracking-[0.2em]">IDENTIFIER</th>
                      <th className="px-6 py-4 text-[9px] font-display text-zinc-500 tracking-[0.2em]">TYPE</th>
                      <th className="px-6 py-4 text-[9px] font-display text-zinc-500 tracking-[0.2em]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {[
                      { id: 'AUTH_GATE_01', type: 'ENCRYPTED', status: 'ACTIVE' },
                      { id: 'DATA_PULSE_X', type: 'STREAMING', status: 'STANDBY' },
                      { id: 'UI_SHADOW_0', type: 'RENDERING', status: 'ACTIVE' },
                      { id: 'LOG_TRACE_22', type: 'MUTABLE', status: 'FAULT' },
                    ].map((row) => (
                      <tr key={row.id}>
                        <td className="px-6 py-4 font-mono text-xs text-white">{row.id}</td>
                        <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">{row.type}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            row.status === 'ACTIVE' ? 'bg-neon-purple/20 text-neon-purple' : 
                            row.status === 'FAULT' ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <h3 className="font-display text-[11px] font-bold tracking-widest text-zinc-400 italic underline decoration-neon-cyan underline-offset-8">ARCHITECTURAL SCHEMATIC</h3>
                <div className="p-10 border border-dashed border-zinc-700 bg-zinc-900/10 rounded-xl relative">
                  <div className="flex justify-between items-center h-20">
                     <div className="w-24 h-12 border border-neon-cyan flex items-center justify-center neon-border-purple neon-text-purple">
                        <span className="font-mono text-[9px] text-white">GATEWAY</span>
                     </div>
                     <div className="flex-grow h-[1px] bg-gradient-to-r from-neon-cyan to-neon-purple mx-4 relative">
                        <div className="absolute left-1/2 -top-1 w-2 h-2 bg-white rotate-45 animate-none"></div>
                     </div>
                     <div className="w-24 h-12 border border-zinc-700 flex items-center justify-center">
                        <span className="font-mono text-[9px] text-zinc-500">NODE_01</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-8 border-t border-zinc-900 flex justify-center">
               <div className="flex items-center gap-10">
                  <div className="text-center">
                    <p className="text-[10px] font-display text-zinc-600 mb-1">STRENGTH</p>
                    <p className="font-mono text-xs text-white">99.82%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-display text-zinc-600 mb-1">LATENCY</p>
                    <p className="font-mono text-xs text-white">12ms</p>
                  </div>
               </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
