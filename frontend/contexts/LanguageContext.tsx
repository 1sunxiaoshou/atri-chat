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
    // Settings
    'settings.title': 'Settings',
    // Admin - Filters
    'admin.filter': 'Filter',
    'admin.allProviders': 'All Providers',
    'admin.allTypes': 'All Types',
    'admin.allStatus': 'All Status',
    'admin.enabled': 'Enabled',
    'admin.disabled': 'Disabled',
    'admin.clearFilter': 'Clear Filter',
    'admin.showing': 'Showing',
    'admin.of': 'of',
    'admin.modelsCount': 'models',
    'admin.providerTemplate': 'Provider Template',
    'admin.clickEdit': 'Click to Edit',
    'admin.status': 'Status',
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
    'admin.edit': 'Edit',
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
    'admin.confirmDeleteVRM': 'Delete VRM model {name}?',
    'admin.uploadSuccess': 'Upload Success',
    'admin.uploadFailed': 'Upload Failed',
    'admin.deleteFailed': 'Delete Failed',
    // VRM
    'admin.vrmModels': 'VRM Models',
    'admin.animationsLibrary': 'Animations Library',
    'admin.uploadVRM': 'Upload VRM Model',
    'admin.uploadAnimation': 'Upload Animation',
    'admin.vrmFilesSupported': '.vrm files supported',
    'admin.animationFilesSupported': '.vrma files supported',
    'admin.editVRM': 'Edit VRM Model',
    'admin.editAnimation': 'Edit Animation',
    'admin.modelName': 'Model Name',
    'admin.animationName': 'Animation Name',
    'admin.animationDuration': 'Duration (s)',
    'admin.animationDescription': 'Description',
    'admin.boundAnimations': 'Bound Animations',
    'admin.uploadAndBind': 'Upload & Bind',
    'admin.addExistingAnimation': 'Add Existing Animation',
    'admin.noAnimationsBound': 'No animations bound to this model.',
    'admin.noAvailableAnimations': 'No available animations to bind.',
    'admin.noAnimationsFound': 'No animations found.',
    'admin.confirmDeleteAnimation': 'Delete this animation?',
    'admin.bind': 'Bind',
    'admin.unbind': 'Unbind',
    'admin.uploading': 'Uploading...',
    'admin.vrmFile': 'VRM File',
    'admin.animationFile': 'Animation File',
    'admin.thumbnail': 'Thumbnail',
    'admin.optional': 'Optional',
    'admin.animationEnglishId': 'Animation ID (English)',
    'admin.animationChineseName': 'Chinese Name',
    'admin.animationChineseNamePlaceholder': 'e.g. Wave Hand',
    'admin.animationDescriptionPlaceholder': 'Describe the animation for AI understanding',
    'admin.animationIdCannotBeEdited': 'Animation ID cannot be edited',
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
    // Settings
    'settings.title': '设置',
    // Admin - Filters
    'admin.filter': '筛选',
    'admin.allProviders': '所有供应商',
    'admin.allTypes': '所有类型',
    'admin.allStatus': '所有状态',
    'admin.enabled': '已启用',
    'admin.disabled': '已禁用',
    'admin.clearFilter': '清除筛选',
    'admin.showing': '显示',
    'admin.of': '/',
    'admin.modelsCount': '个模型',
    'admin.providerTemplate': '供应商模板',
    'admin.clickEdit': '点击编辑',
    'admin.status': '状态',
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
    'admin.edit': '编辑',
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
    'admin.confirmDeleteVRM': '确定删除 VRM 模型 {name} 吗？',
    'admin.uploadSuccess': '上传成功',
    'admin.uploadFailed': '上传失败',
    'admin.deleteFailed': '删除失败',
    // VRM
    'admin.vrmModels': 'VRM 模型',
    'admin.animationsLibrary': '动画库',
    'admin.uploadVRM': '上传 VRM 模型',
    'admin.uploadAnimation': '上传动画',
    'admin.vrmFilesSupported': '支持 .vrm 文件',
    'admin.animationFilesSupported': '支持 .vrma 文件',
    'admin.editVRM': '编辑 VRM 模型',
    'admin.editAnimation': '编辑动画',
    'admin.modelName': '模型名称',
    'admin.animationName': '动画名称',
    'admin.animationDuration': '时长 (秒)',
    'admin.animationDescription': '描述',
    'admin.boundAnimations': '已绑定动画',
    'admin.uploadAndBind': '上传并绑定',
    'admin.addExistingAnimation': '添加现有动画',
    'admin.noAnimationsBound': '该模型暂无绑定动画。',
    'admin.noAvailableAnimations': '暂无可用动画可绑定。',
    'admin.noAnimationsFound': '暂无动画。',
    'admin.confirmDeleteAnimation': '确定删除该动画吗？',
    'admin.bind': '绑定',
    'admin.unbind': '解绑',
    'admin.uploading': '上传中...',
    'admin.vrmFile': 'VRM 文件',
    'admin.animationFile': '动画文件',
    'admin.thumbnail': '缩略图',
    'admin.optional': '可选',
    'admin.animationEnglishId': '动画英文ID',
    'admin.animationChineseName': '中文名称',
    'admin.animationChineseNamePlaceholder': '例如：挥手',
    'admin.animationDescriptionPlaceholder': '描述动画以便AI理解',
    'admin.animationIdCannotBeEdited': '动画ID不可编辑',
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
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
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