"use client";

import { useShallow } from "zustand/shallow";
import { useAppStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface OutlinePanelContentProps {
  onClose?: () => void;
}

export function OutlinePanelContent({ onClose }: OutlinePanelContentProps) {
  const { headings, toggleOutline } = useAppStore(
    useShallow((state) => ({
      headings: state.headings,
      toggleOutline: state.toggleOutline,
    }))
  );

  const handleClose = onClose || toggleOutline;

  const handleHeadingClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Find the scroll container (ScrollArea viewport)
      const scrollContainer = element.closest('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Calculate position relative to scroll container
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;
        const offsetTop = elementRect.top - containerRect.top + scrollTop;
        
        // Scroll with offset for toolbar (4rem = 64px)
        scrollContainer.scrollTo({
          top: Math.max(0, offsetTop - 64),
          behavior: 'smooth'
        });
      } else {
        // Fallback to scrollIntoView
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    // Close outline on mobile after clicking
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Outline</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
          title="Close outline"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Headings List */}
      <ScrollArea className="flex-1 py-2">
        {headings.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No headings found
          </div>
        ) : (
          <div className="px-2">
            {headings.map((heading, index) => (
              <button
                key={`${heading.id}-${index}`}
                onClick={() => handleHeadingClick(heading.id)}
                className={cn(
                  "w-full text-left text-sm rounded-sm cursor-pointer truncate",
                  "hover:bg-accent hover:text-accent-foreground",
                  "transition-colors duration-150",
                  "py-1.5 pr-2"
                )}
                style={{
                  paddingLeft: `${(heading.depth - 1) * 12 + 8}px`,
                }}
                title={heading.text}
              >
                {heading.text}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function OutlinePanel() {
  const outlineVisible = useAppStore((state) => state.outlineVisible);

  // Only render if outline is visible
  if (!outlineVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full w-56 border-l border-border",
        "transition-all duration-200 ease-in-out"
      )}
    >
      <OutlinePanelContent />
    </div>
  );
}
