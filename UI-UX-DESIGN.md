# Kariakoo POS — UI/UX Design Documentation

This document is the complete reference for the visual language, interaction patterns, layout
system, components, motion, accessibility behaviour, and screen designs used in the Kariakoo POS web
app. It reflects the implementation in `src/` and is intended to be kept in sync with the code.

**Primary sources**

| Area | File |
| --- | --- |
| Design tokens, themes, layout, component CSS | `src/index.css` |
| Theme provider and switcher | `src/lib/theme.tsx`, `index.html` |
| Motion tokens | `src/lib/motion.ts` |
| App shell, navigation, role-aware menu | `src/components/AppShell.tsx` |
| UI primitives | `src/components/ui/*` |
| Screens | `src/pages/*` |
| Routing and toasts | `src/App.tsx` |
| Formatting and labels | `src/lib/utils.ts` |
| Receipt preview and print layout | `src/components/ui/ReceiptModal.tsx`, `src/lib/receipt.ts` |

---

## 1. Product context and UX goals

Kariakoo POS is a Tanzanian retail point-of-sale demo for mini-markets and small supermarkets. The
interface is built around four goals that show up throughout the design:

1. **Counter speed** — large tap targets, search-first product discovery, barcode entry, a persistent
   cart, and a payment flow that can be completed in a few taps.
2. **Calm clarity** — soft glass surfaces, restrained colour, generous spacing, and a small number of
   emphasis points per screen.
3. **Operational trust** — stock-aware selling, explicit totals, destructive-action confirmations,
   audit trails, and role-based permissions.
4. **Local context** — TZS currency, Dar es Salaam/Kariakoo identity, market vocabulary, and a
   configurable business timezone defaulting to `Africa/Dar_es_Salaam`.

The design is deliberately **demo-transparent**: simulated payments and non-fiscal receipts are
labelled wherever a user might otherwise assume real money or TRA compliance.

---

## 2. Design language: Liquid Glass

The app uses a custom "Liquid Glass" visual language rather than a flat or material system. It is
implemented with CSS tokens and utility classes, with no UI framework component library.

### 2.1 Layers

Every authenticated screen is composed of four visual layers:

1. **Aurora background** — three large radial gradients (`--aurora-1/2/3`) over a diagonal
   `--bg` to `--bg-deep` gradient, fixed to the viewport.
2. **Film grain** — a fixed SVG fractal-noise overlay at `opacity: 0.16` blended with `soft-light`
   (`body::after`), which prevents the gradients from looking flat or banded.
3. **Glass surfaces** — navigation, top bar, cart, modals, and panels.
4. **Content surfaces** — opaque cards and tables for dense data, so text never competes with the
   animated background.

### 2.2 Glass tiers

| Class | Background | Blur / saturation | Intended use |
| --- | --- | --- | --- |
| `.liquid-glass-soft` | `--surface-soft` plus a sheen | 14px / 130% | Quiet inline panels |
| `.liquid-glass` | `--glass-bg` plus sheen, tint, inner edge | 24px / 150% | Top bar and ambient chrome |
| `.liquid-glass-strong` | `--glass-bg-strong` plus sheen, tint | 32px / 165% | Sidebar, cart, modals, mobile drawer |

All three include a 1px `--glass-border`, an inset top highlight (`--glass-edge`), a fine
one-pixel specular line via `::before`, and the theme's `--glass-shadow`.

**Overlay hardening.** Sidebar, mobile drawer, modal panels, top bar, and POS cart override the glass
background with `color-mix(..., var(--surface-solid) 84–94%, transparent)` so navigation and form
labels remain legible over busy pages. Modals and drawers use the strongest mix (94%).

### 2.3 Supporting surface utilities

| Class | Treatment |
| --- | --- |
| `.surface-card` | Opaque solid card, 1px border, 22px radius, small shadow |
| `.surface-soft` | Translucent soft panel, 16px radius |
| `.surface-muted` | Muted solid panel, 16px radius |
| `.card` / `.card-pad` / `.card-header` / `.card-body` | Dense data container with 22px radius and 18px gutters |
| `.hairline` | 1px divider using the theme border |
| `.eyebrow` | Uppercase 0.68rem label with 0.14em tracking |
| `.numeric` | Tabular numerals and tightened tracking for money and counts |
| `.mono` | Monospace for references, TINs, JSON, and receipt data |

---

## 3. Theming

### 3.1 Themes

Three themes are shipped, all built on the same token contract:

| Theme | Class | Character |
| --- | --- | --- |
| Lavender glass | `.theme-lavender` | Default; cool violet with warm copper accent |
| Earth glass | `.theme-brown` | Warm sand, clay, and olive retail palette |
| Midnight glass | `.theme-dark` | Near-black violet with luminous pastels |

The theme is applied to `<html>` as both a class (`theme-*`) and `data-theme`, and sets
`color-scheme` so native controls match. The `<meta name="theme-color">` value is updated per theme.
Selection is persisted in `localStorage` under `kariakoo.theme`. A small inline script in
`index.html` applies the stored theme before React mounts to prevent a flash of the wrong theme.

### 3.2 Token contract

#### Neutrals and brand

