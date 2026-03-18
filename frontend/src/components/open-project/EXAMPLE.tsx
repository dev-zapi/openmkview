/**
 * OpenProjectDialog 使用示例
 * 
 * 展示如何在应用中使用 OpenProjectDialog 组件
 */

import { Component, createSignal } from 'solid-js';
import { OpenProjectDialog } from './index';
import type { RecentProject } from '../../types/openProject';

const App: Component = () => {
  // 控制对话框显示状态
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  
  // 当前打开的项目
  const [currentProject, setCurrentProject] = createSignal<RecentProject | null>(null);

  // 处理项目打开成功
  const handleProjectOpened = (project: RecentProject) => {
    console.log('项目已打开:', project);
    setCurrentProject(project);
    setIsDialogOpen(false);
    
    // TODO: 加载项目内容
    // loadProjectContent(project.path);
  };

  return (
    <div class="app">
      {/* 主界面 */}
      <div class="main-content">
        <h1>OpenMkView</h1>
        
        {currentProject() ? (
          <div class="current-project">
            <h2>当前项目: {currentProject()?.name}</h2>
            <p>路径: {currentProject()?.path}</p>
          </div>
        ) : (
          <p>还没有打开的项目</p>
        )}
        
        {/* 打开项目按钮 */}
        <button 
          class="open-project-btn"
          onClick={() => setIsDialogOpen(true)}
        >
          🗂️ 打开项目
        </button>
      </div>

      {/* 打开项目对话框 */}
      <OpenProjectDialog
        isOpen={isDialogOpen()}
        onClose={() => setIsDialogOpen(false)}
        onProjectOpened={handleProjectOpened}
      />
    </div>
  );
};

export default App;

/* 
使用说明:

1. 导入组件:
   import { OpenProjectDialog } from './components/open-project';
   import type { RecentProject } from './types/openProject';

2. 在组件中使用:
   - 使用 createSignal 控制对话框显示状态
   - 实现 onProjectOpened 回调处理项目打开成功
   - 调用 onClose 关闭对话框

3. Props 说明:
   - isOpen: boolean - 控制对话框显示/隐藏
   - onClose: () => void - 关闭对话框回调
   - onProjectOpened: (project: RecentProject) => void - 项目成功打开后的回调

4. 功能特性:
   - 支持路径输入和模糊搜索
   - 显示最近打开的项目列表
   - 加载状态显示 spinner
   - 错误状态显示错误信息
   - 响应式布局适配移动端
   - 支持键盘快捷键 (Escape 关闭, Enter 提交)
*/
