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
import type { MarkdownWidthMode, TableWidthMode } from "@/types";

const UI_FONT_PRESETS = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter" },
  { label: "Noto Sans SC", value: "'Noto Sans SC'" },
  { label: "Microsoft YaHei", value: "'Microsoft YaHei'" },
  { label: "PingFang SC", value: "'PingFang SC'" },
  { label: "Source Han Sans", value: "'Source Han Sans SC'" },
  { label: "system-ui", value: "system-ui" },
];

const MARKDOWN_FONT_PRESETS = [
  { label: "Default", value: "" },
  { label: "Georgia", value: "Georgia" },
  { label: "Noto Serif SC", value: "'Noto Serif SC'" },
  { label: "Source Han Serif", value: "'Source Han Serif SC'" },
  { label: "Times New Roman", value: "'Times New Roman'" },
  { label: "Lora", value: "Lora" },
  { label: "system-ui", value: "system-ui" },
];

const FONT_SIZE_PRESETS = ["12px", "13px", "14px", "15px", "16px", "18px", "20px"];

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

  // Font states
  const [uiFontFamily, setUiFontFamily] = React.useState("");
  const [uiFontSize, setUiFontSize] = React.useState("14px");
  const [uiFontSizeError, setUiFontSizeError] = React.useState("");
  const [mdFontFamily, setMdFontFamily] = React.useState("");
  const [mdFontSize, setMdFontSize] = React.useState("16px");
  const [mdFontSizeError, setMdFontSizeError] = React.useState("");
  const [tableWidthMode, setTableWidthMode] = React.useState<TableWidthMode>("full");

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
    // Sync font settings
    if (settings.uiFont) {
      setUiFontFamily(settings.uiFont.fontFamily);
      setUiFontSize(settings.uiFont.fontSize);
    }
    if (settings.markdownFont) {
      setMdFontFamily(settings.markdownFont.fontFamily);
      setMdFontSize(settings.markdownFont.fontSize);
    }
    if (settings.tableWidth) {
      setTableWidthMode(settings.tableWidth);
    }
  }, [settings]);

  const validateFixedWidth = (value: string): boolean => {
    const pattern = /^\d+(\.\d+)?(px|rem|em|%|vw|ch)$/;
    return pattern.test(value);
  };

  const validateFontSize = (value: string): boolean => {
    const pattern = /^\d+(\.\d+)?(px|rem|em|pt)$/;
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

  // UI Font handlers
  const handleUiFontFamilySelect = (value: string) => {
    setUiFontFamily(value);
    updateSettings({
      uiFont: { fontFamily: value, fontSize: uiFontSize },
    });
  };

  const handleUiFontFamilyChange = (value: string) => {
    setUiFontFamily(value);
  };

  const handleUiFontFamilyBlur = () => {
    updateSettings({
      uiFont: { fontFamily: uiFontFamily, fontSize: uiFontSize },
    });
  };

  const handleUiFontFamilyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateSettings({
        uiFont: { fontFamily: uiFontFamily, fontSize: uiFontSize },
      });
    }
  };

  const handleUiFontSizeChange = (value: string) => {
    setUiFontSize(value);
    if (value && !validateFontSize(value)) {
      setUiFontSizeError("请输入有效的字号，如 14px、1rem");
    } else {
      setUiFontSizeError("");
    }
  };

  const handleUiFontSizeBlur = () => {
    if (uiFontSize && validateFontSize(uiFontSize)) {
      updateSettings({
        uiFont: { fontFamily: uiFontFamily, fontSize: uiFontSize },
      });
    }
  };

  const handleUiFontSizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && uiFontSize && validateFontSize(uiFontSize)) {
      updateSettings({
        uiFont: { fontFamily: uiFontFamily, fontSize: uiFontSize },
      });
    }
  };

  // Markdown Font handlers
  const handleMdFontFamilySelect = (value: string) => {
    setMdFontFamily(value);
    updateSettings({
      markdownFont: { fontFamily: value, fontSize: mdFontSize },
    });
  };

  const handleMdFontFamilyChange = (value: string) => {
    setMdFontFamily(value);
  };

  const handleMdFontFamilyBlur = () => {
    updateSettings({
      markdownFont: { fontFamily: mdFontFamily, fontSize: mdFontSize },
    });
  };

  const handleMdFontFamilyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateSettings({
        markdownFont: { fontFamily: mdFontFamily, fontSize: mdFontSize },
      });
    }
  };

  const handleMdFontSizeChange = (value: string) => {
    setMdFontSize(value);
    if (value && !validateFontSize(value)) {
      setMdFontSizeError("请输入有效的字号，如 16px、1rem");
    } else {
      setMdFontSizeError("");
    }
  };

  const handleMdFontSizeBlur = () => {
    if (mdFontSize && validateFontSize(mdFontSize)) {
      updateSettings({
        markdownFont: { fontFamily: mdFontFamily, fontSize: mdFontSize },
      });
    }
  };

  const handleMdFontSizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && mdFontSize && validateFontSize(mdFontSize)) {
      updateSettings({
        markdownFont: { fontFamily: mdFontFamily, fontSize: mdFontSize },
      });
    }
  };

  // Table width handler
  const handleTableWidthModeChange = (mode: TableWidthMode) => {
    setTableWidthMode(mode);
    updateSettings({ tableWidth: mode });
  };

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure system preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* UI Font Setting */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">UI Font</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Set the font used for the application interface
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Font Family</label>
              <Input
                value={uiFontFamily}
                onChange={(e) => handleUiFontFamilyChange(e.target.value)}
                onBlur={handleUiFontFamilyBlur}
                onKeyDown={handleUiFontFamilyKeyDown}
                placeholder="Default (Geist)"
              />
              <div className="flex flex-wrap gap-1.5">
                {UI_FONT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleUiFontFamilySelect(preset.value)}
                    className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                      uiFontFamily === preset.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Font Size</label>
              <Input
                value={uiFontSize}
                onChange={(e) => handleUiFontSizeChange(e.target.value)}
                onBlur={handleUiFontSizeBlur}
                onKeyDown={handleUiFontSizeKeyDown}
                placeholder="14px"
                className={uiFontSizeError ? "border-destructive" : ""}
              />
              {uiFontSizeError && (
                <p className="text-xs text-destructive">{uiFontSizeError}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {FONT_SIZE_PRESETS.map((preset) => (
                  <button
                    key={`ui-${preset}`}
                    onClick={() => {
                      setUiFontSize(preset);
                      setUiFontSizeError("");
                      updateSettings({
                        uiFont: { fontFamily: uiFontFamily, fontSize: preset },
                      });
                    }}
                    className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                      uiFontSize === preset
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Markdown Font Setting */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">Markdown Render Font</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Set the font used for markdown preview rendering
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Font Family</label>
              <Input
                value={mdFontFamily}
                onChange={(e) => handleMdFontFamilyChange(e.target.value)}
                onBlur={handleMdFontFamilyBlur}
                onKeyDown={handleMdFontFamilyKeyDown}
                placeholder="Default (Geist)"
              />
              <div className="flex flex-wrap gap-1.5">
                {MARKDOWN_FONT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleMdFontFamilySelect(preset.value)}
                    className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                      mdFontFamily === preset.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Font Size</label>
              <Input
                value={mdFontSize}
                onChange={(e) => handleMdFontSizeChange(e.target.value)}
                onBlur={handleMdFontSizeBlur}
                onKeyDown={handleMdFontSizeKeyDown}
                placeholder="16px"
                className={mdFontSizeError ? "border-destructive" : ""}
              />
              {mdFontSizeError && (
                <p className="text-xs text-destructive">{mdFontSizeError}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {FONT_SIZE_PRESETS.map((preset) => (
                  <button
                    key={`md-${preset}`}
                    onClick={() => {
                      setMdFontSize(preset);
                      setMdFontSizeError("");
                      updateSettings({
                        markdownFont: { fontFamily: mdFontFamily, fontSize: preset },
                      });
                    }}
                    className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                      mdFontSize === preset
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Width Setting */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">Table Width</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Control the width of tables in markdown preview
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTableWidthModeChange("full")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  tableWidthMode === "full"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                Full Width
              </button>
              <button
                onClick={() => handleTableWidthModeChange("auto")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  tableWidthMode === "auto"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                Auto Fit
              </button>
            </div>
          </div>

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
