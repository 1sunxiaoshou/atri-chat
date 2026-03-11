import { create } from 'zustand';
import { Character, Model, Provider } from '../types';
import { charactersApi, modelsApi, providersApi } from '../services/api';

interface DataState {
  characters: Character[];
  models: Model[];
  providers: Provider[];
  providerTemplates: any[];
  
  loading: {
    characters: boolean;
    models: boolean;
    providers: boolean;
    templates: boolean;
  };

  fetchCharacters: (force?: boolean) => Promise<void>;
  fetchModels: (force?: boolean) => Promise<void>;
  fetchProviders: (force?: boolean) => Promise<void>;
  fetchTemplates: (force?: boolean) => Promise<void>;
  fetchAll: (force?: boolean) => Promise<void>;
}

// 内存中的请求去重，防止同时发起多个相同请求
const inflight: Record<string, Promise<any>> = {};

/**
 * 核心数据状态管理（带缓存和请求去重）
 * 解决 API 重复刷新和跨组件数据同步问题
 */
export const useDataStore = create<DataState>((set, get) => ({
  characters: [],
  models: [],
  providers: [],
  providerTemplates: [],
  
  loading: {
    characters: false,
    models: false,
    providers: false,
    templates: false,
  },

  fetchCharacters: async (force = false) => {
    // 如果已经有数据且不是强制刷新，直接返回
    if (!force && get().characters.length > 0) return;
    // 如果已有相同请求在处理中，合并请求
    if (inflight['characters']) return inflight['characters'];

    set(state => ({ loading: { ...state.loading, characters: true } }));
    const promise = (async () => {
      try {
        const res = await charactersApi.getCharacters();
        if (res.code === 200) set({ characters: res.data });
      } catch (error) {
        console.error('Failed to fetch characters:', error);
      } finally {
        set(state => ({ loading: { ...state.loading, characters: false } }));
        delete inflight['characters'];
      }
    })();
    inflight['characters'] = promise;
    return promise;
  },

  fetchModels: async (force = false) => {
    if (!force && get().models.length > 0) return;
    if (inflight['models']) return inflight['models'];

    set(state => ({ loading: { ...state.loading, models: true } }));
    const promise = (async () => {
      try {
        const res = await modelsApi.getModels(false);
        if (res.code === 200) set({ models: res.data });
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        set(state => ({ loading: { ...state.loading, models: false } }));
        delete inflight['models'];
      }
    })();
    inflight['models'] = promise;
    return promise;
  },

  fetchProviders: async (force = false) => {
    if (!force && get().providers.length > 0) return;
    if (inflight['providers']) return inflight['providers'];

    set(state => ({ loading: { ...state.loading, providers: true } }));
    const promise = (async () => {
      try {
        const res = await providersApi.getProviders();
        if (res.code === 200) set({ providers: res.data });
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      } finally {
        set(state => ({ loading: { ...state.loading, providers: false } }));
        delete inflight['providers'];
      }
    })();
    inflight['providers'] = promise;
    return promise;
  },

  fetchTemplates: async (force = false) => {
    if (!force && get().providerTemplates.length > 0) return;
    if (inflight['templates']) return inflight['templates'];

    set(state => ({ loading: { ...state.loading, templates: true } }));
    const promise = (async () => {
      try {
        const res = await providersApi.getProviderTemplates();
        if (res.code === 200) set({ providerTemplates: res.data });
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        set(state => ({ loading: { ...state.loading, templates: false } }));
        delete inflight['templates'];
      }
    })();
    inflight['templates'] = promise;
    return promise;
  },

  fetchAll: async (force = false) => {
    await Promise.all([
      get().fetchCharacters(force),
      get().fetchModels(force),
      get().fetchProviders(force),
      get().fetchTemplates(force)
    ]);
  }
}));