| Token | Lavender glass | Earth glass | Midnight glass |
| --- | --- | --- | --- |
| `--bg` | `#f4eefb` | `#f5eee4` | `#0c0a11` |
| `--bg-deep` | `#e9e0f4` | `#eaded0` | `#07060b` |
| `--surface` | `rgba(255,255,255,0.68)` | `rgba(255,252,247,0.70)` | `rgba(32,27,43,0.62)` |
| `--surface-solid` | `#fdfbff` | `#fffbf6` | `#1b1725` |
| `--surface-soft` | `rgba(255,255,255,0.46)` | `rgba(255,255,255,0.44)` | `rgba(255,255,255,0.045)` |
| `--surface-muted` | `#eee7f7` | `#eee2d3` | `#262032` |
| `--surface-raised` | `#ffffff` | `#ffffff` | `#221d2e` |
| `--text` | `#2a2137` | `#34261d` | `#f2edf8` |
| `--text-muted` | `#6b6079` | `#79685a` | `#b6adc3` |
| `--text-soft` | `#948aa3` | `#a19080` | `#8b8298` |
| `--text-invert` | `#ffffff` | `#ffffff` | `#18131f` |
| `--border` | `rgba(72,49,102,0.12)` | `rgba(79,52,34,0.13)` | `rgba(255,255,255,0.09)` |
| `--border-strong` | `rgba(72,49,102,0.22)` | `rgba(79,52,34,0.24)` | `rgba(255,255,255,0.17)` |
| `--primary` | `#6f4a9c` | `#855332` | `#b794df` |
| `--primary-hover` | `#5f3d88` | `#6f4327` | `#c9a9eb` |
| `--primary-soft` | `rgba(111,74,156,0.12)` | `rgba(133,83,50,0.12)` | `rgba(183,148,223,0.16)` |
| `--primary-contrast` | `#ffffff` | `#ffffff` | `#1c1228` |
| `--accent` | `#c58a52` | `#a47b42` | `#d8a66a` |
| `--success` | `#217a57` | `#2c7052` | `#62c79e` |
| `--warning` | `#a56a12` | `#98621b` | `#e7bd70` |
| `--danger` | `#b34045` | `#a83e3e` | `#ef8e8e` |
| `--info` | `#3f6f9b` | `#436b8b` | `#85b4e0` |
| `--ring` | `rgba(111,74,156,0.26)` | `rgba(133,83,50,0.26)` | `rgba(183,148,223,0.30)` |

Each semantic colour also has a `-soft` tint at roughly 12–16% alpha. Borders and badges are derived
with `color-mix()` so they adapt to the theme instead of using hard-coded hex values.

#### Glass, elevation, and atmosphere

| Token | Lavender glass | Earth glass | Midnight glass |
| --- | --- | --- | --- |
| `--glass-bg` | `rgba(255,255,255,0.50)` | `rgba(255,251,245,0.52)` | `rgba(28,24,38,0.52)` |
| `--glass-bg-strong` | `rgba(255,255,255,0.72)` | `rgba(255,251,245,0.73)` | `rgba(35,30,47,0.72)` |
| `--glass-border` | `rgba(255,255,255,0.62)` | `rgba(255,255,255,0.60)` | `rgba(255,255,255,0.11)` |
| `--glass-edge` | `rgba(255,255,255,0.95)` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.46)` |
| `--glass-sheen` | `rgba(255,255,255,0.68)` | `rgba(255,255,255,0.64)` | `rgba(255,255,255,0.10)` |
| `--glass-tint` | `rgba(219,199,242,0.20)` | `rgba(222,187,145,0.20)` | `rgba(177,145,220,0.09)` |
| `--glass-blur` | `24px` | `24px` | `24px` |
| `--glass-shadow` | violet-tinted, soft | clay-tinted, soft | deep black, pronounced |
| `--aurora-1` | `rgba(190,157,235,0.46)` | `rgba(224,185,140,0.44)` | `rgba(111,74,156,0.35)` |
| `--aurora-2` | `rgba(241,191,140,0.34)` | `rgba(184,145,106,0.30)` | `rgba(158,112,66,0.20)` |
| `--aurora-3` | `rgba(143,174,225,0.25)` | `rgba(155,176,157,0.24)` | `rgba(58,92,130,0.22)` |
| `--chart-grid` | `rgba(65,45,90,0.10)` | `rgba(79,52,34,0.10)` | `rgba(255,255,255,0.08)` |

Elevation is expressed as three tiers: `--shadow-sm` (cards, controls), `--shadow-md` (raised
interactive surfaces, popovers), and `--shadow-lg` (hovered floats, large popovers). Glass surfaces
use their own `--glass-shadow` instead.

#### Chart palette

| Series | Lavender glass | Earth glass | Midnight glass |
| --- | --- | --- | --- |
| `--chart-1` | `#7651a4` | `#8a5a37` | `#b794df` |
| `--chart-2` | `#c78d54` | `#b58a4f` | `#dfad71` |
| `--chart-3` | `#4f8b78` | `#5d7d68` | `#6fc09a` |
| `--chart-4` | `#ae6072` | `#9c5f58` | `#de8f9f` |
| `--chart-5` | `#587fa8` | `#5b7891` | `#86a9d2` |

Charts use these tokens directly, so the whole reporting surface re-themes without extra code.

### 3.3 Theme switcher

`ThemeToggle` is a single cycling button rather than a dropdown:

- Cycles **Lavender → Earth → Midnight → Lavender**.
- Shows the current icon (`Sparkles`, `Coffee`, `Moon`), a short label, and three progress dots with
  the active dot stretched into a pill.
- The icon changes with an `AnimatePresence` rotate/scale/fade transition (suppressed under reduced
  motion).
- `aria-label` and `title` describe the current theme and the next one.
- Appears in the top bar, the sidebar footer (`.sidebar-theme`, full-width row with label), and the
  login card.
- At ≤767px the standalone toggle collapses to a 34px icon-only button; at ≤360px it becomes 31px.
  The sidebar variant becomes an icon-only rail button when the sidebar is collapsed.

---

## 4. Typography

| Role | Font | Size / treatment |
| --- | --- | --- |
| Body | **Inter** (`--font-sans`) with system fallbacks | 14px / 1.55 line height |
| Display, headings, brand | **Sora** (`--font-display`) with Poppins/system fallback | 650–700 weight, tight negative tracking |
| Monospace | SF Mono / Consolas / Liberation Mono (`--font-mono`) | References, TIN, audit JSON, receipt preview |

Fonts are loaded from Google Fonts in `index.html`: Inter 400–700, Sora 500–700, and Poppins 500–800
as a display fallback. Body text is antialiased and uses `optimizeLegibility`.

Key text styles:

