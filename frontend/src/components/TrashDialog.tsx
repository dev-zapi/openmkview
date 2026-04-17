import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { TrashItem, TrashStats } from '../types';
import { api } from '../services/api';
import { formatTrashDate, formatTrashSize } from '../utils/trash';

interface TrashDialogProps {
  isOpen: boolean;
  projectId: number;
  onClose: () => void;
  onRestore?: () => void;
}

const TrashDialog: Component<TrashDialogProps> = (props) => {
  const [trashItems, setTrashItems] = createSignal<TrashItem[]>([]);
  const [stats, setStats] = createSignal<TrashStats | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [confirmDelete, setConfirmDelete] = createSignal<TrashItem | null>(null);
  const [confirmClear, setConfirmClear] = createSignal(false);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const items = await api.listTrash(props.projectId);
      const statsData = await api.getTrashStats(props.projectId);
      setTrashItems(items);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load trash:', error);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      loadTrash();
    }
  });

  const handleRestore = async (item: TrashItem) => {
    try {
      await api.restoreFromTrash(item.id, props.projectId);
      await loadTrash();
      props.onRestore?.();
    } catch (error) {
      console.error('Failed to restore:', error);
      alert('Failed to restore item');
    }
  };

  const handleDeleteConfirm = async () => {
    const item = confirmDelete();
    if (!item) return;
    
    try {
      await api.deleteFromTrash(item.id, props.projectId);
      await loadTrash();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to permanently delete item');
    }
    setConfirmDelete(null);
  };

  const handleClearConfirm = async () => {
    try {
      await api.clearTrash(props.projectId);
      await loadTrash();
    } catch (error) {
      console.error('Failed to clear trash:', error);
      alert('Failed to clear trash');
    }
    setConfirmClear(false);
  };

  return (
    <Show when={props.isOpen}>
      <div class="trash-dialog-overlay" onClick={props.onClose}>
        <div class="trash-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="trash-header">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Trash
            </h2>
            <button class="close-btn" onClick={props.onClose} aria-label="Close trash dialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <Show when={stats()}>
            <div class="trash-stats">
              <span>{stats()!.totalItems} items</span>
              <span>{formatTrashSize(stats()!.totalSize)}</span>
              <Show when={stats()!.oldestItemAge > 0}>
                <span>Oldest: {stats()!.oldestItemAge} days ago</span>
              </Show>
            </div>
          </Show>

          <div class="trash-actions">
            <button 
              class="clear-btn" 
              onClick={() => setConfirmClear(true)}
              disabled={trashItems().length === 0}
            >
              Clear All
            </button>
          </div>

          <Show when={loading()}>
            <div class="trash-loading">Loading...</div>
          </Show>

          <Show when={!loading() && trashItems().length === 0}>
            <div class="trash-empty">
              <p>Trash is empty</p>
            </div>
          </Show>

          <Show when={!loading() && trashItems().length > 0}>
            <ul class="trash-list">
              <For each={trashItems()}>
                {(item) => (
                  <li class="trash-item">
                    <div class="trash-item-info">
                      <span class="icon">
                        {item.isFolder ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        )}
                      </span>
                      <span class="name">{item.originalName}</span>
                      <span class="path">{item.originalPath}</span>
                      <span class="date">{formatTrashDate(item.deletedAt)}</span>
                    </div>
                    <div class="trash-item-actions">
                      <button class="restore-btn" onClick={() => handleRestore(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                        Restore
                      </button>
                      <button class="delete-btn" onClick={() => setConfirmDelete(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Delete Forever
                      </button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={confirmDelete()}>
            <div class="trash-confirm-overlay">
              <div class="trash-confirm-dialog">
                <p>Permanently delete "{confirmDelete()?.originalName}"?</p>
                <p class="trash-confirm-warning">This action cannot be undone.</p>
                <div class="trash-confirm-actions">
                  <button class="cancel-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  <button class="confirm-btn" onClick={handleDeleteConfirm}>Delete Forever</button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={confirmClear()}>
            <div class="trash-confirm-overlay">
              <div class="trash-confirm-dialog">
                <p>Clear all trash items?</p>
                <p class="trash-confirm-warning">This action cannot be undone.</p>
                <div class="trash-confirm-actions">
                  <button class="cancel-btn" onClick={() => setConfirmClear(false)}>Cancel</button>
                  <button class="confirm-btn" onClick={handleClearConfirm}>Clear All</button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default TrashDialog;
