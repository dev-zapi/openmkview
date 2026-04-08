import { Component, For, Show, createSignal } from 'solid-js';

interface FrontmatterPanelProps {
  data: Record<string, string>;
}

const FrontmatterPanel: Component<FrontmatterPanelProps> = (props) => {
  const [collapsed, setCollapsed] = createSignal(false);

  const entries = () => Object.entries(props.data);

  return (
    <Show when={entries().length > 0}>
      <div class="frontmatter-panel">
        <button
          class="frontmatter-header"
          onClick={() => setCollapsed(!collapsed())}
        >
          <svg
            class="frontmatter-chevron"
            classList={{ collapsed: collapsed() }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span class="frontmatter-title">Frontmatter</span>
          <span class="frontmatter-count">{entries().length}</span>
        </button>

        <Show when={!collapsed()}>
          <div class="frontmatter-body">
            <table class="frontmatter-table">
              <tbody>
                <For each={entries()}>
                  {([key, value]) => (
                    <tr>
                      <td class="frontmatter-key">{key}</td>
                      <td class="frontmatter-value">{value}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default FrontmatterPanel;