- `.page-title` — `clamp(1.65rem, 2vw, 2.15rem)`, 700, `-0.055em` tracking.
- `.page-subtitle` — 0.86rem, muted, 5px top margin.
- `.hero-title` — `clamp(1.55rem, 2.8vw, 2.4rem)`, 700, `-0.06em`, 1.05 line height.
- `.login-headline` — `clamp(2.2rem, 4.6vw, 4.1rem)`, 700, `-0.075em`, 0.97 line height.
- `.card-title` / `.section-title` — 0.94–1.01rem display type.
- `.card-subtitle` / `.section-subtitle` — 0.69–0.7rem, soft colour.
- `.eyebrow` / `.nav-section-label` — uppercase, 0.62–0.68rem, wide tracking.
- `.kpi-value` — display font, `clamp(1.15rem, 1.55vw, 1.52rem)`, tabular numerals.
- `.data-table th` — uppercase 0.62rem with 0.08em tracking.
- `.receipt-preview` — 10px monospace on a white "paper" surface for receipt realism.

Money and quantities use `.numeric` to keep columns aligned. Currency is always written as
`TZS 1,234` (no symbol substitution).

---

## 5. Shape, spacing, and elevation

- **Radii:** `--radius-xs` 10px, `--radius-sm` 12px, `--radius-md` 16px, `--radius-lg` 22px,
  `--radius-xl` 28px, `--radius-2xl` 34px. Pills use `99px`.
- **Card density:** 18px padding, 17px header top padding, 16px body top padding.
- **Control heights:** 38px default button, 31px small, 46px large, 36px icon, 29px small icon;
  40px inputs/selects; 84px textarea minimum.
- **Sidebar geometry:** 276px expanded, 90px collapsed, 12px inset from the viewport edges,
  28px radius.
- **Content:** maximum width 1680px, 24px desktop gutters, 52px bottom padding.
- **Elevation:** cards sit on `--shadow-sm`; hover raises to `--shadow-md` with a 1–3px lift;
  overlays use `--shadow-lg` and the strongest glass treatment.
- **Global details:** custom 10px scrollbars with a transparent track and a rounded text-coloured
  thumb (`.scrollbar-none` hides them on the category strip); text selection uses primary background
  with contrast text; smooth scrolling is enabled globally and disabled under reduced motion; the body
  clips horizontal overflow.

---

## 6. Iconography and imagery

- **Icons:** `lucide-react` throughout, with 1.45–1.8 stroke widths and 12–22px sizes. Icons are
  paired with text for primary actions; icon-only buttons always carry `aria-label` and usually a
  `title`.
- **Brand mark:** rounded gradient tile (43px, 15px radius) with the `Store` icon, a diagonal white
  sheen (`::after`), and a violet drop shadow. The wordmark is "Kariakoo" with the meta line
  "Point of sale".
- **Product imagery:** no photographs. `ProductArt` renders a deterministic category-aware tile with
  a Lucide icon and a soft two-colour gradient. Category names are pattern-matched to palettes:
  dairy, grains, drinks, coffee, household, baby/personal care, produce, food/snacks, and a default.
  It supports normal, `large`, and `compact` (38px) sizes, and is marked `aria-hidden` with the
  product name as a title.
- **Hero decoration:** a 32px grid pattern masked to fade to the right, layered over radial primary
  and accent washes in the dashboard hero.
- **Login art:** three aurora orbs with `animate-drift` / `animate-float`, a radial-masked grid, and a
  bento of three glass mini-cards (counter mode, stock-aware, role-aware) with a tiny bar chart.

---

## 7. Layout and navigation

### 7.1 App shell

```
┌───────────── sidebar (fixed, glass) ─────────────┐  ┌──── main ─────────────────────────────┐
│ brand + collapse toggle                          │  │ sticky top bar (glass)               │
│ nav groups (Workspace / Operations / Admin)      │  │   page icon + title + business name  │
│ footer: user, business, theme, sign out          │  │   New sale / theme / avatar / exit   │
└──────────────────────────────────────────────────┘  │ content (max 1680px)                 │
                                                       └──────────────────────────────────────┘
```

- The sidebar is fixed with 12px insets and a 28px radius. The main column is offset by
  `sidebar width + 24px` and animates its margin when collapsing.
- Collapsing keeps icons, the brand mark, the theme toggle, and the avatar; it hides labels, section
  headings, badges, and user text. The state is persisted in `localStorage` under
  `kariakoo.sidebar`.
- Navigation is grouped and role-filtered: **Workspace** (Dashboard, Point of sale, Sales, Products,
  Categories), **Operations** (Inventory, Reports — admin), **Administration** (Team, Settings,
  Audit log — admin).
- The active link uses a primary-tinted pill, a glowing 3px left bar, and a filled primary icon tile.
- The top bar is sticky, glass, and summarises the current section plus the business name. It offers
  "New sale" (hidden on POS and below `sm`), the theme toggle, the avatar/name/role, and sign out.
- The mobile menu button appears below 1280px, opening a left glass drawer over a blurred scrim.
  The drawer closes on navigation, scrim click, or the close button, and the body scroll is locked.

### 7.2 Page pattern

Every screen uses the same rhythm:

1. `.page-shell` — vertical flex, 20px gap, 0.5s page-in animation.
2. `PageHeader` — optional icon, eyebrow, title, subtitle, and right-aligned actions. The icon is
   hidden below `sm`; actions wrap and become full-width below 768px. It also sets the document title
   to `<page> · Kariakoo POS`.
3. Optional inline `ErrorPanel`.
4. Content: KPI grids, cards, tables, or split layouts.
5. Overlays: modals, confirmations, drawers, and toasts.

### 7.3 Responsive breakpoints

| Breakpoint | Behaviour |
| --- | --- |
| ≥1280px | Fixed sidebar visible; `.desktop-only` shown; 4-column KPI grid; POS cart fixed at 386px |
| ≤1279px | Sidebar hidden, mobile menu enabled; 2-column KPI; POS cart 340px; tighter top bar/content gutters |
| ≤1023px | POS becomes single column with a fixed mobile cart bar; 56px top bar; login art hidden; larger quantity steppers |
| ≤767px | Page actions go full-width; KPI stays 2 columns but compact; forms become one column; modals become bottom sheets at 92dvh with 24px top radius; product grid minimum 135px; charts 220px; stat rows 2 columns; theme toggle icon-only; range popover left-aligned |
| ≤479px | KPI 1 column; top-bar context icon hidden; content gutters 10px; product grid fixed at 2 columns; quick-cash 2-up; modal footer stacks; scanner viewport becomes square; range fields 1 column |
| ≤360px | Theme toggle 31px |

