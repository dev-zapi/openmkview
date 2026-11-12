---
name: OpenMKView
description: The Quiet Reading Room — a monochrome tool shell wrapped around a serif reading pane
colors:
  paper: "hsl(0 0% 100%)"
  paper-wash: "hsl(240 5% 96%)"
  paper-gray: "hsl(240 5% 89%)"
  ink: "hsl(240 10% 3.9%)"
  ink-soft: "hsl(240 4% 35%)"
  hairline: "hsl(240 6% 90%)"
  graphite: "hsl(240 5.9% 10%)"
  night: "hsl(240 10% 3.9%)"
  night-wash: "hsl(240 4% 10%)"
  night-gray: "hsl(240 4% 14%)"
  night-hairline: "hsl(240 4% 16%)"
  chalk: "hsl(0 0% 98%)"
  chalk-soft: "hsl(240 5% 90%)"
  moon-gray: "hsl(240 5% 64.9%)"
  cinnabar: "hsl(0 72% 51%)"
  jade: "hsl(142 71% 45%)"
  amber: "hsl(38 92% 50%)"
  amber-ink: "hsl(28 60% 35%)"
  slate-ink: "hsl(210 50% 35%)"
  blue-ink: "hsl(212 92% 68%)"
  violet-ink: "hsl(265 90% 76%)"
typography:
  display-welcome:
    fontFamily: "MiSans, sans-serif"
    fontSize: "42px"
    fontWeight: 600
    lineHeight: 1.2
  shell-title:
    fontFamily: "MiSans, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  shell-body:
    fontFamily: "MiSans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  shell-label:
    fontFamily: "MiSans, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.8px"
    textTransform: "uppercase"
  reading-heading:
    fontFamily: "Georgia, 'Noto Serif', serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.3
  reading-body:
    fontFamily: "Georgia, 'Noto Serif', serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  mono-code:
    fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.shell-body}"
  button-primary-hover:
    backgroundColor: "hsl(240 5.9% 10% / 0.9)"
    textColor: "{colors.paper}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.cinnabar}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "36px"
  input-field:
    backgroundColor: "{colors.paper-gray}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  menu-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px"
  menu-item:
    rounded: "6px"
    padding: "6px 10px"
    typography: "{typography.shell-body}"
  menu-item-hover:
    backgroundColor: "{colors.paper-gray}"
    textColor: "{colors.ink}"
  tab-active:
    backgroundColor: "hsl(240 5.9% 10% / 0.08)"
    textColor: "{colors.graphite}"
    rounded: "6px"
    padding: "8px 16px"
  project-tile:
    size: "40px"
    rounded: "{rounded.md}"
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
  project-tile-active:
    backgroundColor: "hsl(240 5.9% 10% / 0.08)"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    size: "40px"
---

# Design System: OpenMKView

## Overview

**Creative North Star: "The Quiet Reading Room"（静谧阅览室）**

OpenMKView is two rooms with one door. The shell — activity bar, file tree, tabs, panels — is a cool, colorless instrument: zinc-gray steel, hairline borders, 13px sans labels, everything measured and quiet. Cross into the document pane and the room changes character: Georgia serif at 16px/1.7, generous leading, headings that rule themselves off with a hairline — a warm study where the file is the only voice. The system's job is to make that transition feel like walking from a workshop into a library, without either room raising its voice.

The temperament is calm restraint (冷静克制) and precision-instrument (精密工具感): monochrome by default, tint pills instead of fills, shadows only where surfaces float. The long-game goal is durability (耐看长期主义) — this is a daily tool that must not tire — with the warmth of a study (温润书房感) reserved for the reading experience. Interactive components are quiet at rest but answer the hand: ripple and press-scale feedback make every touch land, then settle back to silence.

**Key Characteristics:**

- Monochrome zinc scale; the default accent is graphite on paper (light) / chalk on night (dark) — hue only enters through the four ink variants or semantic tokens.
- Two typefaces by room: MiSans shell, Georgia reading pane, JetBrains Mono for code — they never mix.
- State language is tonal: hover = accent at 8% alpha, active/selected = 12%, plus a 2px accent underline for the active tab. New colors are never invented for states.
- Flat docked surfaces separated by 1px hairlines; shadows exist only on floating layers (menus, dialogs, drawers, toasts).
- Compact tool density on desktop (40px tiles, 46px header, ~24px tree rows); mobile is a first-class citizen with its own drawer-based layout, not a shrunken desktop.

