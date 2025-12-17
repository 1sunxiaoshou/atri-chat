/**
 * 共享工具函数
 */

/**
 * 从配置对象中提取值（处理元数据格式）
 * 
 * @param config - 配置对象，可能包含元数据格式（带 value/default 字段）或直接值
 * @returns 提取后的配置值对象
 * 
 * @example
 * ```ts
 * const config = {
 *   apiKey: { value: 'abc123', default: '' },
 *   timeout: 5000
 * };
 * const values = extractConfigValues(config);
 * // 返回: { apiKey: 'abc123', timeout: 5000 }
 * ```
 */
export const extractConfigValues = (config: any): any => {
  const values: any = {};
  for (const key in config) {
    if (config[key]?.value !== undefined) {
      values[key] = config[key].value;
    } else if (config[key]?.default !== undefined) {
      values[key] = config[key].default;
    } else {
      values[key] = config[key];
    }
  }
  return values;
};