The layout is intentionally **desktop-first for operations** (tables, inventory, reports) and
**thumb-first for selling**: the POS cart becomes a fixed bottom bar with safe-area padding, while
destructive or administrative work remains in full-screen modals.

---

## 8. Component library

### 8.1 Buttons

`Button` variants (`btn-primary`, `btn-secondary`, `btn-glass`, `btn-ghost`, `btn-danger`,
`btn-success`) and sizes (`sm`, default, `lg`, `icon`, `icon-sm`).

| Variant | Look | Typical use |
| --- | --- | --- |
| Primary | Gradient primary fill, inner highlight, coloured shadow, contrast text | Commit, create, charge, save |
| Secondary | Solid raised surface with border and small shadow | Cancel, print, export, back |
| Glass | Translucent glass with inner edge | Top-bar menu / ambient controls |
| Ghost | Transparent, muted text, soft hover | Row actions, clear, sign out |
| Danger | Solid danger fill | Void, deactivate |
| Success | Solid success fill | Positive completion (available to callers) |

All buttons share a 12px radius (9–14px by size), `transform` press feedback
(`translateY(1px) scale(0.99)`), a 1px hover lift, and a `loading` state that replaces the left icon
with a spinning `Loader2` and disables the control. `leftIcon`/`rightIcon` are supported. Text is
never wrapped (`white-space: nowrap`).

### 8.2 Forms

- `Field` composes a label, optional required asterisk, hint, error, and a right-aligned label slot.
  Errors replace hints. Login inputs set `aria-invalid` on failure.
- `Input`, `Select`, and `Textarea` share 40px height (84px textarea), 11px radius, solid surface,
  hover border, and a 3px primary focus ring.
- `Select` is custom-styled with a CSS chevron; `option` elements use native styling.
- Error state (`.input-error`) uses a danger border and a danger-tinted ring.
- `input-icon-wrap` adds a left icon and 34px left padding; `input-suffix` adds a right-aligned unit
  such as `TZS` or `%`.
- Checkboxes use `accent-color: var(--primary)`; switches are custom 39×23px pill controls with a
  spring-animated 17px knob (`.switch.is-on`).
- `.segmented` and `.tabs` provide pill-style option groups with a raised active state. The date
  presets in `RangePicker` use the segmented pattern.
- Numeric money fields use `step={500}` where appropriate, number inputs are clamped in handlers, and
  text inputs carry sensible `maxLength` limits.
- Forms use `.form-grid` (two columns) which collapses to one column at ≤767px; `.field-full` spans
  the row.

### 8.3 Badges, chips, avatars, status

- **Badges** — pill labels at 0.66rem, 700 weight, with six tones: primary, success, warning, danger,
  info, neutral. A status dot can be prepended.
- **StatusBadge** — sale states: completed → success, refunded/partially refunded → warning,
  voided → neutral.
- **MethodBadge** — cash → neutral, mobile money → info, card → primary.
- **StockBadge** — out of stock → danger, low stock → warning, in stock → success.
- **RoleBadge** — admin → primary, cashier → info.
- **Chips** — outlined neutral pills used for dates and passive metadata (`.chip`, `.chip-primary`).
- **Avatars** — circular initials (29/36/48px) on a primary-to-accent soft gradient; `aria-hidden`
  with a title.
- **Status dot** — 6px current-colour dot with a 3px translucent halo.
- **Category chips** — horizontal scrolling filter pills on POS, with a filled primary active state.


### 8.4 Cards, KPIs, and data lists

- `.card` is the canonical data container: solid surface, 1px border, 22px radius, small shadow, with
  `.card-header`, `.card-title`, `.card-subtitle`, and `.card-body`.
- **KpiCard** — 128px minimum height, radial primary wash and an accent orb, icon tile, label, large
  numeric value, and an optional trend arrow (`up` success / `down` danger) plus hint. Cards stagger
  in at 55ms intervals and lift 2px on hover. On mobile they shrink to 104–113px.
- **Hero card** — the dashboard's editorial panel with a grid mask, kicker, greeting headline, copy,
  and a row of headline stats plus "Start a sale" / "Sales" actions.
- **Stat boxes** — compact responsive metric tiles used in reports and users.
- **Data lists** — border-separated rows with optional leading icon/art, main text, subtitle, and a
  right-aligned numeric value. Used for recent sales, stock watch, refunds, low/out-of-stock lists,
  and audit metadata.

### 8.5 Tables and pagination

- `DataTable` renders `.table-wrap` → `.table-scroll` → `.data-table`, with a minimum width
  (default 690px; screens raise it to 760–980px) and horizontal touch scrolling on small screens.
- Headers are uppercase, soft, and not sticky; rows have a subtle hover wash and a 0.16s transition.
- Cells support `.cell-main`, `.cell-sub`, and `.cell-actions` (right-aligned action cluster).
- Clickable rows are keyboard-focusable and activate on Enter/Space, while clicks on nested buttons,
  links, inputs, selects, textareas, and labels are ignored so row actions still work.
- Loading shows skeleton rows (default 6) instead of a spinner. Empty state is rendered inside the
  table body area.
- `Pagination` shows "Showing X–Y of Z", an optional page-size select (10, 12, 20, 40, 100), and
  previous/next icon buttons with "page / pages" text.
- Toolbars (`.table-toolbar`) hold search, filters, clear actions, and result counts; they wrap on
  narrow screens.

### 8.6 Modals, drawers, and confirmations