## Colors

One zinc-gray scale runs the whole app; both themes are the same room lit differently — paper in the light, night in the dark, with the accent inverting between graphite and chalk.

### Primary
- **Graphite** (hsl(240 5.9% 10%), ≈ #18181b): the light room's accent, primary buttons, active-tab underline, focus ring, selected-tree tint source. A near-black with a cool zinc cast — ink, not pure black.
- **Chalk** (hsl(0 0% 98%), ≈ #fafafa): the dark room's accent — active states, links, primary fills. White ink on the night ground; the same inversion the study lamp makes.
- **Chalk-soft** (hsl(240 5% 90%), ≈ #e4e4e7): dark primary text — shell titles and reading-pane body. One step off pure white so long reading sessions stay comfortable.

### Secondary (the four inks — theme-variant accents, user-poured)
- **Amber Ink** (hsl(28 60% 35%), ≈ #8f5624): light-warm variant — a burned sienna that keeps long documents comfortable.
- **Slate Ink** (hsl(210 50% 35%), ≈ #2d5986): light-cool variant — steel-blue restraint.
- **Blue Ink** (hsl(212 92% 68%), ≈ #62a8f8): dark-blue variant — the GitHub-style blue, the only saturated accent in the set.
- **Violet Ink** (hsl(265 90% 76%), ≈ #b98bf9): dark-purple variant — soft, unsaturated enough to stay quiet on night backgrounds.

Ink variants swap `accent` / `primary` / `ring` only; every neutral stays zinc.

### Tertiary (semantic)
- **Cinnabar** (hsl(0 72% 51%), ≈ #dc2626; dark ≈ #cf3030): destructive actions, errors, delete confirmations — the seal stamp of the system.
- **Jade** (hsl(142 71% 45%), ≈ #21c488): success states.
- **Amber** (hsl(38 92% 50%), ≈ #f59f0a): warnings.

### Neutral (light room — paper)
- **Paper** (hsl(0 0% 100%)): app background, cards, popovers, dialogs.
- **Paper-wash** (hsl(240 5% 96%), ≈ #f4f4f5): main header, subtle panel fills, code-block wash.
- **Paper-gray** (hsl(240 5% 89%), ≈ #e2e2e6): secondary fills — input backgrounds, hover fills, activity-bar gradient end.
- **Ink** (hsl(240 10% 3.9%), ≈ #09090b): primary text.
- **Ink-soft** (hsl(240 4% 35%), ≈ #565659): secondary text, inactive tiles.
- **Hairline** (hsl(240 6% 90%), ≈ #e3e3e8): 1px region borders, input borders, scrollbar track mate.

### Neutral (dark room — night)
- **Night** (hsl(240 10% 3.9%), ≈ #09090b): dark background (same triplet as light Ink — the rooms share one ink).
- **Night-wash** (hsl(240 4% 10%), ≈ #18181a): dark subtle fills.
- **Night-gray** (hsl(240 4% 14%), ≈ #222226): dark secondary fills, tint pills, code blocks.
- **Night-hairline** (hsl(240 4% 16%), ≈ #27272a): dark 1px borders.
- **Moon-gray** (hsl(240 5% 64.9%), ≈ #a1a1aa): dark secondary text.

### Named Rules
**The Ink-Only Color Rule.** Hue enters the system only as poured ink — one of the four theme variants, or a semantic token (cinnabar/jade/amber). The default system is colorless; any new colored surface must justify itself as ink or it stays gray.

**The 8/12 Tint Rule.** Hover is `accent / 0.08`; active and selected are `accent / 0.12`. States are tints of existing tokens, never new colors, and never full-opacity fills.

## Typography

**Shell Font:** MiSans (sans-serif fallback)
**Reading Font:** Georgia with 'Noto Serif' (serif fallback)
**Mono Font:** JetBrains Mono (ui-monospace, Consolas fallback)

**Character:** A workmanlike CJK-first sans runs the tool shell at 13px; Georgia carries the reading room at 16px with room to breathe. The pairing is the identity: sans means "this is the instrument," serif means "this is the document."

### Hierarchy
- **Display** (600, 42px, 1.2): the welcome screen's single "OpenMKView" — the only place the shell speaks loudly.
- **Reading heading** (600, 32px h1 / 24px h2 / 20px h3, 1.3): document headings; h1 and h2 close with a 1px hairline underline. Serif, always.
- **Title** (600, 13px, 1.4): panel titles, sidebar project name, dialog headings.
- **Body** (400, 13px, 1.5): shell UI text — menus, tabs, tree rows, settings labels. The shell never exceeds 14px.
- **Reading body** (400, 16px, 1.7): rendered Markdown; size and family are user-configurable (font presets, content width, table density), but the serif floor holds.
- **Label** (600, 12px, +0.8px tracking, uppercase): sidebar section headers.
- **Code** (400, 14px, 1.6): JetBrains Mono in source view, diffs, and code blocks.

### Named Rules
**The Two Rooms Rule.** MiSans never renders inside the document pane; Georgia never renders in the shell. The font switch is the door between workshop and library — blurring it dissolves the identity.

## Layout

A three-column instrument that the user tunes, not a fixed grid:

- **Activity bar** — fixed 52px rail; project initial tiles (40×40, 8px gap), bottom tool icons pinned to the floor; a vertical wash gradient (paper→paper-gray / night→night-wash).
- **File sidebar** — 280px default, drag-resizable via a 4px hover-accent handle, width persisted per browser; 40px uppercase-label header; Pierre tree below with 12px search field.
- **Main column** — 46px header (tabs left, file name and actions right) above the content area; markdown padding 16px, content width user-set (full / % / px).
- **Right panels** — outline panel and git panel (380px) dock as a fourth column with their own resize handles; the git panel carries a `-4px 0 20px` shadow because it overlays rather than dock.

Density is compact and constant: ~24px tree rows, 40px touch tiles, 4px-base spacing rhythm (4/8/12/16/24). At ≤768px the layout is replaced, not squeezed: a dedicated mobile shell with a 40px top bar (hamburger + centered title + actions), the file tree in a slide-in drawer, compressed tabs (6px 10px, 12px), full-screen settings, 16px form text to stop iOS zoom, and safe-area insets top and bottom over a `100dvh` app height.

## Elevation & Depth

Tonal layering is the system: docked surfaces distinguish themselves by background step (paper → paper-wash → paper-gray) and 1px hairlines, never by shadow. Shadows belong exclusively to things that float above the app — menus, dialogs, drawers, toasts — and even there they are soft, wide, and low-opacity. Dark mode deepens the same shadows rather than inventing new ones.

### Shadow Vocabulary
- **Menu float** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`, dark `/ 0.5` and `/ 0.4`): dropdown menus, portaled popovers.
- **Panel float** (`0 12px 24px rgb(0 0 0 / 0.2)`, dark `/ 0.4`): color/icon pickers, small floating cards.
- **Dialog halo** (`0 24px 80px rgb(0 0 0 / 0.18)`): the login glass card and settings dialog — wide, diffuse, ambient.
- **Modal depth** (`0 25px 50px -12px rgb(0 0 0 / 0.35)`): the diagram zoom modal, the deepest layer.
- **Toast lift** (`0 8px 24px rgb(0 0 0 / 0.2)`): transient notifications.
- **Focus ring** (`0 0 0 2px hsl(var(--ring))`, or `ring-2 ring-offset-2` on primitives): the only "glow" the system allows.

### Named Rules
**The Floating-Only Shadow Rule.** If a surface is docked, it has no shadow — it gets a hairline. Shadows are the visual proof that something floats; using them for emphasis on a docked panel breaks the physics of the room.

## Shapes

Small, consistent radii keep the instrument precise: 4px on icon buttons and inline chips, 6px on tabs, menu items, and tree rows, 8px (the default) on buttons, inputs, menus, dialogs, and project tiles, 12px on the login mark, 16px on the login card's icon, 20px reserved for the login glass card itself — the one place the system goes soft. Everything sits on 1px hairline borders (the `border` token at full strength, or `/ 0.5` when a divider must whisper). Iconography is Lucide-style 1.5–2px stroke line icons at 14–20px; the file tree adds muted material-style file/folder glyphs with two-tone filename rendering (stem in ink, extension dimmed).

## Components

### Buttons (ui/Button)
- **Shape:** 8px radius, 36px height (`sm` 32px, `icon` 36×36 square), 13px medium text.
- **Primary:** graphite fill, paper text; hover darkens only slightly (`/ 0.9`); disabled at 50% opacity.
- **Outline:** hairline border on paper; hover fills paper-gray.
- **Ghost:** no border; hover fills paper-gray. The default for icon buttons.
- **Destructive:** cinnabar fill for irreversible actions; menu items use cinnabar text on a 10% tint instead.
- **Focus:** 2px ring offset 2px on background. **Press:** ripple at 60% + scale to 0.96–0.98 (0.1s) — quiet at rest, tactile under the finger.

### Chips (menu badge, count pills)
- **Style:** accent fill, accent-foreground text, 11px semibold, 10px pill radius, `1px 6px` padding.

### Cards / Containers
- **Corner Style:** 8px (dialogs, pickers); 20px for the login card only.
- **Background:** paper / night; dialogs may take `background / 0.88` + `blur(18px)` glass when over the login gradient.
- **Shadow Strategy:** floating-only (see Elevation).
- **Border:** 1px hairline, always.
- **Internal Padding:** 4px (menus), 16–20px (dialogs), 28px (login card).

### Inputs / Fields (ui/Input, Select)
- **Style:** 36px height, 8px radius, paper-gray fill with hairline border, 13px text, muted placeholder.
- **Focus:** 2px ring offset 2px; border-color transition 0.15s.
- **Disabled:** 50% opacity, not-allowed cursor. Mobile forces 16px text to suppress iOS zoom.

### Navigation
- **Activity bar tiles:** 40×40, 8px radius, hairline border at 70% opacity, initial letter or favicon; hover fills paper-wash; active = accent 8% tint + accent border + accent text; menu-target gets a double-ring halo. Bottom icons gain a 3px accent edge bar (24px tall) when active.
- **View tabs:** 13px, `8px 16px`, 6px radius; active = accent 8% tint + accent text + 500 weight + a 2px accent underline growing from center to 60% width (0.2s). Hover fills the card wash.
- **File tree rows:** ~24px, 13px, 6px radius on hover/selected fills (Pierre tree, muted-override `rgba(0 0 0 / 0.1)` light, `rgba(255 255 255 / 0.14)` dark); two-tone filenames (dimmed extension); 12px search field above.
- **Mobile:** 40px top bar buttons (40×40), centered truncating title, drawer for the tree with dimmed backdrop.

### The Reading Room (signature — rendered Markdown)
The document pane is the product's heart: Georgia 16px/1.7 on paper; h1 32px/h2 24px both closed by a 1px hairline; code in JetBrains Mono 14px on a paper-wash block with hairline border and 8px radius; blockquotes with a hairline left rule; tables with user-adjustable density (`4px 8px` → `16px 22px` cell padding) and wrap mode; the whole pane honors a user-set content width. Everything here optimizes for long reading sessions, and the user may retune it — but the shell never decorates its way in.

### Login Card (signature)
A 420px glass card (`background / 0.88`, `blur(18px)`, 20px radius, dialog-halo shadow) floating on a diagonal paper→wash gradient with a soft accent radial in the top-left corner; 52px accent mark tile, 28px title, 12px hairline divider flanked "or" text. The one moment the instrument allows itself atmosphere.

## Do's and Don'ts

### Do:
- **Do** express every hover/selected state as an accent tint at 8% / 12% alpha — the tint pill is the system's state language.
- **Do** separate regions with 1px hairlines on the `border` token; halve opacity only when a divider must recede.
- **Do** keep the reading pane serif, 16px, 1.7 line-height, with hairline-ruled h1/h2 — it is the core identity (核心身份).
- **Do** use 0.15s ease for state transitions, 0.12s for menus, `cubic-bezier(0.4, 0, 0.2, 1)` for panel slides, and always answer presses with ripple/scale.
- **Do** keep focus-visible rings (2px, `ring` token, offset 2) on every interactive element — keyboard users get the same precision.
- **Do** build mobile as the drawer-based MobileLayout with safe-area insets and 16px form text; never shrink the desktop shell.

### Don't:
- **Don't** introduce hue outside the four inks and three semantic tokens — gray is the default, color is a decision.
- **Don't** put shadows on docked panels; a shadow claims "I float."
- **Don't** render MiSans inside the document pane or Georgia in the shell — the typeface switch *is* the room switch.
- **Don't** exceed the radius scale (4/6/8/12/16, 20 for the login card) or the shell text ceiling (14px).
- **Don't** replace tint fills with saturated solids for hover/active states, and don't animate state changes slower than 0.3s.
