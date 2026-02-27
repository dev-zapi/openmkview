"use client";

import * as React from "react";
import { useShallow } from "zustand/shallow";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MarkdownWidthMode } from "@/types";

export function SettingsDialog() {
  const { settings, settingsDialogOpen, setSettingsDialogOpen, updateSettings, fetchSettings } =
    useAppStore(
      useShallow((state) => ({
        settings: state.settings,
        settingsDialogOpen: state.settingsDialogOpen,
        setSettingsDialogOpen: state.setSettingsDialogOpen,
        updateSettings: state.updateSettings,
        fetchSettings: state.fetchSettings,
      }))
    );

  const [widthMode, setWidthMode] = React.useState<MarkdownWidthMode>("full");
  const [fixedWidth, setFixedWidth] = React.useState("70%");
  const [fixedWidthError, setFixedWidthError] = React.useState("");

  // Sync local state when dialog opens or settings change
  React.useEffect(() => {
    if (settingsDialogOpen) {
      fetchSettings();
    }
  }, [settingsDialogOpen, fetchSettings]);

  React.useEffect(() => {
    setWidthMode(settings.markdownWidth.mode);
    setFixedWidth(settings.markdownWidth.fixedWidth);
    setFixedWidthError("");
  }, [settings]);

  const validateFixedWidth = (value: string): boolean => {
    const pattern = /^\d+(\.\d+)?(px|rem|em|%|vw|ch)$/;
    return pattern.test(value);
  };

  const handleWidthModeChange = (mode: MarkdownWidthMode) => {
    setWidthMode(mode);
    setFixedWidthError("");
    updateSettings({
      markdownWidth: {
        mode,
        fixedWidth: mode === "full" ? fixedWidth : fixedWidth,
      },
    });
  };

  const handleFixedWidthChange = (value: string) => {
    setFixedWidth(value);
    if (value && !validateFixedWidth(value)) {
      setFixedWidthError("请输入有效的宽度值，如 70%、1000px、800rem");
    } else {
      setFixedWidthError("");
    }
  };

  const handleFixedWidthBlur = () => {
    if (fixedWidth && validateFixedWidth(fixedWidth)) {
      updateSettings({
        markdownWidth: {
          mode: widthMode,
          fixedWidth,
        },
      });
    }
  };

  const handleFixedWidthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && fixedWidth && validateFixedWidth(fixedWidth)) {
      updateSettings({
        markdownWidth: {
          mode: widthMode,
          fixedWidth,
        },
      });
    }
  };

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure system preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Markdown Width Setting */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">Markdown Document Width</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Control the width of markdown document content
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleWidthModeChange("full")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  widthMode === "full"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                Full Width
              </button>
              <button
                onClick={() => handleWidthModeChange("fixed")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  widthMode === "fixed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                Fixed Width
              </button>
            </div>

            {widthMode === "fixed" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Width value (e.g., 70%, 1000px, 800rem)
                </label>
                <Input
                  value={fixedWidth}
                  onChange={(e) => handleFixedWidthChange(e.target.value)}
                  onBlur={handleFixedWidthBlur}
                  onKeyDown={handleFixedWidthKeyDown}
                  placeholder="70%"
                  className={fixedWidthError ? "border-destructive" : ""}
                />
                {fixedWidthError && (
                  <p className="text-xs text-destructive">{fixedWidthError}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["70%", "80%", "1000px", "800px", "60ch"].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setFixedWidth(preset);
                        setFixedWidthError("");
                        updateSettings({
                          markdownWidth: { mode: "fixed", fixedWidth: preset },
                        });
                      }}
                      className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                        fixedWidth === preset
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