- `Modal` renders through a portal with an `AnimatePresence` backdrop and panel.
- Backdrop: dark translucent layer with 9px blur and 125% saturation; panel: strongest glass, 26px
  radius, 600px default / 900px wide / 430px small, max height `min(86dvh, 900px)`.
- Accessibility: `role="dialog"`, `aria-modal`, labelled/described by generated IDs, initial focus
  moved to the first focusable element after 60ms, a manual focus trap on Tab/Shift+Tab, Escape to
  close (when dismissible), backdrop click to close, and body scroll lock.
- The footer is a bordered action row; at ≤479px it stacks and every child becomes full width.
- Below 768px, modals become bottom sheets: full width, 92dvh max, 24px top corners.
- `ConfirmDialog` is a small modal with cancel + confirm, optional destructive styling, and a loading
  state that also disables dismissal.
- The mobile navigation uses `.mobile-drawer` (left, 310px max, glass) with a blurred scrim.
- The POS mobile cart uses a bottom-sheet modal, while the desktop cart is a sticky glass panel at
  `top: 86px`.

### 8.7 States, alerts, and feedback

- **Skeleton** — shimmering neutral blocks (`shimmer` 1.4s), used for first-load page data and table
  rows. The app prefers skeletons over full-page spinners after boot.
- **Spinner** — `Loader2` with `.spin` (0.8s linear), used for in-button and inline loading.
- **BootScreen** — full-viewport floating brand mark with "Opening your workspace" / "Preparing your
  counter"; used during auth boot.
- **EmptyState** — 52px icon tile, title, 330px-max copy, and optional action. Every data surface has
  a tailored empty state rather than a generic message.
- **ErrorPanel** — danger alert with an optional retry link.
- **Alerts** — neutral, danger, warning, success, and info variants with tinted backgrounds and
  borders; used for sale status, validation summaries, form errors, and demo notices.
- **Toasts** — Sonner at top-right, rich colours, close button, 3.8s duration, 12px type, 14px radius,
  theme-aware. Used for successful saves, barcode results, stock warnings, checkout results, exports,
  and blocked pop-ups.

### 8.8 Range picker

`RangePicker` combines presets and a custom popover:

- Presets: Today, 7D, 30D, Month, shown as a segmented control at ≥640px.
- Trigger: secondary small button with a calendar icon, formatted range label (ellipsis at 210px),
  and a chevron that rotates when open.
- Popover: anchored, right-aligned by default and left-aligned at ≤767px; width
  `min(300px, 100vw - 24px)`; two date fields side by side, collapsing to one at ≤479px; a "Done"
  action.
- Dates are clamped: `from ≤ to`, `to ≤ today`, and choosing one date adjusts the other. The control
  takes a full row below 640px.
- The picker uses the business timezone for "today" and for the human-readable label.

### 8.9 Barcode scanner

`BarcodeScanner` is a small modal with a camera viewport and manual fallback:

- Viewport: 4:3 dark gradient with a white reticle, a violet scan line animated 1.8s top-to-bottom,
  and a heavy outer vignette. At ≤479px it becomes square.
- Idle, starting, denied, and error states show a spinner or `CameraOff` with a plain-language
  message.
- Decoding: prefers the native `BarcodeDetector` API (EAN-13/8, UPC-A/E, Code 128/39, ITF, Codabar).
  When unavailable, it lazily loads ZXing (`@zxing/browser`) and decodes the same stream. A native
  setup failure also falls back to ZXing.
- Duplicate scans are suppressed for 2.5s and submissions are serialised for 600ms. If the code is
  not accepted, an inline danger message appears and scanning continues.
- Manual entry is always available with an input and "Add" button; Enter submits.
- The camera starts in environment-facing mode at an ideal 1280×720 with audio off, and all tracks,
  animation frames, and ZXing controls are stopped on close.

### 8.10 Receipt preview and print

- In-app preview: white paper card at max 370px, 12px radius, monospace 10px, dashed rules, bold
  total, and a "DEMO RECEIPT · Not a TRA fiscal receipt" line. It includes business identity, TIN,
  receipt ref, date, cashier, customer, items, discounts, refunds, totals, payment method, cash
  received/change, simulated reference, and footer.
- Print: a 420×720 pop-up renders an 80mm thermal layout (`@page size: 80mm auto`, 4mm margin, 72mm
  body) in Segoe UI/Arial at 10.5px, then auto-prints and closes. If the pop-up is blocked, the user
  gets a toast explaining how to allow pop-ups.
- Receipt data is HTML-escaped before insertion, so business names and item text cannot inject markup.

---

## 9. Screen designs

### 9.1 Login (`/login`)

- Full-viewport split layout: editorial brand story on the left, glass sign-in card on the right
  (max 1140px, 1.04/0.96 columns). Below 1024px the art column is removed and the card centers.
- Background: three drifting aurora orbs, a radial-masked grid, and the global grain.
- Left column: brand mark, "The calm counter for a busy Kariakoo day.", supporting copy, and a bento
  of three mini glass cards with a micro bar chart.
- Right column: a `simple-liquid-glass` frosted panel containing a "Secure workspace" kicker, theme
  toggle, mobile brand, "Welcome back.", username/password fields with icons, show/hide password,
  inline error, and a full-width "Open the counter" button.
- Demo access: two one-tap account cards (Amina/admin, Joseph/cashier) that fill the form, with a
  "Simulated" badge and a footnote explaining that mobile money and card payments are simulated.
- Validation: empty fields produce a local error; API failures show the returned message; the submit
  button shows an inline spinner and is disabled while the request runs.
- Auth boot shows the `BootScreen` ("Preparing your counter"); an authenticated user is redirected to
  the requested page (or the dashboard).

### 9.2 Dashboard (`/dashboard`)

- Header with the page title, scope label ("Business overview" or "Your counter"), today's date, a
  range picker, and a refresh button with a spinning icon while loading.
- Hero card: time-of-day greeting, business/role-specific copy, net revenue, transactions, items sold,
  and "Start a sale" / "Sales" actions.
- Four KPI cards: gross sales, net revenue, transactions, and either estimated profit (admin, with
  low/out-of-stock hint) or items sold (cashier).
