import { Component, createSignal, For, Show, createEffect } from 'solid-js';
import { gitApi, type FileDiffRequest } from '../services/git';
import { diffStore } from '../stores/diffStore';
import type { GitCommit } from '../types';

interface DiffSelectorProps {
  projectId: number;
  filePath: string;
}

const DiffSelector: Component<DiffSelectorProps> = (props) => {
  const [branches, setBranches] = createSignal<string[]>([]);
  const [tags, setTags] = createSignal<string[]>([]);
  const [commits, setCommits] = createSignal<GitCommit[]>([]);
  const [oldRef, setOldRef] = createSignal<string>('');
  const [newRef, setNewRef] = createSignal<string>('HEAD');
  const [refType, setRefType] = createSignal<'branch' | 'commit' | 'tag'>('branch');
  const [loading, setLoading] = createSignal(false);

  createEffect(async () => {
    if (!props.projectId) return;

    try {
      const [branchList, tagList, commitList] = await Promise.all([
        gitApi.getBranches(props.projectId),
        gitApi.getTags(props.projectId),
        gitApi.getCommits(props.projectId),
      ]);

      setBranches(branchList);
      setTags(tagList);
      setCommits(commitList);
      diffStore.setBranches(branchList);
      diffStore.setTags(tagList);

      if (branchList.length >= 2) {
        setOldRef(branchList[1]);
        setNewRef(branchList[0]);
      } else if (branchList.length === 1) {
        setOldRef(branchList[0]);
        setNewRef(branchList[0]);
      }
    } catch (error) {
      console.error('Failed to load git data:', error);
    }
  });

  const handleCompare = async () => {
    if (!oldRef() || !newRef()) return;

    setLoading(true);
    diffStore.setLoading(true);

    try {
      const diffData = await gitApi.getFileDiff({
        projectId: props.projectId,
        filePath: props.filePath,
        oldRef: oldRef(),
        newRef: newRef(),
      });

      diffStore.setDiffData(diffData);
      diffStore.setRefs(oldRef(), newRef());
      diffStore.setDiffMode(true);
    } catch (error) {
      console.error('Failed to get diff:', error);
    } finally {
      setLoading(false);
      diffStore.setLoading(false);
    }
  };

  const getRefOptions = () => {
    switch (refType()) {
      case 'branch':
        return branches();
      case 'tag':
        return tags();
      case 'commit':
        return commits().map((c) => c.hash);
      default:
        return [];
    }
  };

  return (
    <div class="diff-selector">
      <div class="selector-row">
        <div class="selector-group">
          <label>Base</label>
          <select value={refType()} onChange={(e) => setRefType(e.target.value as any)}>
            <option value="branch">Branch</option>
            <option value="tag">Tag</option>
            <option value="commit">Commit</option>
          </select>
          <select value={oldRef()} onChange={(e) => setOldRef(e.target.value)}>
            <For each={getRefOptions()}>{(ref) => <option value={ref}>{ref}</option>}</For>
          </select>
        </div>

        <span class="compare-arrow">→</span>

        <div class="selector-group">
          <label>Target</label>
          <select value={newRef()} onChange={(e) => setNewRef(e.target.value)}>
            <For each={getRefOptions()}>{(ref) => <option value={ref}>{ref}</option>}</For>
          </select>
        </div>

        <button
          class="compare-btn"
          onClick={handleCompare}
          disabled={loading() || !oldRef() || !newRef()}
        >
          {loading() ? 'Loading...' : 'Compare'}
        </button>
      </div>
    </div>
  );
};

export default DiffSelector;
