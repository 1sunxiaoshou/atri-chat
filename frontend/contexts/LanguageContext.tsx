import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'zh';

type Translations = {
  [key: string]: string;
};

const translations: Record<Language, Translations> = {
  en: {
    // Sidebar
    'sidebar.newChat': 'New Chat',
    'sidebar.characters': 'Characters',
    'sidebar.recentChats': 'Recent Chats',
    'sidebar.characterHistory': 'Character History',
    'sidebar.adminDashboard': 'Admin Dashboard',
    'sidebar.settings': 'Settings',
    'sidebar.noConversations': 'No conversations found.',
    'sidebar.language': 'Language',
    // Chat
    'chat.online': 'Online',
    'chat.placeholder': 'Send a message...',
    'chat.recordingPlaceholder': 'Listening...',
    'chat.recordingBanner': 'Recording... Tap microphone to stop and send.',
    'chat.welcome': 'How can I help you today?',
    'chat.chatWith': 'Chat with',
    'chat.disclaimer': 'NexusAI can make mistakes. Consider checking important information.',
    'chat.suggestion.summarize': 'Summarize text',
    'chat.suggestion.code': 'Write code',
    'chat.suggestion.translate': 'Translate',
    'chat.selectCharacter': 'Select a Character',
    'chat.clearContext': 'Clear Context',
    'chat.code': 'Code',
    // Admin - General
    'admin.title': 'Admin Dashboard',
    'admin.providers': 'Providers',
    'admin.models': 'Models',
    'admin.characters': 'Characters',
    'admin.cancel': 'Cancel',
    'admin.save': 'Save Changes',
    'admin.delete': 'Delete',
    'admin.create': 'Create',
    // Admin - Providers
    'admin.addProvider': 'Add Provider',
    'admin.editProvider': 'Edit Provider',
    'admin.providerId': 'Provider ID',
    'admin.providerName': 'Provider Name',
    'admin.providerType': 'Type',
    'admin.apiKey': 'API Key',
    'admin.baseUrl': 'Base URL',
    'admin.confirmDeleteProvider': 'Delete this provider? This will remove all associated models.',
    // Admin - Models
    'admin.addModel': 'Add Model',
    'admin.syncModels': 'Sync from Providers',
    'admin.modelId': 'Model ID',
    'admin.modelType': 'Model Type',
    'admin.capabilities': 'Capabilities',
    'admin.confirmDeleteModel': 'Delete this model?',
    // Admin - Characters
    'admin.characterList': 'Character List',
    'admin.createNew': 'Create New',
    'admin.editCharacter': 'Edit Character',
    'admin.createCharacter': 'Create New Character',
    'admin.name': 'Name',
    'admin.description': 'Description',
    'admin.defaultModel': 'Default Model',
    'admin.ttsConfig': 'TTS Config ID',
    'admin.systemPrompt': 'System Prompt',
    'admin.systemPromptHelp': "This prompt defines the AI's personality and behavior.",
    'admin.selectChar': 'Select a character to edit or create a new one',
    'admin.confirmDelete': 'Are you sure you want to delete this character? This will also delete all associated sessions.',
    // App
    'app.startChatting': 'Start chatting with',
    'app.selectConversation': 'Select a conversation or start a new chat',
    'app.selectCharHelp': 'Choose a character from the sidebar to filter your chats.',
    'app.startNewChat': 'Start New Chat',
  },
  zh: {
    // Sidebar
    'sidebar.newChat': '新建会话',
    'sidebar.characters': '角色列表',
    'sidebar.recentChats': '最近会话',
    'sidebar.characterHistory': '历史会话',
    'sidebar.adminDashboard': '管理后台',
    'sidebar.settings': '设置',
    'sidebar.noConversations': '暂无会话',
    'sidebar.language': '语言',
    // Chat
    'chat.online': '在线',
    'chat.placeholder': '发送消息...',
    'chat.recordingPlaceholder': '正在听...',
    'chat.recordingBanner': '正在录音... 点击麦克风结束并发送',
    'chat.welcome': '今天有什么可以帮您？',
    'chat.chatWith': '正在对话：',
    'chat.disclaimer': 'AI 可能会犯错，请核对重要信息。',
    'chat.suggestion.summarize': '总结文本',
    'chat.suggestion.code': '写代码',
    'chat.suggestion.translate': '翻译',
    'chat.selectCharacter': '选择角色',
    'chat.clearContext': '清除上下文',
    'chat.code': '代码',
    // Admin - General
    'admin.title': '管理后台',
    'admin.providers': '供应商',
    'admin.models': '模型',
    'admin.characters': '角色',
    'admin.cancel': '取消',
    'admin.save': '保存更改',
    'admin.delete': '删除',
    'admin.create': '创建',
    // Admin - Providers
    'admin.addProvider': '添加供应商',
    'admin.editProvider': '编辑供应商',
    'admin.providerId': '供应商 ID',
    'admin.providerName': '供应商名称',
    'admin.providerType': '类型',
    'admin.apiKey': 'API Key',
    'admin.baseUrl': 'Base URL',
    'admin.confirmDeleteProvider': '确定删除该供应商吗？这将删除所有关联模型。',
    // Admin - Models
    'admin.addModel': '添加模型',
    'admin.syncModels': '同步模型',
    'admin.modelId': '模型 ID',
    'admin.modelType': '模型类型',
    'admin.capabilities': '能力',
    'admin.confirmDeleteModel': '确定删除该模型吗？',
    // Admin - Characters
    'admin.characterList': '角色列表',
    'admin.createNew': '新建',
    'admin.editCharacter': '编辑角色',
    'admin.createCharacter': '创建新角色',
    'admin.name': '名称',
    'admin.description': '描述',
    'admin.defaultModel': '默认模型',
    'admin.ttsConfig': 'TTS 配置 ID',
    'admin.systemPrompt': '系统提示词',
    'admin.systemPromptHelp': '此提示词定义了 AI 的个性和行为。',
    'admin.selectChar': '选择一个角色进行编辑或创建新角色',
    'admin.confirmDelete': '确定要删除该角色吗？这将同时删除所有关联的会话。',
    // App
    'app.startChatting': '开始对话：',
    'app.selectConversation': '选择一个会话或开始新对话',
    'app.selectCharHelp': '从侧边栏选择一个角色来筛选对话。',
    'app.startNewChat': '开始新会话',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};