- **Revenue rhythm** area chart (sales and refunds) with glass tooltips, a legend, and an empty state
  that links to the counter.
- **Payment mix** donut with a central "collected" total, legend percentages, and amounts.
- **Top sellers** ranked list with proportional bars and revenue; **Stock watch** list of products at
  or below reorder point with a "Manage stock" action.
- **Recent sales** list with status badge, cashier, date, total, and links to sale detail.
- Loading uses skeleton blocks per section; errors appear in a retryable alert.

### 9.3 Point of sale (`/pos`)

- Two-column layout: catalogue on the left, sticky cart on the right (386px; 340px at ≤1279px).
- Header shows the cashier, available product count, today's date chip, and a link to Sales.
- Toolbar: icon-prefixed search ("Search or scan barcode") with a clear button, and a Scan button that
  opens the camera scanner. Pressing Enter in search attempts an exact barcode lookup first.
- Category strip: horizontally scrolling chips with "All products" and every category; active chip is
  filled primary.
- Product grid: responsive auto-fill tiles (152px minimum, 135px on small screens, 2-up on phones),
  category art, two-line name, price, in-cart badge, and stock note (normal/low/out). Out-of-stock
  tiles are disabled. "Load more products" paginates 48 at a time.
- Desktop cart: glass panel with item count badge, cashier, clear button, scrollable lines, quantity
  steppers, remove link, subtotal/items/total summary, discount field with role-aware limits and
  validation, and a large "Charge TZS …" button.
- Mobile cart (≤1023px): fixed bottom bar with icon, item count, total, and "View cart", opening a
  bottom-sheet modal with the same cart controls. Safe-area padding is respected.
- Checkout modal: payment tiles for Cash / Mobile / Card, cash received with quick-cash chips
  (exact, +5K, +10K, +20K) and change due, provider selectors for mobile/card, optional customer and
  note, and a totals recap. "Complete" is disabled until cash covers the total.
- Successful checkout opens the receipt modal automatically and clears the cart; duplicate requests are
  prevented with an idempotency key. Insufficient stock is reconciled in-place and explained.
- Barcode scans from the camera add the matching single product and toast the result; manual entry is
  available inside the scanner.

### 9.4 Sales (`/sales`)

- Header: transaction count for the selected range, range picker, and "New sale".
- Toolbar: search across reference/customer/cashier, payment-method filter, status filter, cashier
  filter (admin only), and a clear-filters action when active.
- Table columns cover reference, date/time, customer, cashier, method, status, items, and total; rows
  open the sale detail. The table loads with skeleton rows and shows filter-aware empty states.
- Pagination supports 10/12/20/40/100 rows per page.

### 9.5 Sale detail (`/sales/:id`)

- Header repeats the sale reference, date, and cashier; actions are Back, Print, Refund, and Void.
- A status alert appears for non-completed sales: danger for voided, warning for refunded, with an
  explanation of stock and money effects.
- Main column: items table, totals (subtotal, discount, sale total, refunded, retained), payment card
  (method, amount, cash received/change or simulated reference, captured/reversed status), customer
  and note card, and a refund history list when present.
- Side column: sticky receipt preview plus a demo-compliance note.
- Refund modal: amount (max refundable), required reason, and a restock checkbox available only for a
  full refund; validation errors are inline.
- Void confirmation: destructive dialog explaining that the whole sale is reversed and all units are
  returned to stock.
- Refund and Void are admin-only.

### 9.6 Products (`/products`)

- Header: product count and an "Add product" action for admins; cashiers see a "Cashier view" badge.
- Toolbar: search (name/SKU/barcode), category filter, status filter (admin), stock filter
  (all/low/out), sort select (name, price, stock), and clear filters.
- Table: product with art and SKU, category, price, cost (admin), stock with badge, status, and row
  actions (edit/deactivate for admin). Rows/cells use the shared table and pagination patterns.
- Create/edit modal (wide): name, SKU, barcode with camera-scan button, category, unit, cost, selling
  price, opening stock (create only), reorder point, description, and an active switch. Editing shows
  an info alert that stock is changed through Inventory movements.
- Field-level validation plus a top-level form alert; save/cancel disable during the request.
- Deactivation uses a destructive confirmation with a compact product preview.


### 9.7 Categories (`/categories`)

- Header: group counts (total, active, products) and "Add category" for admins; cashiers see the
  read-only badge.
- Search field with clear action.
- Card grid (1/2/3 columns) rather than a table: a radial wash in the top-right corner, a tag icon
  tile, name, active/inactive badge, two-line description, active/total product counts, and
  hover-revealed edit/deactivate buttons for admins. Inactive cards are dimmed.
- Create/edit modal: name, description, active switch.
- Activation changes use a confirmation dialog that explains the effect on cashier filters and keeps
  existing products in the catalogue.
- Loading uses six skeleton cards; empty states distinguish "no categories" from "no search match".

### 9.8 Inventory (`/inventory`) — admin

- Header actions: "Adjust" and "Stock in".
- Four KPIs: units on hand, cost value, retail value, and stock alerts (low/out split).
- Two alert cards: **Low stock** and **Out of stock**, each showing up to six products with art, SKU,
  reorder point, remaining units, and a one-tap stock-in button.
- Movements table: search, movement-type filter (sales, stock in, adjustments, voids, returns), count,
  and pagination. Loading and empty states follow the shared table pattern.
- Stock in modal: product search/select (or a pre-selected product card with a "Change" action),
  quantity received, required reason, optional reference.
- Adjustment modal: signed quantity change, required reason, and a live "stock after adjustment"
  preview.
- Both modals validate, show a product summary, and disable actions while submitting.

### 9.9 Reports (`/reports`) — admin

