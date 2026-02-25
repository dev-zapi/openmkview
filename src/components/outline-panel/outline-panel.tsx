"use client";

import { useAppStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, List } from "lucide-react";
import { cn } from "@/lib/utils";

export function OutlinePanel() {
  const { headings, outlineVisible, toggleOutline } = useAppStore();

  // Only render if outline is visible and there are headings
  if (!outlineVisible || headings.length === 0) {
    return null;
  }

  const handleHeadingClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-56 bg-muted/30 border-l border-border",
        "transition-all duration-200 ease-in-out"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Outline</span>
        </div>
        <button
          onClick={toggleOutline}
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
            {headings.map((heading) => (
              <button
                key={heading.id}
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
