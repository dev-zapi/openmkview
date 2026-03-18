/**
 * PathInput 组件使用示例
 * 
 * 展示如何在项目中使用 PathInput 组件
 */

import { Component, createSignal } from 'solid-js';
import PathInput from './PathInput';

// 示例 1: 基本用法
const BasicExample: Component = () => {
  const handleSubmit = (path: string) => {
    console.log('Selected path:', path);
    // 这里可以调用打开项目的 API
  };

  return (
    <div class="p-4">
      <h2 class="text-lg font-semibold mb-4">打开项目</h2>
      <PathInput
        placeholder="输入项目路径，例如 /home/user/project"
        onSubmit={handleSubmit}
      />
    </div>
  );
};

// 示例 2: 带初始值和加载状态
const WithStateExample: Component = () => {
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (path: string) => {
    setLoading(true);
    try {
      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Opening project:', path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="p-4">
      <PathInput
        initialValue="myproject"
        placeholder="输入项目名称或路径"
        onSubmit={handleSubmit}
        loading={loading()}
      />
    </div>
  );
};

// 示例 3: 对话框中使用
const DialogExample: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false);

  const handleSubmit = (path: string) => {
    console.log('Opening project from dialog:', path);
    setIsOpen(false);
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        打开项目
      </button>

      {isOpen() && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              打开项目
            </h2>
            <PathInput
              placeholder="输入路径（支持绝对路径、相对路径或模糊搜索）"
              onSubmit={handleSubmit}
              autoFocus
            />
            <div class="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                class="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 示例 4: 完整使用说明
const UsageGuide: Component = () => {
  return (
    <div class="p-6 max-w-2xl">
      <h1 class="text-2xl font-bold mb-4">PathInput 组件使用指南</h1>
      
      <section class="mb-6">
        <h2 class="text-lg font-semibold mb-2">功能特性</h2>
        <ul class="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
          <li>实时路径类型检测（绝对路径、相对路径、模糊搜索）</li>
          <li>路径类型标签显示（绿色=绝对路径，蓝色=相对路径，黄色=模糊搜索）</li>
          <li>深度提示（路径深度 ≤ 2 时显示提示）</li>
          <li>模糊搜索时自动获取候选列表</li>
          <li>点击候选项目自动填充路径</li>
          <li>支持键盘导航（Enter 提交，Escape 关闭下拉框）</li>
        </ul>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold mb-2">Props 说明</h2>
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2">属性</th>
              <th class="text-left py-2">类型</th>
              <th class="text-left py-2">必填</th>
              <th class="text-left py-2">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-gray-100 dark:border-gray-800">
              <td class="py-2 font-mono text-blue-600">onSubmit</td>
              <td class="py-2 font-mono">(path: string) ={'>'} void</td>
              <td class="py-2">是</td>
              <td class="py-2">路径提交回调函数</td>
            </tr>
            <tr class="border-b border-gray-100 dark:border-gray-800">
              <td class="py-2 font-mono text-blue-600">placeholder</td>
              <td class="py-2 font-mono">string</td>
              <td class="py-2">否</td>
              <td class="py-2">输入框占位符</td>
            </tr>
            <tr class="border-b border-gray-100 dark:border-gray-800">
              <td class="py-2 font-mono text-blue-600">initialValue</td>
              <td class="py-2 font-mono">string</td>
              <td class="py-2">否</td>
              <td class="py-2">初始输入值</td>
            </tr>
            <tr class="border-b border-gray-100 dark:border-gray-800">
              <td class="py-2 font-mono text-blue-600">disabled</td>
              <td class="py-2 font-mono">boolean</td>
              <td class="py-2">否</td>
              <td class="py-2">是否禁用</td>
            </tr>
            <tr>
              <td class="py-2 font-mono text-blue-600">loading</td>
              <td class="py-2 font-mono">boolean</td>
              <td class="py-2">否</td>
              <td class="py-2">加载状态</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold mb-2">路径类型识别规则</h2>
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">绝对路径</span>
            <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">/home/user/project</code>
            <span class="text-gray-500">以 / 开头或 Windows 盘符</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">相对路径</span>
            <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">projects/myapp</code>
            <span class="text-gray-500">包含 / 但不以 / 开头</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">模糊搜索</span>
            <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">myapp</code>
            <span class="text-gray-500">不包含路径分隔符</span>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">快速开始</h2>
        <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import PathInput from './components/open-project/PathInput';

// 在组件中使用
<PathInput
  placeholder="输入项目路径..."
  onSubmit={(path) => console.log('Selected:', path)}
/>`}
        </pre>
      </section>
    </div>
  );
};

export { BasicExample, WithStateExample, DialogExample, UsageGuide };
export default BasicExample;
