
import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Sparkles, Bot, User, Copy, Volume2, RotateCcw, Image as ImageIcon, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Character, Message, Model, ModelParameters } from '../../types';
import { api } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useASR } from '../../contexts/ASRContext';
import { StreamTTSPlayer } from '../../utils/streamTTSPlayer';
import { createMarkdownComponents } from '../../utils/markdownConfig';
import ModelConfigPopover from './ModelConfigPopover';
import Select from '../ui/Select';
import { VRMLoader } from '../../utils/vrmLoader.js';
import { VRMTimedPlayer } from '../../utils/vrmTimedPlayer.js';

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
  const [modelParameters, setModelParameters] = useState<ModelParameters>({});
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string | number>>(new Set());
  const [vrmDisplayMode, setVrmDisplayMode] = useState<'normal' | 'vrm' | 'live2d'>('normal');
  const [showVrmError, setShowVrmError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamPlayerRef = useRef<StreamTTSPlayer | null>(null);

  // VRM相关 Refs
  const vrmCanvasRef = useRef<HTMLCanvasElement>(null);
  const vrmLoaderRef = useRef<VRMLoader | null>(null);
  const vrmPlayerRef = useRef<VRMTimedPlayer | null>(null);
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    if (activeConversationId) {
      loadMessages();
    }
  }, [activeConversationId]);

  // 初始化 VRM
  useEffect(() => {
    if (vrmDisplayMode === 'vrm' && vrmCanvasRef.current) {
      if (!vrmLoaderRef.current) {
        const loader = new VRMLoader(vrmCanvasRef.current);
        vrmLoaderRef.current = loader;

        // 初始化播放器
        const streamPlayer = new StreamTTSPlayer(1.0);
        const player = new VRMTimedPlayer(loader, streamPlayer, (text) => setSubtitle(text));
        vrmPlayerRef.current = player;

        // 加载模型
        if (activeCharacter?.vrm_model_id) {
          loadVRMModel(activeCharacter.vrm_model_id, loader);
        } else {
          console.warn("当前角色未配置 VRM 模型ID");
          setSubtitle('请先为角色配置VRM模型');
        }
      }
    } else {
      // 切换出 VRM 模式，清理资源
      if (vrmLoaderRef.current) {
        vrmLoaderRef.current.dispose();
        vrmLoaderRef.current = null;
      }
      if (vrmPlayerRef.current) {
        vrmPlayerRef.current.stop();
        vrmPlayerRef.current = null;
      }
      setSubtitle('');
    }
  }, [vrmDisplayMode, activeCharacter?.character_id]);

  // 加载VRM模型的函数
  const loadVRMModel = async (vrmModelId: string, loader: VRMLoader) => {
    try {
      setSubtitle('正在加载VRM模型...');
      console.log('开始加载VRM模型:', vrmModelId);

      const response = await api.getVRMModel(vrmModelId);
      if (response.code === 200 && response.data) {
        const modelData = response.data;
        console.log('获取到VRM模型数据:', modelData);

        // 加载VRM模型 - 构造完整的URL
        const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8000';
        const modelUrl = `${baseUrl}${modelData.model_path}`;
        console.log('VRM模型URL:', modelUrl);
        await loader.loadModel(modelUrl);

        // 加载动画
        if (modelData.animations && modelData.animations.length > 0) {
          const animationMap: Record<string, string> = {};
          modelData.animations.forEach((anim: any) => {
            // 构造完整的动画URL
            const animationUrl = `${baseUrl}${anim.animation_path}`;
            animationMap[anim.name] = animationUrl;
          });
          console.log('动画映射表:', animationMap);

          await loader.loadAnimations(animationMap);
          setSubtitle('VRM模型加载完成');
        } else {
          console.log('该VRM模型没有动画');
          setSubtitle('VRM模型加载完成（无动作）');
        }

        // 清除提示文字
        setTimeout(() => setSubtitle(''), 2000);
      }
    } catch (error) {
      console.error('加载VRM模型失败:', error);
      console.error('错误详情:', error instanceof Error ? error.message : String(error));
      setSubtitle('VRM模型加载失败，将使用默认显示');

      // 5秒后清除错误提示
      setTimeout(() => setSubtitle(''), 5000);
    }
  };

  // 修正后的 cleanup 逻辑：
  useEffect(() => {
    return () => {
      if (vrmLoaderRef.current) {
        vrmLoaderRef.current.dispose();
        vrmLoaderRef.current = null;
      }
      if (vrmPlayerRef.current) {
        vrmPlayerRef.current.stop();
        vrmPlayerRef.current = null;
      }
    };
  }, []); // 只在组件卸载时彻底清理，或者我们依赖上面的 dep active cleanup



  const loadMessages = async () => {
    try {
      const res = await api.getMessages(activeConversationId);
      if (res.code === 200) {
        let messageList: Message[] = [];

        if (Array.isArray(res.data)) {
          messageList = res.data;
        } else if (res.data && typeof res.data === 'object' && 'messages' in res.data) {
          messageList = (res.data as any).messages || [];
        }

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

    setIsTyping(true);

    const aiMsgId = Date.now() + 1;
    let hasReceivedFirstToken = false;

    try {
      // 准备模型参数
      const finalModelParams = { ...modelParameters };
      if (vrmDisplayMode === 'vrm') {
        // 在 VRM 模式下，设置显示模式
        finalModelParams.display_mode = 'vrm';
      } else {
        finalModelParams.display_mode = 'text';
      }

      console.log('发送消息参数:', {
        conversationId: activeConversationId,
        characterId: Number(activeCharacter?.character_id || activeCharacter?.id),
        modelId: activeModel?.model_id || '',
        providerId: activeModel?.provider_id || '',
        modelParams: finalModelParams,
        vrmDisplayMode
      });

      const result = await api.sendMessage(
        activeConversationId,
        content,
        Number(activeCharacter?.character_id || activeCharacter?.id),
        activeModel?.model_id || '',
        activeModel?.provider_id || '',
        finalModelParams,
        (streamContent: string) => {
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
        (status: string) => {
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
            setMessages(prev =>
              prev.map(msg =>
                msg.message_id === aiMsgId
                  ? { ...msg, content: `_${status}_` }
                  : msg
              )
            );
          }
          scrollToBottom();
        },
        (reasoning: string) => {
          // ... (reasoning logic same as before)
          if (!hasReceivedFirstToken) {
            hasReceivedFirstToken = true;
            setIsTyping(false);
            const aiMsg: Message = {
              message_id: aiMsgId,
              conversation_id: activeConversationId,
              message_type: 'assistant',
              content: '',
              reasoning: reasoning,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiMsg]);
          } else {
            setMessages(prev =>
              prev.map(msg =>
                msg.message_id === aiMsgId
                  ? { ...msg, reasoning: reasoning }
                  : msg
              )
            );
          }
          scrollToBottom();
        },
        (data: any) => {
          // 处理 VRM 数据
          if (vrmDisplayMode === 'vrm' && vrmPlayerRef.current) {
            // 假设 data是 { audio_segments: [...] } 或者已经是 segments 列表
            // 根据后端实现来定。假设是 { type: 'audio_segments', segments: [...] }
            // 但 callback里传进来的是 data.content，所以如果是Segments[]
            if (Array.isArray(data)) {
              vrmPlayerRef.current.setSegments(data);
              vrmPlayerRef.current.play();
            } else if (data.segments) {
              vrmPlayerRef.current.setSegments(data.segments);
              vrmPlayerRef.current.play();
            }
          }
        }
      );

      setIsTyping(false);

      if (result.code === 200 && !((result.data as any)?.error)) {
        onConversationUpdated?.();
      }

      if (result.code !== 200 || (result.data as any)?.error) {
        const errorMsg = (result.data as any)?.error || result.message || '发送消息失败';

        if (hasReceivedFirstToken) {
          setMessages(prev =>
            prev.map(msg =>
              msg.message_id === aiMsgId
                ? { ...msg, content: `❌ **错误**: ${errorMsg}` }
                : msg
            )
          );
        } else {
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

  const handleCopyMessage = async (messageId: string | number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);

      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handlePlayTTS = async (messageId: string | number, text: string) => {
    try {
      if (playingMessageId === messageId) {
        if (streamPlayerRef.current) {
          streamPlayerRef.current.onStop();
        }
        setPlayingMessageId(null);
        return;
      }

      if (streamPlayerRef.current && playingMessageId !== null) {
        await streamPlayerRef.current.dispose();
        streamPlayerRef.current = null;
      }

      setPlayingMessageId(messageId);

      const volumeSetting = localStorage.getItem('audioVolume');
      const volume = volumeSetting ? Number(volumeSetting) / 100 : 1.0;

      if (!streamPlayerRef.current) {
        streamPlayerRef.current = new StreamTTSPlayer(volume, () => {
          setPlayingMessageId(null);
        });
      }

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
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
    } else {
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
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });

          setIsRecording(false);
          setIsProcessingAudio(true);

          try {
            const res = await api.transcribeAudio(audioBlob);

            if (res.code === 200) {
              setInputValue(prev => prev + (prev ? ' ' : '') + res.data.text);
            } else {
              console.error('语音转录失败:', res.message);
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

  const modelOptions = availableModels.map(m => ({
    label: m.model_id,
    value: m.model_id,
    group: m.provider_id
  }));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors relative">
      {/* Header */}
      <div className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 sticky top-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 overflow-hidden">
            {activeCharacter?.avatar ? (
              <img src={activeCharacter.avatar} alt={activeCharacter.name} className="w-full h-full object-cover" />
            ) : (
              <Bot size={24} />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {activeCharacter?.name || t('chat.selectCharacter')}
            </h2>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {t('chat.online')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-56">
            <Select
              value={activeModel?.model_id || ''}
              onChange={onUpdateModel}
              options={modelOptions}
              placeholder="选择模型..."
            />
          </div>

          {/* Display Mode Toggle */}
          <div className="relative bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center h-9 w-[180px] border border-gray-200 dark:border-gray-700">
            {/* 滑块背景动画 */}
            <div
              className="absolute top-1 bottom-1 left-1 bg-white dark:bg-gray-700 rounded-md shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300 ease-out"
              style={{
                width: 'calc((100% - 8px) / 3)',
                transform: `translateX(${['normal', 'vrm', 'live2d'].indexOf(vrmDisplayMode) * 100
                  }%)`
              }}
            />

            {/* Error Popup for VRM */}
            {showVrmError && (
              <div className="absolute top-12 right-0 bg-red-100 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-lg shadow-lg z-50 animate-fadeIn flex items-center gap-2 whitespace-nowrap">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                请先在角色设置中配置 VRM 模型
              </div>
            )}

            <div className="grid grid-cols-3 w-full h-full relative">
              {[
                { id: 'normal', label: '正常' },
                { id: 'vrm', label: 'VRM' },
                { id: 'live2d', label: 'Live2D' }
              ].map((mode) => {
                const isActive = vrmDisplayMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      if (mode.id === 'vrm' && !activeCharacter?.vrm_model_id) {
                        setShowVrmError(true);
                        setTimeout(() => setShowVrmError(false), 3000);
                        return;
                      }
                      setVrmDisplayMode(mode.id as any);
                    }}
                    className={`
                      relative z-10 flex items-center justify-center text-xs font-medium transition-colors duration-200 rounded-md
                      ${isActive ? 'text-black dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                    `}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <ModelConfigPopover
            parameters={modelParameters}
            onParametersChange={setModelParameters}
            model={activeModel || undefined}
          />
          <button
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
            title={t('chat.clearContext')}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Messages / VRM View */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 relative">
        {vrmDisplayMode === 'vrm' && (
          <div className="absolute inset-0 z-0 bg-gray-900 flex items-center justify-center overflow-hidden">
            <canvas ref={vrmCanvasRef} className="w-full h-full block" />
            {/* Subtitle Overlay */}
            {subtitle && (
              <div className="absolute bottom-20 left-0 right-0 p-4 text-center z-10 pointer-events-none">
                <div className="inline-block bg-black/60 text-white px-6 py-3 rounded-xl text-lg backdrop-blur-sm max-w-[80%]">
                  {subtitle}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Messages Handling for VRM Mode - Optional: Hide or Overlay? */}
        {/* For now we hide traditional messages in VRM mode, or maybe show them as an overlay if needed.
            Let's hide them to focus on VRM, but we might want a toggle or a floating chat. 
            The requirement says "Showing AI outputs as subtitles", implying we replace the chat flow visually. 
        */}
        <div className={`relative z-10 ${vrmDisplayMode === 'vrm' ? 'hidden' : ''}`}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 overflow-hidden">
                {activeCharacter?.avatar ? (
                  <img src={activeCharacter.avatar} alt="Character" className="w-full h-full object-cover" />
                ) : (
                  <Sparkles size={40} className="text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
                {activeCharacter ? `${t('chat.chatWith')} ${activeCharacter.name}` : t('chat.welcome')}
              </h3>
              <div className="flex gap-2 mt-4">
                {[t('chat.suggestion.summarize'), t('chat.suggestion.code'), t('chat.suggestion.translate')].map(suggestion => (
                  <button key={suggestion} onClick={() => setInputValue(suggestion)} className="px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.message_id} className={`flex gap-4 ${msg.message_type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden ${msg.message_type === 'user' ? 'bg-gray-800 dark:bg-gray-700 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    }`}>
                    {msg.message_type === 'user' ? (
                      <User size={16} />
                    ) : (
                      activeCharacter?.avatar ? <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" /> : <Bot size={16} />
                    )}
                  </div>

                  <div className={`max-w-[75%] space-y-2`}>
                    {msg.message_type === 'assistant' && msg.reasoning && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedReasoning);
                            if (newExpanded.has(msg.message_id)) {
                              newExpanded.delete(msg.message_id);
                            } else {
                              newExpanded.add(msg.message_id);
                            }
                            setExpandedReasoning(newExpanded);
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                            <Brain size={16} />
                            <span className="text-sm font-medium">思维链</span>
                          </div>
                          {expandedReasoning.has(msg.message_id) ? (
                            <ChevronUp size={16} className="text-purple-600 dark:text-purple-400" />
                          ) : (
                            <ChevronDown size={16} className="text-purple-600 dark:text-purple-400" />
                          )}
                        </button>
                        {expandedReasoning.has(msg.message_id) && (
                          <div className="px-4 py-3 border-t border-purple-200 dark:border-purple-800 bg-white/50 dark:bg-black/20">
                            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                              {msg.reasoning}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.message_type === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
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

                    {msg.message_type === 'assistant' && (
                      <div className="flex gap-2 px-1">
                        <button
                          className={`transition-colors relative group ${copiedMessageId === msg.message_id
                            ? 'text-green-600'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
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
                          className={`transition-colors ${playingMessageId === msg.message_id ? 'text-blue-600 animate-pulse' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                          onClick={() => handlePlayTTS(msg.message_id, msg.content)}
                          title={playingMessageId === msg.message_id ? "停止播放" : "朗读"}
                        >
                          <Volume2 size={14} />
                        </button>
                        <button
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="重新生成"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {activeCharacter?.avatar ? (
                      <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" />
                    ) : (
                      <Bot size={16} />
                    )}
                  </div>
                  <div className="max-w-[75%]">
                    <div className="px-5 py-3.5 rounded-2xl rounded-tl-none shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
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
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {/* 在 VRM模式下，InputArea 仍然需要可见，覆盖在 Canvas 上方 */}
      <div className={`p-4 transition-colors ${vrmDisplayMode === 'vrm' ? 'absolute bottom-0 left-0 right-0 bg-transparent z-10' : 'bg-white dark:bg-gray-900'}`}>
        <div className="max-w-4xl mx-auto relative">
          <div className={`absolute bottom-full left-0 mb-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm transition-all duration-300 ${isRecording ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            {t('chat.recordingBanner')}
          </div>

          <div className={`relative bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20 rounded-2xl border transition-all overflow-hidden ${isRecording ? 'border-red-400 ring-4 ring-red-50' : 'border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'}`}>
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
              className="w-full max-h-40 p-4 pr-32 bg-transparent border-none focus:ring-0 resize-none text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none custom-scrollbar disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400"
              rows={1}
              style={{ minHeight: '60px' }}
            />

            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <ImageIcon size={20} />
              </button>
              <button
                onClick={toggleRecording}
                disabled={!asrEnabled || isProcessingAudio}
                className={`p-2 rounded-xl transition-colors ${!asrEnabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : isRecording
                    ? 'text-red-500 bg-red-50 animate-pulse'
                    : isProcessingAudio
                      ? 'text-blue-500 bg-blue-50 animate-pulse'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed'
                  }`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-gray-400 dark:text-gray-500">
            {t('chat.disclaimer')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
