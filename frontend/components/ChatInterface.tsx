import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Sparkles, Bot, User, Copy, Volume2, RotateCcw, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
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
    try {
      const res = await api.getMessages(activeConversationId);
      if (res.code === 200) {
        // 后端返回格式：data 是消息数组或包含 messages 字段的对象
        let messageList: Message[] = [];
        
        if (Array.isArray(res.data)) {
          messageList = res.data;
        } else if (res.data && typeof res.data === 'object' && 'messages' in res.data) {
          messageList = (res.data as any).messages || [];
        }
        
        // 确保消息格式正确（message_type 字段必须存在）
        const validMessages = messageList.filter(msg => msg.message_type && (msg.message_type === 'user' || msg.message_type === 'assistant'));
        
        setMessages(validMessages);
        scrollToBottom();
      } else {
        console.error('加载消息失败:', res.message);
        setMessages([]);
      }
    } catch (error) {
      console.error('加载消息异常:', error);
      setMessages([]);
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

    // 立即添加用户消息
    const userMsgId = Date.now();
    const userMsg: Message = {
      message_id: userMsgId,
      conversation_id: activeConversationId,
      message_type: 'user',
      content: content,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();

    // 创建一个临时的 AI 消息用于流式更新
    const aiMsgId = Date.now() + 1;
    const aiMsg: Message = {
      message_id: aiMsgId,
      conversation_id: activeConversationId,
      message_type: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, aiMsg]);

    try {
      await api.sendMessage(
        activeConversationId,
        content,
        Number(activeCharacter?.character_id || activeCharacter?.id),
        activeModel?.model_id || '',
        activeModel?.provider_id || '',
        // 流式更新回调
        (streamContent: string) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.message_id === aiMsgId 
                ? { ...msg, content: streamContent }
                : msg
            )
          );
          scrollToBottom();
        }
      );
    } catch (e) {
      console.error("发送消息异常", e);
      // 异常时移除 AI 消息
      setMessages(prev => prev.filter(m => m.message_id !== aiMsgId));
    }
  };

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const toggleRecording = async () => {
    if (isRecording) {
      // 停止录音
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
    } else {
      // 开始录音
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          // 停止所有音频轨道
          stream.getTracks().forEach(track => track.stop());
          
          // 合并音频数据
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          
          // 发送音频消息
          setIsTyping(true);
          try {
            const res = await api.sendAudioMessage(
              activeConversationId,
              audioBlob
            );
            
            if (res.code === 200) {
              // 重新加载消息列表
              loadMessages();
            } else {
              console.error('发送音频消息失败:', res.message);
            }
          } catch (e) {
            console.error("音频上传失败", e);
          } finally {
            setIsTyping(false);
            setIsRecording(false);
          }
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
      } catch (e) {
        console.error("无法访问麦克风", e);
        alert("无法访问麦克风，请检查浏览器权限");
      }
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
            <div key={msg.message_id} className={`flex gap-4 ${msg.message_type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden ${msg.message_type === 'user' ? 'bg-gray-800 text-white' : 'bg-indigo-100 text-indigo-600'
                }`}>
                {msg.message_type === 'user' ? (
                  <User size={16} />
                ) : (
                  activeCharacter?.avatar ? <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" /> : <Bot size={16} />
                )}
              </div>

              <div className={`max-w-[75%] space-y-2`}>
                <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.message_type === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                  }`}>
                  <div className={`markdown-content ${msg.message_type === 'user' ? 'markdown-user' : 'markdown-assistant'}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeContent = String(children).replace(/\n$/, '');
                          
                          return !inline ? (
                            <div className="my-3 bg-gray-900 rounded-md overflow-hidden">
                              <div className="px-3 py-1 bg-gray-800 text-xs text-gray-400 flex justify-between items-center">
                                <span>{match ? match[1] : t('chat.code')}</span>
                                <Copy 
                                  size={12} 
                                  className="cursor-pointer hover:text-white" 
                                  onClick={() => navigator.clipboard.writeText(codeContent)}
                                />
                              </div>
                              <pre className="p-3 overflow-x-auto text-xs font-mono">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            </div>
                          ) : (
                            <code className={`${className} px-1.5 py-0.5 rounded ${msg.message_type === 'user' ? 'bg-blue-700' : 'bg-gray-100'}`} {...props}>
                              {children}
                            </code>
                          );
                        },
                        p({ children }) {
                          return <p className="mb-2 last:mb-0">{children}</p>;
                        },
                        ul({ children }) {
                          return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
                        },
                        ol({ children }) {
                          return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
                        },
                        li({ children }) {
                          return <li className="ml-2">{children}</li>;
                        },
                        blockquote({ children }) {
                          return <blockquote className={`border-l-4 pl-4 my-2 italic ${msg.message_type === 'user' ? 'border-blue-400' : 'border-gray-300'}`}>{children}</blockquote>;
                        },
                        h1({ children }) {
                          return <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>;
                        },
                        h2({ children }) {
                          return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
                        },
                        h3({ children }) {
                          return <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>;
                        },
                        a({ href, children }) {
                          return <a href={href} className={`underline ${msg.message_type === 'user' ? 'text-blue-200' : 'text-blue-600'} hover:opacity-80`} target="_blank" rel="noopener noreferrer">{children}</a>;
                        },
                        table({ children }) {
                          return <div className="overflow-x-auto my-2"><table className="min-w-full border-collapse border border-gray-300">{children}</table></div>;
                        },
                        thead({ children }) {
                          return <thead className="bg-gray-100">{children}</thead>;
                        },
                        th({ children }) {
                          return <th className="border border-gray-300 px-3 py-2 text-left font-semibold">{children}</th>;
                        },
                        td({ children }) {
                          return <td className="border border-gray-300 px-3 py-2">{children}</td>;
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Message Tools for AI */}
                {msg.message_type === 'assistant' && (
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
