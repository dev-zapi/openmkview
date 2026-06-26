/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 */
interface ImportMetaEnv {
  /** 是否启用 Mock API */
  readonly VITE_MOCK_ENABLED: string;
  /** API 基础 URL */
  readonly VITE_API_BASE_URL: string;
  /** 是否为开发模式 */
  readonly VITE_DEV_MODE: string;
  /** 前端构建时间 */
  readonly VITE_FRONTEND_BUILD_TIME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * 环境变量辅助函数
 */
export const env = {
  /** 是否启用 Mock */
  get isMockEnabled(): boolean {
    return import.meta.env.VITE_MOCK_ENABLED === 'true';
  },

  /** API 基础 URL */
  get apiBaseUrl(): string {
    return import.meta.env.VITE_API_BASE_URL || '/api';
  },

  /** 是否为开发模式 */
  get isDev(): boolean {
    return import.meta.env.VITE_DEV_MODE === 'true';
  },

  /** 是否为生产模式 */
  get isProd(): boolean {
    return !this.isDev;
  },
};