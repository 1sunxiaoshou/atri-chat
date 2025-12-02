import React, { useState, useRef, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { ModelParameters, Model } from '../types';

interface ModelConfigPopoverProps {
  parameters: ModelParameters;
  onParametersChange: (params: ModelParameters) => void;
  model?: Model;
}

const ModelConfigPopover: React.FC<ModelConfigPopoverProps> = ({
  parameters,
  onParametersChange,
  model
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleChange = (key: keyof ModelParameters, value: any) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };

  const resetToDefaults = () => {
    onParametersChange({
      temperature: undefined,
      max_tokens: undefined,
      top_p: undefined,
      reasoning_effort: undefined
    });
  };

  // 判断是否支持思考模式（通过 capabilities 判断）
  const supportsReasoning = model?.capabilities?.includes('reasoning') ?? false;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
        title="模型参数配置"
      >
        <Settings size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">模型参数</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  温度 (Temperature)
                </label>
                <span className="text-sm text-gray-500">
                  {parameters.temperature ?? '默认'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={parameters.temperature ?? 1}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>精确</span>
                <span>创造</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  最大长度 (Max Tokens)
                </label>
                <input
                  type="number"
                  value={parameters.max_tokens ?? ''}
                  onChange={(e) => handleChange('max_tokens', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="默认"
                  className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                限制回复的最大长度
              </p>
            </div>

            {/* Top P */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Top P
                </label>
                <span className="text-sm text-gray-500">
                  {parameters.top_p ?? '默认'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={parameters.top_p ?? 1}
                onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                控制采样的多样性
              </p>
            </div>

            {/* Reasoning Mode */}
            {supportsReasoning && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    思考模式 (Reasoning)
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parameters.reasoning_effort === 'medium'}
                      onChange={(e) => handleChange('reasoning_effort', e.target.checked ? 'medium' : undefined)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  启用深度思考模式，提高回答质量
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={resetToDefaults}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
            >
              重置为默认值
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelConfigPopover;