- Header: date range, refresh, and "Export".
- Four KPIs: gross sales, net revenue, estimated profit, and average sale with refund/discount hints.
- Secondary stat row: items sold, transactions, discounts, and total stock alerts.
- **Revenue vs refunds** area chart and **payment mix** donut (same visual system as the dashboard).
- **Best sellers** and **category performance** ranked bar lists using proportional tracks.
- **Inventory snapshot**: active products, units, cost value, retail value, low stock, out of stock.
- **Sale status breakdown** cards for completed/refunded/voided counts and values.
- Footer line with generation timestamp and the note that profit is a cost-based estimate.
- Export modal lists four CSV options (summary, sales register, best sellers, inventory snapshot),
  each with an icon, description, and a per-option spinner while exporting.

### 9.10 Users / Team (`/users`) — admin

- Header with "Add user".
- Four stat boxes: team members, administrators, cashiers, inactive.
- Toolbar: search (name/username/email), role filter, clear, and a visible/total count.
- Table: user identity (avatar, name, @username, "you" marker), email, role badge, status, and
  edit/activate actions.
- Create/edit modal: full name, username, email, role, password (optional when editing), and an active
  checkbox. The current user cannot change their own role or deactivate themselves; helper copy
  explains this.
- Deactivation is confirmed and explains that history is kept but access is removed.
- A footer card summarises what cashiers and administrators can do and the rule that at least one
  active administrator must remain.

### 9.11 Settings (`/settings`) — admin

- Header actions are dirty-state aware: Reset and "Save changes" are disabled until something changes;
  save shows a spinner.
- Two-column layout at ≥1024px: form sections on the left, sticky receipt preview and "Current rules"
  on the right.
- **Business profile** card: business name, phone, email, address, TIN, read-only currency.
- **Receipt & locale** card: timezone select, receipt footer textarea with a live character count, and
  a note showing the current time in the selected zone plus the demo-receipt disclaimer.
- **Stock & discounts** card: default low-stock threshold, "Allow cashier discounts" switch, and a
  range slider + numeric input for the cashier limit, with disabled styling when off.
- The live receipt preview updates as the form changes and uses the same paper/monospace language as
  the POS receipt.
- A note states that every settings change is audit-logged.

### 9.12 Audit log (`/audit`) — admin

- Header with an event count, "immutable activity trail" subtitle, and refresh.
- Toolbar: search across description/actor/entity, action filter with counts, clear, and an action-type
  count.
- Table: a tone-coded action badge + entity, description, optional expandable JSON details
  (`<details>`), actor with role badge, and entity ID (truncated, monospace).
- Empty states distinguish no events from no filter matches.
- A footer note explains that entries are append-only and capture who changed what and when.

### 9.13 Not found

- Centered 404 panel with a large rounded tile, compass badge, "This aisle doesn't exist.", a short
  retail-flavoured explanation, "Go to dashboard", and "Go back" actions.

---

## 10. Motion design

Motion is implemented with `motion/react` (Framer Motion) for React components and CSS keyframes for
ambient effects. Tokens live in `src/lib/motion.ts`.

### 10.1 Tokens

| Token | Value |
| --- | --- |
| `springs.snappy` | stiffness 180, damping 22, mass 1 |
| `springs.gentle` | stiffness 160, damping 20 |
| `springs.bouncy` | stiffness 200, damping 12 |
| `springs.drawer` | stiffness 180, damping 24 |
| `durations.instant` | 0.15s |
| `durations.fast` | 0.30s |
| `durations.base` | 0.40s |
| `durations.slow` | 0.50s |
| `stagger(index)` | `min(index × 0.06, 0.4)` seconds delay |

### 10.2 Applied motion

| Interaction | Behaviour |
| --- | --- |
| Page entry | `page-in` keyframe: opacity 0 → 1, translateY 12px → 0, 0.5s `--ease-out` |
| KPI cards | `fadeSlideUp` (opacity + 20px) at 0.4s, staggered 55ms, hover lift 2px |
| Modal | Backdrop fades 0.3s; panel springs from scale 0.92 / y 24 to rest |
| Mobile drawer | Slides from the left with `springs.drawer`; scrim fades 0.25s |
| Buttons | Hover lift 1px; press translateY 1px + scale 0.99 |
| Product tiles | Hover lift 3px with a stronger shadow; press returns to rest + scale 0.99 |
| Theme glyph | Rotate −90° / scale 0.4 / fade out, then rotate 0 / scale 1 / fade in at 0.24s |
| Scanner | Repeating scan line 1.8s; spinner 0.8s linear |
| Ambient | `animate-float` 7s, `animate-drift` 12s, aurora orbs on login and background |
| Skeletons | `shimmer` 1.4s infinite |
| Toasts | Sonner defaults with a 3.8s duration |

### 10.3 Reduced motion

`prefers-reduced-motion: reduce` collapses all animations and transitions to 0.01ms globally and
disables smooth scrolling. The theme toggle also uses `useReducedMotion` to replace the glyph
rotation with a simple opacity change.

---

## 11. Interaction patterns and microcopy

- **Progressive disclosure** — filters and secondary actions sit in toolbars; details such as audit
  JSON are collapsed; row actions appear on hover on desktop but remain visible on touch.
- **Destructive actions** — void, refund, deactivate, and remove flows use explicit copy about the
  consequence (stock, revenue, access) and a destructive confirm button. Clearing the POS cart uses
  the browser's native `window.confirm` for speed, the one intentional departure from custom dialogs.
- **Feedback hierarchy** — inline field errors for validation; inline alerts for page/form-level
  problems; toasts for transient successes and failures; skeletons for loading structure; spinners
  for actions.
- **Stock awareness** — product tiles show stock notes, out-of-stock tiles are disabled, quantity
  steppers clamp to available stock, and checkout reconciles server-side stock conflicts.
- **Search behaviour** — search is debounced (280ms on POS, 300ms default) and resets pagination;
  clearing search restores the full list. Enter in POS search performs a barcode lookup.
- **Idempotency** — each checkout attempt carries an idempotency key, and a duplicate response is
  surfaced as "Sale already recorded." instead of creating a second sale.
- **Demo transparency** — "Simulated" badges, receipt disclaimers, and settings notes make the demo
  boundary explicit without hiding functionality.
