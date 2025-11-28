import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Sparkles, Bot, User, Copy, Volume2, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { Character, Message, Model, Provider } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatInterfaceProps {
  activeConversationId: number;
  activeCharacter: Character | null;
  activeModel: Model | null;
  onUpdateModel: (modelId: string) => void;
  availableModels: Model[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeConversationId,
  activeCharacter,
  activeModel,
  onUpdateModel,
  availableModels
}) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages();
    }
  }, [activeConversationId]);

  const loadMessages = async () => {
    const res = await api.getMessages(activeConversationId);
    if (res.code === 200) {
      setMessages(res.data);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeCharacter) return;

    const content = inputValue;
    setInputValue('');
    setIsTyping(true);

    // Optimistic UI update: temporary message
    const tempId = Date.now();
    const tempUserMsg: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      role: 'user',
      content: content,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    scrollToBottom();

    try {
      const res = await api.sendMessage(activeConversationId, content, Number(activeCharacter.id));
      if (res.code === 200) {
        setIsTyping(false);
        // Replace optimistic msg with real one if needed, or just append assistant
        // The API returns both user_message and assistant_message
        // Filter out the temp one and add real ones
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId);
          return [...filtered, res.data.user_message, res.data.assistant_message];
        });
        scrollToBottom();
      }
    } catch (e) {
      console.error("Failed to send", e);
      setIsTyping(false);
      // Remove temp message on failure or show error
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      // Simulate Audio Send
      setIsTyping(true);
      try {
        const mockBlob = new Blob(["mock_audio"], { type: "audio/wav" });
        const res = await api.sendAudioMessage(activeConversationId, mockBlob);
        if (res.code === 200) {
          // Re-fetch messages to get the newly created ones from the backend
          // Because sendAudioMessage API only returns text, but backend created messages
          loadMessages();
        }
      } catch (e) {
        console.error("Audio upload failed", e);
      } finally {
        setIsTyping(false);
      }
    } else {
      setIsRecording(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200 overflow-hidden">
            {activeCharacter?.avatar ? (
              <img src={activeCharacter.avatar} alt={activeCharacter.name} className="w-full h-full object-cover" />
            ) : (
              <Bot size={24} />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              {activeCharacter?.name || t('chat.selectCharacter')}
            </h2>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {t('chat.online')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <select
              className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-1.5 px-4 pr-8 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-gray-100 transition-colors"
              value={activeModel?.model_id || ''}
              onChange={(e) => onUpdateModel(e.target.value)}
            >
              {availableModels.map(m => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_id} ({m.provider_id})
                </option>
              ))}
            </select>
            <Sparkles size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            title={t('chat.clearContext')}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 overflow-hidden">
              {activeCharacter?.avatar ? (
                <img src={activeCharacter.avatar} alt="Character" className="w-full h-full object-cover" />
              ) : (
                <Sparkles size={40} className="text-gray-400" />
              )}
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {activeCharacter ? `${t('chat.chatWith')} ${activeCharacter.name}` : t('chat.welcome')}
            </h3>
            <div className="flex gap-2 mt-4">
              {[t('chat.suggestion.summarize'), t('chat.suggestion.code'), t('chat.suggestion.translate')].map(suggestion => (
                <button key={suggestion} onClick={() => setInputValue(suggestion)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 border border-gray-200 transition-colors">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-indigo-100 text-indigo-600'
                }`}>
                {msg.role === 'user' ? (
                  <User size={16} />
                ) : (
                  activeCharacter?.avatar ? <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" /> : <Bot size={16} />
                )}
              </div>

              <div className={`max-w-[75%] space-y-2`}>
                <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                  }`}>
                  <div className="whitespace-pre-wrap font-sans">
                    {/* Simple rendering of code blocks vs text */}
                    {msg.content.split('```').map((part, i) => {
                      if (i % 2 === 1) {
                        return (
                          <div key={i} className="my-3 bg-gray-900 rounded-md overflow-hidden text-gray-200">
                            <div className="px-3 py-1 bg-gray-800 text-xs text-gray-400 flex justify-between items-center">
                              <span>{t('chat.code')}</span>
                              <Copy size={12} className="cursor-pointer hover:text-white" />
                            </div>
                            <pre className="p-3 overflow-x-auto text-xs font-mono">
                              <code>{part}</code>
                            </pre>
                          </div>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                </div>

                {/* Message Tools for AI */}
                {msg.role === 'assistant' && (
                  <div className="flex gap-2 px-1">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors"><Copy size={14} /></button>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors"><Volume2 size={14} /></button>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors"><RotateCcw size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 overflow-hidden">
              {activeCharacter?.avatar ? <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" /> : <Bot size={16} />}
            </div>
            <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white">
        <div className="max-w-4xl mx-auto relative">
          <div className={`absolute bottom-full left-0 mb-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm transition-all duration-300 ${isRecording ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            {t('chat.recordingBanner')}
          </div>

          <div className={`relative bg-white shadow-xl shadow-gray-200/50 rounded-2xl border transition-all overflow-hidden ${isRecording ? 'border-red-400 ring-4 ring-red-50' : 'border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'}`}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isRecording ? t('chat.recordingPlaceholder') : t('chat.placeholder')}
              disabled={isRecording}
              className="w-full max-h-40 p-4 pr-32 bg-transparent border-none focus:ring-0 resize-none text-gray-700 placeholder-gray-400 outline-none custom-scrollbar disabled:bg-gray-50 disabled:text-gray-400"
              rows={1}
              style={{ minHeight: '60px' }}
            />

            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <ImageIcon size={20} />
              </button>
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-xl transition-colors ${isRecording ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={isRecording ? "Stop and Send" : "Record Audio"}
              >
                <Mic size={20} />
              </button>
              <button
                onClick={handleSend}
                disabled={(!inputValue.trim() && !isRecording) || isTyping}
                className={`p-2 rounded-xl transition-colors ml-1 ${inputValue.trim() && !isTyping
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-gray-400">
            {t('chat.disclaimer')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
