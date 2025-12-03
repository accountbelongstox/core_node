import React, { useState } from 'react';
import { DeviceGroup } from '../types';
import { useTranslation } from '../services/i18n';

interface SidebarProps {
  groups: DeviceGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  groups,
  selectedGroupId,
  onSelectGroup,
  collapsed,
  setCollapsed
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']));

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpanded(newExpanded);
  };

  const renderGroupTree = (nodes: DeviceGroup[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none transition-all">
        <div 
          className={`flex items-center px-4 py-2 cursor-pointer transition-colors relative group
            ${selectedGroupId === node.id ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}
          `}
          style={{ paddingLeft: collapsed ? '1.2rem' : `${level * 12 + 20}px` }}
          onClick={() => onSelectGroup(node.id)}
          title={node.name}
        >
          {/* Active Indicator Line */}
          {selectedGroupId === node.id && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: 'var(--cyan)', boxShadow: '0 0 10px var(--cyan)' }}></div>
          )}

          {/* Expand/Collapse Icon */}
          {!collapsed && node.children && node.children.length > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
              className="mr-2 w-4 h-4 flex items-center justify-center text-[10px]"
            >
              <i className={`ph-bold ${expanded.has(node.id) ? 'ph-caret-down' : 'ph-caret-right'}`}></i>
            </button>
          )}

          {/* Icon based on Group */}
          <i className={`ph ${node.parentId === 'root' ? 'ph-folder' : 'ph-folder-notch'} text-lg mr-3 transition-transform group-hover:scale-110`}></i>

          {!collapsed && <span className="text-xs font-medium tracking-wide truncate">{node.name}</span>}
        </div>
        {!collapsed && node.children && expanded.has(node.id) && (
          <div>{renderGroupTree(node.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <nav 
      className={`glass-panel border-r border-white/10 flex flex-col transition-[width] duration-300 relative z-20 h-full overflow-hidden
        ${collapsed ? 'w-[60px]' : 'w-[240px]'}
      `}
    >
      <div 
        className="absolute -right-3 top-5 w-6 h-6 rounded-full border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 text-white z-30 transition-colors shadow-lg"
        style={{ backgroundColor: 'var(--bg-black)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <i className={`ph-bold ${collapsed ? 'ph-caret-right' : 'ph-caret-left'}`}></i>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden">
        <div className={`px-5 mb-2 text-[10px] font-bold text-slate-500 tracking-[2px] font-mono whitespace-nowrap ${collapsed ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
          {t('menu.sidebar.title').toUpperCase()}
        </div>
        
        <div className="flex flex-col gap-1">
          <div 
            className={`flex items-center px-4 py-3 cursor-pointer text-slate-400 hover:text-white hover:bg-white/5 relative group
               ${selectedGroupId === null ? 'text-white' : ''}
            `}
            onClick={() => onSelectGroup(null)}
            title="Matrix View"
          >
             {selectedGroupId === null && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00f2ff] shadow-[0_0_10px_#00f2ff]"></div>}
             <i className="ph ph-squares-four text-xl mx-auto md:mx-0 md:mr-3 transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--cyan)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}></i>
             {!collapsed && <span className="text-xs font-medium">{t('menu.sidebar.allDevices')}</span>}
          </div>
          
          <div className="mt-4 mb-2 border-t border-white/5 mx-4"></div>
          
           <div className={`px-5 mb-2 text-[10px] font-bold text-slate-500 tracking-[2px] font-mono whitespace-nowrap ${collapsed ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
            {t('menu.sidebar.groups').toUpperCase()}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            {renderGroupTree(groups)}
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-white/5 bg-white/[0.02]">
        <div className={`flex items-center gap-3 text-slate-400 hover:text-white cursor-pointer p-2 rounded hover:bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
           <i className="ph ph-life-buoy text-xl"></i>
           {!collapsed && <span className="text-xs">Support</span>}
        </div>
      </div>
    </nav>
  );
};