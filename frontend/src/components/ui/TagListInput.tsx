import { Component, Index, createSignal, splitProps } from 'solid-js';
import { Button } from './Button';
import { Input } from './Input';
import { cn } from './cn';

export interface TagListInputProps {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Placeholder for the new-entry row. */
  placeholder?: string;
  /** Accessible label for the new-entry input. */
  addLabel?: string;
  class?: string;
}

/** Delimiter set for pasted/typed list text: semicolons, commas, newlines. */
const TAG_LIST_DELIMITER = /[;,\r\n]/;

/** Split pasted/typed input on semicolons, commas, and newlines. */
export function splitTagListText(text: string): string[] {
  return text
    .split(/[;,\r\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Multi-line list editor: one item per row, Enter adds a new row, each row has
 * a delete button, and pasting text splits on ";" / "," / newlines into multiple
 * rows (including when pasted onto an existing row).
 */
export const TagListInput: Component<TagListInputProps> = (props) => {
  const [local] = splitProps(props, ['id', 'values', 'onChange', 'placeholder', 'addLabel', 'class']);
  const [draft, setDraft] = createSignal('');

  const appendValues = (incoming: string[]) => {
    if (incoming.length === 0) return;
    const next = [...local.values];
    for (const value of incoming) {
      if (!next.includes(value)) next.push(value);
    }
    local.onChange(next);
  };

  const commitDraft = () => {
    appendValues(splitTagListText(draft()));
    setDraft('');
  };

  const updateValue = (index: number, value: string) => {
    const next = [...local.values];
    next[index] = value;
    local.onChange(next.filter((entry) => entry.trim() !== ''));
  };

  /** Replace one row with the values split out of pasted text. */
  const replaceValueWithPastedText = (index: number, parts: string[]) => {
    const next = [...local.values];
    next.splice(index, 1, ...parts);
    const deduped = next
      .map((entry) => entry.trim())
      .filter((entry, entryIndex, all) => entry !== '' && all.indexOf(entry) === entryIndex);
    local.onChange(deduped);
  };

  const removeValue = (index: number) => {
    const next = local.values.filter((_, i) => i !== index);
    local.onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  const handlePaste = (event: ClipboardEvent, replaceIndex?: number) => {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!TAG_LIST_DELIMITER.test(text)) return;
    event.preventDefault();
    const parts = splitTagListText(text);
    if (replaceIndex == null) {
      appendValues(parts);
    } else {
      replaceValueWithPastedText(replaceIndex, parts);
    }
  };

  return (
    <div class={cn('tag-list-input', local.class)}>
      <Index each={local.values}>
        {(value, index) => (
          <div class="tag-list-row">
            <Input
              class="tag-list-entry"
              value={value()}
              aria-label={`${local.addLabel ?? 'Item'} ${index + 1}`}
              onInput={(event) => updateValue(index, event.currentTarget.value)}
              onPaste={(event) => handlePaste(event, index)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="tag-list-remove"
              aria-label={`Remove ${value()}`}
              title="Remove"
              onClick={() => removeValue(index)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        )}
      </Index>

      <div class="tag-list-row">
        <Input
          id={local.id}
          class="tag-list-entry"
          value={draft()}
          placeholder={local.placeholder}
          aria-label={`Add ${local.addLabel ?? 'item'}`}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => handlePaste(event)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="tag-list-add"
          aria-label="Add item"
          title="Add"
          disabled={draft().trim() === ''}
          onClick={commitDraft}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

export default TagListInput;
