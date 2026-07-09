/** WfNewSocialChat - the chat sub-view (conversation list + virtualized message
 * pane) extracted from WfNewSocial so the page stays under the 800-line modular
 * limit. Owns only the MessageRow renderer; all data + handlers come from the
 * page via props. */
import React from 'react';
import { List, type RowComponentProps } from 'react-window';
import { Send, MessageSquare, ChevronRight } from 'lucide-react';
import type { WfNewConversation, WfNewMessage, WfNewPresenceStatus } from '../../api';
import { relativeTime, presenceClass, type MessageRowData } from './socialPresence';

const MessageRow = ({ index, style, messages, peerId }: RowComponentProps<MessageRowData>) => {
  const msg = messages[index];
  if (!msg) return <div style={style} />;
  const isMe = msg.sender_id !== peerId;
  return (
    <div style={style} className="px-1">
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} py-1.5`}>
        <div
          className={`max-w-[80%] rounded-2xl px-3 py-2 space-y-1 shadow-sm border ${
            isMe
              ? 'bg-gradient-to-br from-indigo-600/90 to-purple-600/90 text-white border-indigo-500/20 rounded-tr-none'
              : 'bg-white/5 text-slate-100 border-white/5 rounded-tl-none'
          }`}
        >
          <p className="text-[11px] leading-relaxed font-sans break-words">{msg.body}</p>
          <span className="block text-[8px] font-mono text-right opacity-60">
            {relativeTime(msg.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface WfNewSocialChatProps {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  convLoading: boolean;
  conversations: WfNewConversation[];
  selectedConvId: number | null;
  presence: Record<number, WfNewPresenceStatus>;
  openConversation: (conv: WfNewConversation) => void;
  selectedConv: WfNewConversation | null | undefined;
  messagesLoading: boolean;
  messages: WfNewMessage[];
  handleSend: (e: React.FormEvent) => void;
  draft: string;
  setDraft: (v: string) => void;
  setActiveSubTab: (tab: string) => void;
}

export const WfNewSocialChat: React.FC<WfNewSocialChatProps> = (props) => {
  const {
    trans, convLoading, conversations, selectedConvId, presence,
    openConversation, selectedConv, messagesLoading, messages,
    handleSend, draft, setDraft, setActiveSubTab,
  } = props;
  return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[550px]">
            {/* Conversation list */}
            <div className="lg:col-span-1 rounded-2xl bg-white/3 border border-white/5 flex flex-col overflow-hidden max-h-full">
              <div className="p-3.5 border-b border-white/5">
                <span className="text-[10px] font-black font-mono uppercase tracking-widest text-zinc-500">
                  {trans('social.chatTitle')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {convLoading && (
                  <p className="text-zinc-500 text-[10px] text-center font-mono py-4">{trans('social.loading')}</p>
                )}
                {!convLoading && conversations.length === 0 && (
                  <p className="text-zinc-500 text-[10px] text-center font-mono py-4 leading-relaxed">{trans('social.noConversations')}</p>
                )}
                {conversations.map(conv => {
                  const isSelected = conv.id === selectedConvId;
                  const peerStatus = presence[conv.peer?.id] || conv.peer?.presence;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 border ${
                        isSelected ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm select-none overflow-hidden">
                            {/^https?:/i.test(conv.peer?.avatar || '')
                              ? <img src={conv.peer.avatar} alt="" className="w-full h-full object-cover" />
                              : <span>{conv.peer?.avatar || (conv.peer?.nickname || '?').slice(0, 1)}</span>}
                          </div>
                          <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${presenceClass(peerStatus)}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                            {conv.peer?.nickname}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono truncate">
                            {conv.last_message || trans('social.tapStart')}
                          </p>
                        </div>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold font-mono">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message pane */}
            <div className="lg:col-span-3 rounded-2xl bg-slate-950/40 border border-white/5 flex flex-col overflow-hidden max-h-full">
              {selectedConv ? (
                <>
                  <div className="p-4 bg-white/3 border-b border-white/5 flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm select-none overflow-hidden">
                        {/^https?:/i.test(selectedConv.peer?.avatar || '')
                          ? <img src={selectedConv.peer.avatar} alt="" className="w-full h-full object-cover" />
                          : <span>{selectedConv.peer?.avatar || (selectedConv.peer?.nickname || '?').slice(0, 1)}</span>}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${presenceClass(presence[selectedConv.peer?.id] || selectedConv.peer?.presence)}`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{selectedConv.peer?.nickname}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {trans('social.status.' + (presence[selectedConv.peer?.id] || selectedConv.peer?.presence || 'offline'))}
                      </p>
                    </div>
                  </div>

                  {/* Virtualized message list (react-window v2 List) */}
                  <div className="flex-1 min-h-0 bg-slate-900/10">
                    {messagesLoading ? (
                      <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-[10px]">
                        {trans('social.loading')}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-[10px]">
                        {trans('social.chatEmpty')}
                      </div>
                    ) : (
                      <List
                        rowComponent={MessageRow}
                        rowCount={messages.length}
                        rowHeight={72}
                        rowProps={{ messages, peerId: selectedConv.peer?.id } as MessageRowData}
                        style={{ height: '100%' }}
                        className="p-3"
                      />
                    )}
                  </div>

                  <form onSubmit={handleSend} className="p-3.5 bg-white/4 border-t border-white/5 flex gap-2 items-center">
                    <input
                      type="text"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder={trans('social.messagePh')}
                      className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500 placeholder-zinc-500"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="p-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{trans('social.selectConv')}</h4>
                    <p className="text-zinc-500 text-[11px] font-mono mt-1 max-w-sm">{trans('social.selectConvSub')}</p>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('partners')}
                    className="px-4 py-2 bg-indigo-600 text-white font-mono text-[10px] font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
                  >
                    {trans('social.tabPartners')} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
  );
};
