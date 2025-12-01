import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Sparkles, Bot, User, Copy, Volume2, RotateCcw, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Character, Message, Model } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useASR } from '../contexts/ASRContext';
import { StreamTTSPlayer } from '../utils/streamTTSPlayer';
import { createMarkdownComponents } from '../utils/markdownConfig';

interface ChatInterfaceProps {
  activeConversationId: number;
  activeCharacter: Character | null;
  activeModel: Model | null;
  onUpdateModel: (modelId: string) => void;
  availableModels: Model[];
  onConversationUpdated?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeConversationId,
  activeCharacter,
  activeModel,
  onUpdateModel,
  availableModels,
  onConversationUpdated
}) => {
  const { t } = useLanguage();
  const { asrEnabled } = useASR();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamPlayerRef = useRef<StreamTTSPlayer | null>(null);

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

    // 显示"正在输入"状态
    setIsTyping(true);

    // 准备 AI 消息 ID
    const aiMsgId = Date.now() + 1;
    let hasReceivedFirstToken = false;

    try {
      const result = await api.sendMessage(
        activeConversationId,
        content,
        Number(activeCharacter?.character_id || activeCharacter?.id),
        activeModel?.model_id || '',
        activeModel?.provider_id || '',
        // 流式更新回调
        (streamContent: string) => {
          // 收到第一个 token 时，创建 AI 消息
          if (!hasReceivedFirstToken) {
            hasReceivedFirstToken = true;
            setIsTyping(false);
            const aiMsg: Message = {
              message_id: aiMsgId,
              conversation_id: activeConversationId,
              message_type: 'assistant',
              content: streamContent,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiMsg]);
          } else {
            // 后续更新消息内容
            setMessages(prev =>
              prev.map(msg =>
                msg.message_id === aiMsgId
                  ? { ...msg, content: streamContent }
                  : msg
              )
            );
          }
          scrollToBottom();
        },
        // 工具调用状态回调
        (status: string) => {
          // 显示工具调用状态（例如：正在使用工具: xxx...）
          if (!hasReceivedFirstToken) {
            hasReceivedFirstToken = true;
            setIsTyping(false);
            const aiMsg: Message = {
              message_id: aiMsgId,
              conversation_id: activeConversationId,
              message_type: 'assistant',
              content: `_${status}_`,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiMsg]);
          } else {
            // 更新状态信息
            setMessages(prev =>
              prev.map(msg =>
                msg.message_id === aiMsgId
                  ? { ...msg, content: `_${status}_` }
                  : msg
              )
            );
          }
          scrollToBottom();
        }
      );

      setIsTyping(false);

      // 消息发送成功后，刷新会话列表以获取更新的标题
      if (result.code === 200 && !((result.data as any)?.error)) {
        onConversationUpdated?.();
      }

      // 检查是否有错误
      if (result.code !== 200 || (result.data as any)?.error) {
        const errorMsg = (result.data as any)?.error || result.message || '发送消息失败';
        
        if (hasReceivedFirstToken) {
          // 如果已经创建了消息，更新为错误提示
          setMessages(prev =>
            prev.map(msg =>
              msg.message_id === aiMsgId
                ? { ...msg, content: `❌ **错误**: ${errorMsg}` }
                : msg
            )
          );
        } else {
          // 如果还没创建消息，创建一个错误消息
          const errorMessage: Message = {
            message_id: aiMsgId,
            conversation_id: activeConversationId,
            message_type: 'assistant',
            content: `❌ **错误**: ${errorMsg}`,
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      }
    } catch (e) {
      console.error("发送消息异常", e);
      setIsTyping(false);
      
      // 异常时显示错误消息
      if (hasReceivedFirstToken) {
        setMessages(prev =>
          prev.map(msg =>
            msg.message_id === aiMsgId
              ? { ...msg, content: `❌ **错误**: ${e instanceof Error ? e.message : '发送消息失败，请稍后重试'}` }
              : msg
          )
        );
      } else {
        const errorMessage: Message = {
          message_id: aiMsgId,
          conversation_id: activeConversationId,
          message_type: 'assistant',
          content: `❌ **错误**: ${e instanceof Error ? e.message : '发送消息失败，请稍后重试'}`,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // 复制消息内容
  const handleCopyMessage = async (messageId: string | number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      
      // 2秒后清除复制状态
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // TTS 播放功能（使用流式播放管理器）
  const handlePlayTTS = async (messageId: string | number, text: string) => {
    try {
      // 如果正在播放同一条消息，则停止播放
      if (playingMessageId === messageId) {
        if (streamPlayerRef.current) {
          streamPlayerRef.current.onStop();
        }
        setPlayingMessageId(null);
        return;
      }

      // 停止之前的播放
      if (streamPlayerRef.current && playingMessageId !== null) {
        await streamPlayerRef.current.dispose();
        streamPlayerRef.current = null;
      }

      setPlayingMessageId(messageId);

      // 获取音量设置
      const volumeSetting = localStorage.getItem('audioVolume');
      const volume = volumeSetting ? Number(volumeSetting) / 100 : 1.0;

      // 创建新的流式播放器（带播放完成回调）
      if (!streamPlayerRef.current) {
        streamPlayerRef.current = new StreamTTSPlayer(volume, () => {
          // 播放完成后清除播放状态
          setPlayingMessageId(null);
        });
      }

      // 开始播放（内部会处理缓存和恢复逻辑）
      await streamPlayerRef.current.onPlay(text, async () => {
        return await api.synthesizeSpeechStream(text);
      });

    } catch (error) {
      console.error('TTS 播放失败:', error);
      setPlayingMessageId(null);
      if (streamPlayerRef.current) {
        await streamPlayerRef.current.dispose();
        streamPlayerRef.current = null;
      }
    }
  };

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

          setIsRecording(false);
          setIsProcessingAudio(true);

          // 发送音频进行转录
          try {
            const res = await api.transcribeAudio(audioBlob);

            if (res.code === 200) {
              setInputValue(prev => prev + (prev ? ' ' : '') + res.data.text);
            } else {
              console.error('语音转录失败:', res.message);
              // 可以添加 Toast 提示
            }
          } catch (e) {
            console.error("语音转录异常", e);
          } finally {
            setIsProcessingAudio(false);
            setMediaRecorder(null);
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
          <>
            {messages.map((msg) => (
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
                      components={createMarkdownComponents(msg.message_type, t)}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Message Tools for AI */}
                {msg.message_type === 'assistant' && (
                  <div className="flex gap-2 px-1">
                    <button 
                      className={`transition-colors relative group ${
                        copiedMessageId === msg.message_id 
                          ? 'text-green-600' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      onClick={() => handleCopyMessage(msg.message_id, msg.content)}
                      title={copiedMessageId === msg.message_id ? "已复制" : "复制"}
                    >
                      <Copy size={14} />
                      {copiedMessageId === msg.message_id && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-600 text-white text-xs rounded whitespace-nowrap">
                          已复制
                        </span>
                      )}
                    </button>
                    <button 
                      className={`transition-colors ${playingMessageId === msg.message_id ? 'text-blue-600 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                      onClick={() => handlePlayTTS(msg.message_id, msg.content)}
                      title={playingMessageId === msg.message_id ? "停止播放" : "朗读"}
                    >
                      <Volume2 size={14} />
                    </button>
                    <button 
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="重新生成"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            ))}

            {/* 打字指示器 */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden bg-indigo-100 text-indigo-600">
                  {activeCharacter?.avatar ? (
                    <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div className="max-w-[75%]">
                  <div className="px-5 py-3.5 rounded-2xl rounded-tl-none shadow-sm bg-white border border-gray-100">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
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
              placeholder={isRecording ? t('chat.recordingPlaceholder') : isProcessingAudio ? "正在转换语音..." : t('chat.placeholder')}
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
                disabled={!asrEnabled || isProcessingAudio}
                className={`p-2 rounded-xl transition-colors ${!asrEnabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : isRecording
                      ? 'text-red-500 bg-red-50 animate-pulse'
                      : isProcessingAudio
                        ? 'text-blue-500 bg-blue-50 animate-pulse'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                title={!asrEnabled ? "ASR not configured" : isRecording ? "Stop Recording" : "Record Audio"}
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