- **Microcopy tone** — warm, specific, and retail-flavoured: "The calm counter for a busy Kariakoo
  day.", "Opening the counter", "This aisle doesn't exist.", "The cart is ready", "Stock looks
  healthy". Copy uses sentence case, plain verbs, and concrete numbers; jargon is avoided.

---

## 12. Accessibility

- **Focus** — a global `:focus-visible` outline (2px primary, 2px offset) on all interactive
  elements; the theme toggle has its own focus ring.
- **Dialogs** — portal rendering, `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`,
  focus trap, Escape to close, backdrop click, restore of body overflow, and initial focus.
- **Keyboard** — Enter/Space activate clickable table rows; Enter submits the scanner's manual form;
  all icon-only controls have `aria-label`; the mobile menu button, pagination, cart, and clear
  controls are labelled.
- **Forms** — visible labels, hints, and errors; required fields marked with an asterisk; login
  inputs set `aria-invalid`; switches expose `role="switch"`/`aria-checked` or `aria-pressed`.
- **Status communication** — sale and stock states pair colour with text and dots, so status is not
  colour-only; scanner messages use `role="status"`; login errors use `role="alert"`.
- **Motion** — reduced-motion support globally and in the theme toggle.
- **Mobile ergonomics** — safe-area insets on the fixed cart bar; bottom-sheet modals; full-width
  actions on phones; large quantity steppers at ≤1023px.
- **Known gaps** — some desktop icon buttons are 29–36px rather than the 44px touch-target guideline;
  there is no skip-to-content link; tables rely on horizontal scrolling rather than a stacked mobile
  layout; colour contrast has not been formally audited across all three themes.

---

## 13. Data display and formatting

| Concern | Rule |
| --- | --- |
| Currency | `TZS ` prefix plus grouped integers, e.g. `TZS 12,500` |
| Compact numbers | `K`, `M`, `B` with one decimal above 1,000 |
| Dates | `en-GB` short date, e.g. `27 Oct 2026` |
| Date + time | `en-GB`, 24-hour, e.g. `27 Oct 2026, 18:42` |
| Business timezone | Default `Africa/Dar_es_Salaam`, configurable in Settings |
| Date inputs | ISO `YYYY-MM-DD`, clamped to today |
| Identifiers | Monospace, often truncated with an ellipsis |
| Labels | Explicit maps for payment methods, sale statuses, roles, stock movements, and audit actions |

Number formatting uses `en-US` grouping while dates use `en-GB`, a deliberate mix that keeps TZS
amounts familiar and dates unambiguous.

---

## 14. Role-aware UX

| Area | Cashier | Administrator |
| --- | --- | --- |
| Navigation | Workspace only | Full navigation, including Operations and Administration |
| Dashboard | Own counter scope; items-sold KPI instead of profit | Business scope; profit and stock-alert KPIs |
| POS | Sell, scan, print receipts; discounts limited by settings | Same, with unlimited discount up to the subtotal |
| Sales | Own sales | All sales, with cashier filter |
| Sale detail | View and print | Refund and void, with confirmations |
| Products / Categories | Read-only catalogue | Create, edit, activate/deactivate |
| Inventory / Reports / Users / Settings / Audit | No access (route redirect) | Full access |
| Settings limits | Discount cap and low-stock rules apply | Can change the rules |

The role model is reinforced visually with the "Cashier view" badge on read-only management screens,
role badges in tables and the sidebar, and a top-bar identity block.

---

## 15. Implementation map

| Concern | Where |
| --- | --- |
| Tokens, themes, glass, layout, all component CSS | `src/index.css` |
| Theme provider, persistence, toggle | `src/lib/theme.tsx`, boot script in `index.html` |
| Motion tokens and variants | `src/lib/motion.ts` |
| Shell, navigation, mobile drawer, top bar | `src/components/AppShell.tsx` |
| Buttons, fields, badges, avatars | `src/components/ui/Button.tsx`, `Input.tsx`, `Badge.tsx`, `Avatar.tsx` |
| Cards, KPIs, page headers | `src/components/ui/KpiCard.tsx`, `PageHeader.tsx` |
| Tables and pagination | `src/components/ui/DataTable.tsx` |
| Modals, confirmations, states | `src/components/ui/Modal.tsx`, `ConfirmDialog.tsx`, `States.tsx` |
| Range picker, scanner, product art | `src/components/ui/RangePicker.tsx`, `BarcodeScanner.tsx`, `ProductArt.tsx` |
| Receipt preview and print | `src/components/ui/ReceiptModal.tsx`, `src/lib/receipt.ts` |
| Screens | `src/pages/*.tsx` |
| Routing, guards, toaster theme | `src/App.tsx` |
| Formatting, labels, timezone helpers | `src/lib/utils.ts` |

### Changing the design safely

1. Add or adjust tokens in `src/index.css` under every `.theme-*` block so all three themes stay in
   sync; prefer `color-mix()` for derived borders and tints.
2. Reuse existing primitives (`Button`, `Field`, `Modal`, `DataTable`, `EmptyState`) before adding new
   CSS classes.
3. Put shared animation values in `src/lib/motion.ts` and respect `prefers-reduced-motion`.
4. Check both 1280px+ and ≤767px layouts; the POS and modals have dedicated mobile behaviour.
5. Verify both roles: hide admin-only actions in the UI while keeping server-side authorization.

---

## 16. Known constraints

- Camera scanning requires a secure context and permission. Native `BarcodeDetector` is unavailable in
  some browsers, so ZXing is loaded as a fallback; manual entry remains available if the camera cannot
  start. Camera capture is not exercised in the automated build.
- Receipt printing depends on a pop-up window; pop-up blockers produce an explanatory toast.
- Glass relies on `backdrop-filter`; there is no dedicated reduced-transparency or high-contrast mode.
- The demo database is SQLite and ephemeral on Vercel, so UI state resets per instance.
- Wide tables scroll horizontally on phones rather than reflowing into cards.
- The POS "clear cart" action uses the native browser confirmation while every other destructive flow
  uses the custom dialog.

