import { createStore } from 'solid-js/store';
import type { GitDiff, GitCommit } from '../types';

interface DiffState {
  isDiffMode: boolean;
  oldRef: string;
  newRef: string;
  diffData: GitDiff | null;
  commits: GitCommit[];
  loading: boolean;
  branches: string[];
  tags: string[];
}

const [diffState, setDiffState] = createStore<DiffState>({
  isDiffMode: false,
  oldRef: '',
  newRef: '',
  diffData: null,
  commits: [],
  loading: false,
  branches: [],
  tags: [],
});

export const diffStore = {
  state: diffState,

  setDiffMode(enabled: boolean) {
    setDiffState('isDiffMode', enabled);
  },

  setRefs(oldRef: string, newRef: string) {
    setDiffState({ oldRef, newRef });
  },

  setDiffData(diff: GitDiff | null) {
    setDiffState('diffData', diff);
  },

  setCommits(commits: GitCommit[]) {
    setDiffState('commits', commits);
  },

  setBranches(branches: string[]) {
    setDiffState('branches', branches);
  },

  setTags(tags: string[]) {
    setDiffState('tags', tags);
  },

  setLoading(loading: boolean) {
    setDiffState('loading', loading);
  },

  reset() {
    setDiffState({
      isDiffMode: false,
      oldRef: '',
      newRef: '',
      diffData: null,
      commits: [],
      loading: false,
      branches: diffState.branches,
      tags: diffState.tags,
    });
  },
};

export default diffStore;
