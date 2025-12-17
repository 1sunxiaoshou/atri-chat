import { ApiResponse, ErrorType } from '../../types';
import { HTTP_STATUS, API_CONFIG } from '../../utils/constants';
import { Logger } from '../../utils/logger';

/**
 * 基础 HTTP 客户端类
 * 封装所有 HTTP 请求，提供统一的错误处理和响应处理
 */
export class HttpClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * 构建完整的 URL
   * @param endpoint - API 端点
   * @returns 完整的 URL
   */
  private buildURL(endpoint: string): string {
    // 移除端点开头的斜杠（如果存在）
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseURL}/${cleanEndpoint}`;
  }

  /**
   * 分类错误类型
   * @param status - HTTP 状态码
   * @returns 错误类型
   */
  private categorizeError(status: number): ErrorType {
    const { UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, INTERNAL_SERVER_ERROR } = HTTP_STATUS;
    
    if (status === 0) {
      return ErrorType.NETWORK_ERROR;
    } else if (status === UNAUTHORIZED || status === FORBIDDEN) {
      return ErrorType.AUTH_ERROR;
    } else if (status >= BAD_REQUEST && status < INTERNAL_SERVER_ERROR) {
      return ErrorType.VALIDATION_ERROR;
    } else if (status >= INTERNAL_SERVER_ERROR) {
      return ErrorType.SERVER_ERROR;
    }
    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * 获取用户友好的错误消息
   * @param errorType - 错误类型
   * @param originalMessage - 原始错误消息
   * @returns 用户友好的错误消息
   */
  private getFriendlyErrorMessage(errorType: ErrorType, originalMessage?: string): string {
    const errorMessages: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: '网络连接失败，请检查您的网络设置',
      [ErrorType.AUTH_ERROR]: '身份验证失败，请重新登录',
      [ErrorType.VALIDATION_ERROR]: '请求参数错误，请检查输入内容',
      [ErrorType.SERVER_ERROR]: '服务器错误，请稍后重试',
      [ErrorType.UNKNOWN_ERROR]: '未知错误，请稍后重试'
    };

    return originalMessage || errorMessages[errorType];
  }

  /**
   * 处理 API 响应
   * @param response - 原始响应对象
   * @returns 统一格式的 API 响应
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorType = this.categorizeError(response.status);
      const errorText = await response.text();
      
      let errorMessage = '请求失败';
      let errorDetails: any = null;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
        errorDetails = errorJson.data || errorJson;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      // 获取用户友好的错误消息
      const friendlyMessage = this.getFriendlyErrorMessage(errorType, errorMessage);
      
      // 记录错误日志
      Logger.error(`API 请求失败: ${response.url}`, new Error(friendlyMessage), {
        status: response.status,
        errorType,
        details: errorDetails
      });
      
      return {
        code: response.status,
        message: friendlyMessage,
        data: {} as T
      };
    }
    
    const jsonData = await response.json();
    Logger.debug('API 响应成功', { url: response.url, data: jsonData });
    return jsonData;
  }

  /**
   * 通用请求方法
   * @param endpoint - API 端点
   * @param options - 请求选项
   * @returns API 响应
   */
  async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const url = this.buildURL(endpoint);
      const response = await fetch(url, options);
      return this.handleResponse<T>(response);
    } catch (error) {
      // 网络错误或其他异常
      const errorMessage = error instanceof Error ? error.message : '网络请求失败';
      const errorType = ErrorType.NETWORK_ERROR;
      const friendlyMessage = this.getFriendlyErrorMessage(errorType, errorMessage);
      
      // 记录错误日志
      Logger.error(`网络请求异常: ${endpoint}`, error instanceof Error ? error : new Error(errorMessage), {
        endpoint,
        errorType
      });
      
      return {
        code: 0,
        message: friendlyMessage,
        data: {} as T
      };
    }
  }

  /**
   * GET 请求
   * @param endpoint - API 端点
   * @returns API 响应
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET'
    });
  }

  /**
   * POST 请求
   * @param endpoint - API 端点
   * @param data - 请求数据
   * @param options - 额外的请求选项
   * @returns API 响应
   */
  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const isFormData = data instanceof FormData;
    
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: isFormData ? data : JSON.stringify(data),
      ...options
    });
  }

  /**
   * PUT 请求
   * @param endpoint - API 端点
   * @param data - 请求数据
   * @returns API 响应
   */
  async put<T>(
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  /**
   * PATCH 请求
   * @param endpoint - API 端点
   * @param data - 请求数据
   * @returns API 响应
   */
  async patch<T>(
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE 请求
   * @param endpoint - API 端点
   * @returns API 响应
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE'
    });
  }
}

/**
 * API 基础 URL 配置
 * 动态获取 API 地址：生产环境使用相对路径，开发环境使用 localhost
 */
const BASE_URL = API_CONFIG.BASE_URL;

/**
 * 上传 URL 配置
 * 上传端点不在 /api/v1 下，需要单独配置
 */
const UPLOAD_BASE_URL = API_CONFIG.UPLOAD_URL;

/**
 * 创建 HTTP 客户端实例
 */
export const httpClient = new HttpClient(BASE_URL);

/**
 * 获取基础 URL（用于需要直接使用 fetch 的特殊场景）
 * @returns 基础 URL
 */
export const getBaseURL = (): string => BASE_URL;

/**
 * 获取上传基础 URL
 * @returns 上传基础 URL
 */
export const getUploadBaseURL = (): string => UPLOAD_BASE_URL;

/**
 * 构建完整的 API URL（用于需要直接使用 fetch 的特殊场景）
 * @param endpoint - API 端点
 * @returns 完整的 URL
 */
export const buildURL = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${BASE_URL}/${cleanEndpoint}`;
};

/**
 * 构建完整的上传 URL
 * @param endpoint - 上传端点（如 'avatar', 'provider-logo'）
 * @returns 完整的上传 URL
 */
export const buildUploadURL = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${UPLOAD_BASE_URL}/${cleanEndpoint}`;
};
