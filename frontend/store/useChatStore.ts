import { create } from 'zustand';

interface ChatStore {
    inputValue: string;
    setInputValue: (value: string) => void;
    clearInput: () => void;
}

/**
 * 聊天输入状态管理
 * 将输入框状态从React组件树中完全隔离，避免影响VRM渲染
 */
export const useChatStore = create<ChatStore>((set) => ({
    inputValue: '',
    setInputValue: (value: string) => set({ inputValue: value }),
    clearInput: () => set({ inputValue: '' }),
}));