import React, { useState } from 'react';
import { Bot, User, Copy, Volume2, RotateCcw, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message, Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { createMarkdownComponents } from '../../utils/markdownConfig';

interface MessageItemProps {
  message: Message;
  activeCharacter: Character | null;
  playingMessageId: string | number | null;
  copiedMessageId: string | number | null;
  onCopyMessage: (messageId: string | number, content: string) => void;
  onPlayTTS: (messageId: string | number, text: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  activeCharacter,
  playingMessageId,
  copiedMessageId,
  onCopyMessage,
  onPlayTTS
}) => {
  const { t } = useLanguage();
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  return (
    <div className={`flex gap-4 ${message.message_type === 'user' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden ${
        message.message_type === 'user' 
          ? 'bg-gray-800 dark:bg-gray-700 text-white' 
          : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
      }`}>
        {message.message_type === 'user' ? (
          <User size={16} />
        ) : (
          activeCharacter?.avatar ? (
            <img src={activeCharacter.avatar} alt="AI" className="w-full h-full object-cover" />
          ) : (
            <Bot size={16} />
          )
        )}
      </div>

      <div className="max-w-[75%] space-y-2">
        {/* Reasoning Panel */}
        {message.message_type === 'assistant' && message.reasoning && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Brain size={16} />
                <span className="text-sm font-medium">思维链</span>
              </div>
              {isReasoningExpanded ? (
                <ChevronUp size={16} className="text-purple-600 dark:text-purple-400" />
              ) : (
                <ChevronDown size={16} className="text-purple-600 dark:text-purple-400" />
              )}
            </button>
            {isReasoningExpanded && (
              <div className="px-4 py-3 border-t border-purple-200 dark:border-purple-800 bg-white/50 dark:bg-black/20">
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {message.reasoning}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
          message.message_type === 'user'
            ? 'bg-blue-600 text-white rounded-tr-none'
            : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
        }`}>
          <div className={`markdown-content ${message.message_type === 'user' ? 'markdown-user' : 'markdown-assistant'}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={createMarkdownComponents(message.message_type, t)}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Action Buttons */}
        {message.message_type === 'assistant' && (
          <div className="flex gap-2 px-1">
            <button
              className={`transition-colors relative group ${
                copiedMessageId === message.message_id
                  ? 'text-green-600'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={() => onCopyMessage(message.message_id, message.content)}
              title={copiedMessageId === message.message_id ? "已复制" : "复制"}
            >
              <Copy size={14} />
              {copiedMessageId === message.message_id && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-600 text-white text-xs rounded whitespace-nowrap">
                  已复制
                </span>
              )}
            </button>
            <button
              className={`transition-colors ${
                playingMessageId === message.message_id 
                  ? 'text-blue-600 animate-pulse' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={() => onPlayTTS(message.message_id, message.content)}
              title={playingMessageId === message.message_id ? "停止播放" : "朗读"}
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
  );
};

export default MessageItem;
