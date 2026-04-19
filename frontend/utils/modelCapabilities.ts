import { Model } from '../types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface CapabilityDefinition {
  filterKey: string;
  modelKey: 'has_vision' | 'has_audio' | 'has_video' | 'has_reasoning' | 'has_tool_use' | 'has_document';
  translationKey: string;
  label: string;
}

const capabilityKeyMap: Array<Pick<CapabilityDefinition, 'filterKey' | 'modelKey' | 'translationKey'>> = [
  { filterKey: 'vision', modelKey: 'has_vision', translationKey: 'admin.capabilityLabels.vision' },
  { filterKey: 'audio', modelKey: 'has_audio', translationKey: 'admin.capabilityLabels.audio' },
  { filterKey: 'video', modelKey: 'has_video', translationKey: 'admin.capabilityLabels.video' },
  { filterKey: 'reasoning', modelKey: 'has_reasoning', translationKey: 'admin.capabilityLabels.reasoning' },
  { filterKey: 'tool_use', modelKey: 'has_tool_use', translationKey: 'admin.capabilityLabels.tool_use' },
  { filterKey: 'document', modelKey: 'has_document', translationKey: 'admin.capabilityLabels.document' },
];

export function getCapabilityDefinitions(t: Translate): CapabilityDefinition[] {
  return capabilityKeyMap.map(({ filterKey, modelKey, translationKey }) => ({
    filterKey,
    modelKey,
    translationKey,
    label: t(translationKey),
  }));
}

export function getEnabledCapabilities(model: Model, t: Translate): Array<{ key: string; label: string }> {
  return getCapabilityDefinitions(t)
    .filter(({ modelKey }) => model[modelKey])
    .map(({ modelKey, label }) => ({ key: modelKey, label }));
}
