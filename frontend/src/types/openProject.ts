/**
 * 项目打开相关的类型定义
 * 对应后端 Rust 类型的 TypeScript 版本
 */

/** 路径类型枚举 - 对应 Rust PathType */
export type PathType = 'absolute' | 'relative' | 'fuzzy';

/** 路径候选 - 对应 Rust PathCandidate */
export interface PathCandidate {
  /** 候选名称 */
  name: string;
  /** 完整路径 */
  path: string;
  /** 路径深度 */
  depth: number;
  /** 相对路径 */
  relative_path: string;
}

/** 解析路径请求 */
export interface ResolvePathRequest {
  /** 用户输入的路径字符串 */
  input: string;
}

/** 解析路径响应 */
export interface ResolvePathResult {
  /** 解析成功标志 */
  success: boolean;
  /** 候选路径列表 */
  candidates: PathCandidate[];
  /** 解析到的路径类型 */
  path_type?: PathType;
  /** 错误信息（如果有） */
  error?: string;
}

/** 验证路径请求 */
export interface ValidatePathRequest {
  /** 要验证的路径 */
  path: string;
}

/** 验证路径响应 */
export interface ValidatePathResult {
  /** 验证是否通过 */
  valid: boolean;
  /** 路径类型 */
  path_type?: PathType;
  /** 规范化后的路径 */
  normalized_path?: string;
  /** 错误信息（如果验证失败） */
  error?: string;
}

/** 打开项目请求 */
export interface OpenProjectRequest {
  /** 项目路径 */
  path: string;
}

/** 打开项目响应 */
export interface OpenProjectResult {
  /** 是否成功 */
  success: boolean;
  /** 项目信息 */
  project?: RecentProject;
  /** 错误信息 */
  error?: string;
}

/** 最近打开的项目 */
export interface RecentProject {
  /** 项目唯一标识 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目路径 */
  path: string;
  /** 最后打开时间 */
  last_opened_at: string;
  /** 项目类型或标签 */
  type?: string;
}

/** 获取最近项目响应 */
export interface RecentProjectsResult {
  /** 最近项目列表 */
  projects: RecentProject[];
  /** 总数 */
  total: number;
}

/** 打开项目对话框状态 */
export interface OpenProjectState {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 当前输入的路径 */
  input: string;
  /** 候选路径列表 */
  candidates: PathCandidate[];
  /** 当前选中的候选索引 */
  selectedIndex: number;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

/** 打开项目对话框初始状态 */
export const initialOpenProjectState: OpenProjectState = {
  isOpen: false,
  input: '',
  candidates: [],
  selectedIndex: -1,
  isLoading: false,
  error: null,
};
