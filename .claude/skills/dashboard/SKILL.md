---
name: dashboard
description: Build the Mesa School of Business LMS UI — shadcn/ui (radix-nova) + Tailwind v4 + Mesa brand tokens (ink charcoal base, lime=admin / mint=student accents, OKLCH, DM Sans). Use when the user asks to build/add/redesign any admin or student page, module, card, sidebar/bottom-nav item, stat, chart, table, empty/loading state, dialog, sheet, auth surface, theme toggle, or scroll/layout behaviour in this repo. Covers design tokens, role theming, neutral dark mode, the ScrollArea-pinned app shell, the animated theme switch, the logo system, scrollbars, the rem-only rule, and composition recipes.
---

# Mesa LMS Dashboard UI

The aesthetic: **ink charcoal base (from the Mesa logo)**, **lime accent for admin · mint accent for students**, **DM Sans throughout**, **flat/editorial — borders over glows**, **container-query responsive**. **Light is default and the canonical look** (charcoal/ink with a faint cool-green cast); **dark mode is pure neutral black/gray** with the brand accents layered on top.

This file is the source of truth for matching the Mesa brand and the existing shell. Before writing new UI, scan it for the nearest existing pattern and reuse it. Companion: [`docs/brand-guidelines.md`](../../../docs/brand-guidelines.md).

---

## 1. Tech stack (what's actually installed)

| Thing | Version / Import |
|---|---|
| Next.js | 16.x (App Router, RSC, Turbopack). **Breaking changes** — check `node_modules/next/dist/docs/` before relying on training-data APIs. See `AGENTS.md`. |
| React | 19.2.x (React Compiler on via `babel-plugin-react-compiler`) |
| Tailwind | v4 (CSS-first, **no `tailwind.config.js`**; tokens via `@theme` + utilities via `@utility` in `src/app/globals.css`) |
| shadcn/ui | v4, **`radix-nova` style** — components in `src/components/ui/` |
| Primitives | `radix-ui` (single package) + `@base-ui/react` |
| Icons | `lucide-react` |
| Charts | `recharts` v3 via `ui/chart.tsx` |
| Tables | plain `ui/table.tsx` (**`@tanstack/react-table` is NOT installed** — don't import it) |
| Data fetching | `@tanstack/react-query` (`src/providers/query-provider.tsx`; draggable devtools in dev — `query-devtools.tsx`) |
| Themes | `next-themes` (class strategy, **light default**, `enableSystem`, `disableTransitionOnChange`) — `src/providers/theme-provider.tsx` |
| Toasts | `sonner` via `ui/sonner.tsx` (`<Toaster />` mounted in `Providers`) |
| Command palette | `cmdk` via `ui/command.tsx` |
| Drawer | `vaul` via `ui/drawer.tsx` |
| Forms | `react-hook-form` + `zod` (`@hookform/resolvers`) |
| Dates | `date-fns`, `react-day-picker` |
| Auth/data | `firebase` (Firebase Auth + GCS). Env validated in `src/lib/config/env.ts`; `lib/auth/firebase.ts` + `lib/api/client.ts` are stubs |
| Animation | **`tw-animate-css`** (in globals) + CSS for most motion. **`motion`** (`motion/react`) installed for purposeful interaction animation (e.g. the theme-toggle icon) — not decoration |
| Utils | `clsx`, `tailwind-merge`, `cva` → `cn()` in `@/lib/utils` |

**Tailwind v4 quirks:** gradients are `bg-linear-to-*` (not `bg-gradient-to-*`); prefer `size-8`/`size-1.5` over `h-X w-X`; arbitrary OKLCH must underscore spaces (`to-[oklch(0.66_0.17_38)]`).

**Never** add `tailwind.config.js` or import `@tanstack/react-table`. `motion/react` is fine, used sparingly.

---

## 2. The rem-only rule (no pixel values)

**Do not use pixel arbitrary values in classNames.** Use the rem-based spacing scale — including v4 fractional steps, which are rem under the hood:

| Instead of | Use |
|---|---|
| `rounded-[10px]` | `rounded-lg` (`--radius` = 0.625rem = 10px) |
| `h-[2px]` `w-[17px]` `mt-[3px]` `top-[7px]` | `h-0.5` `w-4.25` `mt-0.75` `top-1.75` |
| `text-[11px]` `text-[10px]` | `text-[0.6875rem]` `text-[0.625rem]` (rem) |

`em` values (`tracking-[0.16em]`) are fine. Raw `px` inside `globals.css` CSS is converted to rem too, except 1px hairlines. Vendor `ui/*` components keep their original arbitrary values — don't rewrite them.

---

## 3. Design tokens — the Mesa palette

All colors are OKLCH CSS variables in `src/app/globals.css`. **Never hardcode hex.** Tint with `color-mix(in oklab, var(--token) X%, transparent)` or the opacity slash (`bg-primary/10`).

### Ink — neutral base (faint cool-green cast, hue ≈ 175) — light mode only
```
--ink-900  oklch(0.245 0.014 174)  /* #1F2A28 — logo charcoal, headings, light foreground */
--ink-700  oklch(0.365 0.013 178)  /* body text */
--ink-500  oklch(0.555 0.012 178)  /* muted text */
--ink-200  oklch(0.925 0.006 175)  /* borders (light) */
--ink-50   oklch(0.985 0.002 175)
--ink-950  oklch(0.180 0.014 174)
```
The ink scale's faint green is intentional in **light** mode (matches the logo). **Dark mode does NOT use it** — see §5.

### Accents — lime (admin) + mint (student)
```
--brand-lime-500  oklch(0.895 0.105 112)  /* #D9E38A — admin button accent (light, needs ink text) */
--brand-lime-700  oklch(0.66  0.11  116)  /* readable olive — admin chart line on white */
--brand-mint-500  oklch(0.785 0.135 153)  /* #6ED190 — student accent */
--brand-mint-600  oklch(0.70  0.135 154)  /* readable mint — student chart line */
```
Accents are **light** → filled controls use the accent with **ink text** (`--primary-foreground: var(--ink-900)`), the mesaschool.co pill look.

### shadcn system (what `bg-card`, `text-foreground`, `bg-primary` resolve to)
```
--background  white (light) / oklch(0.16 0 0) neutral black (dark)
--card        white (light) / oklch(0.205 0 0) (dark)
--foreground  --ink-900 (light) / oklch(0.985 0 0) (dark)
--primary     --ink-900  → rebound to lime/mint by role (§4)
--primary-foreground  --ink-900 on the accents
--border      --ink-200 (light) / oklch(1 0 0 / 10%) (dark)
--ring        accent / neutral gray (dark)
```

### Charts — readable, NOT the light accent
`--chart-1` = olive (admin) / mint-600 (student) primary series · `--chart-2` teal-blue · `--chart-3/4/5` mint/amber/gray (light), neutral/blue/amber (dark). Never put a `-500` accent line on white.

### Semantic + scrollbar
`--success` green · `--warning` amber · `--destructive` red · `--info` blue · `--scrollbar` (dark-green in light, neutral gray in dark).

### Typography — DM Sans
`font-sans` / `font-heading` → DM Sans; Geist Mono for `font-mono`. Weights: 400 body · 500 labels/buttons · 600 card titles · 700 headings. Eyebrow: `text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground`.

### Radii — `--radius: 0.625rem`
`rounded-lg` buttons/inputs · `rounded-xl` cards · `rounded-2xl` headers/hero · `rounded-full` pills/avatars.

---

## 4. Role theming — the key pattern

Accents are rebound per workspace on the shell wrapper, not global. Note the **two distinct accents per role**:

|  | Admin (`.theme-admin`) | Student (`.theme-student`) |
|---|---|---|
| `--primary` (buttons, CTAs, ring) | **lime** `brand-lime-500` | **mint** `brand-mint-500` |
| `--sidebar-primary` (active nav tab) | **clean green** `oklch(0.68 0.14 156)` (deliberately not the yellow-leaning lime) | **mint** |
| `--chart-1` | `brand-lime-700` (olive) | `brand-mint-600` |
| sidebar canvas (light) | barely-there green wash (`color-mix` of the green into white at 7/14/16%) | barely-there mint wash (9/16/18%) |

- `:root` primary = **ink charcoal** (neutral — used by auth + landing).
- Everything downstream reads `var(--primary)` / `var(--sidebar-primary)`, so the same components recolor per role with **no per-component branching**. To accent one element off-role, rebind on a wrapper: `style={{ "--primary": "var(--brand-mint-500)" }}`.

---

## 5. Light / dark mode

- **Light is the canonical look** — charcoal ink + faint-green-tinted neutrals + white cards.
- **Dark mode is pure neutral grayscale** (`.dark` in globals): `--background` `oklch(0.16 0 0)`, cards `0.205`, surfaces `0.27`, text `0.985`, borders `1 0 0 / 10%` — **chroma 0, no green cast**. The brand accents (lime/mint buttons, green/mint active tab) are layered on top.
- Dark mode keeps a **neutral sidebar** regardless of role: `.dark .theme-admin, .dark .theme-student` overrides the light green/mint sidebar wash back to neutral black. The active-tab indicator still comes from `--sidebar-primary` (green/mint).

When adding themed UI:
1. Use tokens (`bg-card`, `text-foreground`, `border-border/60`) — never `bg-white`, `text-slate-*`, raw hex.
2. Design light first, then verify dark (translucent overlays → `bg-card`/`bg-muted` tints, not `bg-white/5`).
3. Gate theme-aware client components on a `mounted` state (and any theme-dependent SSR attribute, e.g. `aria-label`) to avoid hydration mismatch.
4. Dark mode must read as **neutral black** — don't reintroduce green into dark surfaces; brand green belongs only to accents.

---

## 6. The animated theme toggle

`ThemeSwitch` (`src/components/shared/theme-switch.tsx`) is a **2-way light↔dark toggle** (no system option), mounted in the topbar:
- The sun/moon icon **morphs with a `motion/react` spring** (`AnimatePresence`, rotate + slide + fade).
- The theme change **sweeps in as a circular reveal** from the click point via the **View Transitions API** (`document.startViewTransition` + `flushSync(() => setTheme(next))`, then a `clipPath` `circle()` animation on `::view-transition-new(root)`).
- **Falls back to an instant switch** when View Transitions are unsupported or `prefers-reduced-motion` is set.
- The `::view-transition-*` rules in `globals.css` disable the default cross-fade so only the clip animates.

Gotcha: any ancestor with `transform`/`filter`/`backdrop-filter` creates a containing block that traps `position: fixed` panels — keep those off wrappers around full-screen fixed UI (this is why the draggable devtools pill uses no `backdrop-blur`).

---

## 7. The app shell — don't rebuild it

Both role layouts pin the chrome to the viewport and **scroll only the main content via `ScrollArea`**. Render your page as `children`; never add another sidebar/header/bottom-nav.

```tsx
// (app)/admin/layout.tsx  — student is identical with theme-student + <BottomNav/>
<SidebarProvider className="theme-admin h-svh overflow-hidden">
  <AppSidebar role="admin" />
  <SidebarInset className="min-h-0 overflow-hidden">
    <AppTopbar role="admin" />
    <ScrollArea className="min-h-0 flex-1">
      <main className="@container/main flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </ScrollArea>
  </SidebarInset>
</SidebarProvider>
```

- **`min-h-0` is required** on the `ScrollArea` (and `SidebarInset`) — without it a flex child grows to content height and nothing scrolls.
- Student `main` adds `pb-24 md:pb-6` to clear the fixed `BottomNav`.
- `(app)/layout.tsx` is a pass-through reserved for the Firebase auth guard.

Shell components (`src/components/layout/`):

| Component | Notes |
|---|---|
| `AppSidebar` | Role-aware nav from `src/lib/navigation.ts`, `collapsible="icon" variant="inset"`. Header = `AppBrand` (expanded) / `LogoMark` (collapsed). Nav wrapped in `ScrollArea`. Active = `bg-sidebar-primary/10` + accent left bar + accent icon |
| `AppTopbar` | Sticky, `backdrop-blur`. Search pill (cmdk TODO), notifications, `ThemeSwitch`. Admin shows the sidebar trigger always; student shows it desktop-only + `LogoMark` on mobile |
| `NavUser` | Avatar + dropdown (profile/settings/sign-out). **Mock identity — TODO wire `useAuth`** |
| `BottomNav` | Student mobile only (`md:hidden`), 5 items from `studentBottomNav`, safe-area aware, `z-40` |

`TooltipProvider` is mounted globally in `Providers` (the `radix-nova` `SidebarProvider` does **not** include one — sidebar tooltips need it).

### Logo system (`src/components/layout/logo.tsx`)
- `Logo` — official lockup via `next/image`, theme-swapped PNGs (`/mesa-lockup-ink.png` light, `/logo-mesa.png` dark). Size via height util: `<Logo className="h-10" />`.
- `LogoMark` — the 1:1 "m" tile rendered as a **CSS mask filled with `currentColor`** (`bg-foreground` + `mask-image:/mesa-mark-ink.png`), so it's ink on light / white on dark with no asset swap. For collapsed sidebar, topbar-mobile, auth.
- `AppBrand` — mark + "MESA · LMS" + the workspace (Admin/Student) subhead; used in the sidebar header.

---

## 8. Scrollbars

- **Scrollable panels use `ScrollArea`** (`ui/scroll-area.tsx`) — main content and the sidebar nav. Wrap content and constrain the parent height; remember `min-h-0`.
- **Native scrollbars** (dropdowns, menus, mobile) are slim-styled globally: `scrollbar-width: thin` (Firefox) and a `0.25rem` rounded `--scrollbar` thumb (WebKit). No chunky OS default anywhere.

---

## 9. Signature utilities (`globals.css`)

| Utility | What | Use on |
|---|---|---|
| `soft-accent-wash` | Faint top-anchored radial of `var(--primary)` | Page headers, auth, landing |
| `grid-faint` | 2.5rem faint grid | Empty states, decorative backdrops |

`tw-animate-css` provides `animate-in` / `fade-*` / `slide-*` — use for entrance/decoration; reach for `motion/react` only for purposeful interaction (the theme toggle).

---

## 10. Shared primitives — **check these before building new**

| Component | Path | When |
|---|---|---|
| `PageHeader` | `layout/page-header.tsx` | Top of every page — eyebrow, title, description, actions; `soft-accent-wash` |
| `Section` | `shared/section.tsx` | Labeled group — title, description, action, children |
| `StatCard` | `shared/stat-card.tsx` | Metric tile — label, value, icon, trend, hint, optional `tone` |
| `EmptyState` | `shared/empty-state.tsx` | Empty/placeholder — icon, title, description, action (wraps `ui/empty`) |
| `PageLoader` / `StatCardSkeleton` | `shared/loading.tsx` | Loading states |
| `EnrollmentChart` | `dashboard/enrollment-chart.tsx` | Reference recharts area-chart (client component) |
| `Card`, `Button`, `Badge`, `Table`, `Sheet`, `Dialog`, `Drawer`, `DropdownMenu`, `Tabs`, `Progress`, `Avatar`, `Chart`, `Command`, `Tooltip`, `ScrollArea`, … | `ui/*` | shadcn primitives |

If a pattern exists in `shared/` or `layout/`, **import it — don't fork.**

---

## 11. Core recipes

### 11.1 Page scaffold
```tsx
export const metadata = { title: "Programs" }   // → "Programs · Mesa LMS"
export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Academics" title="Programs" description="…"
        actions={<Button size="sm"><Plus className="size-4" />New</Button>} />
      <Section title="…" description="…">{/* grids, cards, tables */}</Section>
    </div>
  )
}
```

### 11.2 Stat-card grid (container queries — main is `@container/main`)
```tsx
<div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
  {stats.map((s) => <StatCard key={s.label} {...s} />)}
</div>
```
Use `@xl/main` / `@4xl/main` (container) inside the shell, **not** `md:`/`lg:` (viewport), so grids reflow when the sidebar collapses. Viewport breakpoints are fine for auth/landing.

### 11.3 Primary CTA (accent fill, ink text)
```tsx
<Button size="sm"><Plus className="size-4" />New announcement</Button>
// bg-primary text-primary-foreground → lime+ink (admin) / mint+ink (student) automatically.
```

### 11.4 Chart card (recharts v3 via ui/chart) — readable chart tokens only
```tsx
const config = { active: { label: "Active", color: "var(--chart-1)" } } satisfies ChartConfig
<ChartContainer config={config} className="h-64 w-full">
  <AreaChart data={data}>
    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="var(--color-active)" stopOpacity={0.5} />
      <stop offset="95%" stopColor="var(--color-active)" stopOpacity={0} />
    </linearGradient></defs>
    <CartesianGrid vertical={false} strokeDasharray="3 3" />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
    <Area dataKey="active" type="monotone" stroke="var(--color-active)" fill="url(#fill)" strokeWidth={2} />
  </AreaChart>
</ChartContainer>
```

### 11.5 List view (plain table — no @tanstack/react-table)
```tsx
<Card className="overflow-hidden p-0">
  <Table>
    <TableHeader><TableRow className="hover:bg-transparent"><TableHead>…</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(r => <TableRow key={r.id}><TableCell>…</TableCell></TableRow>)}</TableBody>
  </Table>
</Card>
```
Hide secondary columns on small containers: `className="hidden @2xl/main:table-cell"`.

### 11.6 Create / edit → `Sheet` (or `Drawer` on mobile) · 11.7 Empty/loading · 11.8 Entrance
```tsx
<EmptyState icon={Inbox} title="Nothing yet" description="…" action={<Button size="sm">…</Button>} />
<div className="animate-in fade-in slide-in-from-bottom-2 duration-500">…</div>  // tw-animate-css, top-level only
```

---

## 12. Z-index contract

| Layer | z |
|---|---|
| Decorative / wash | `-z-10` |
| Content | `z-0` |
| Floating (dropdown, tooltip) | `z-10` |
| Sticky topbar | `z-30` |
| Bottom nav (student mobile) | `z-40` |
| Sheet/dialog/drawer | `z-50` |
| Draggable devtools (dev) | `z-[100000]` |
| View-transition new root | `9999` |

---

## 13. The rules

### Do
- Let role theming pick the accent (`var(--primary)` / `var(--sidebar-primary)`) — don't hardcode lime/mint per component.
- Use brand tokens + `color-mix(... var(--token))` for tints; rem scale for sizing (§2).
- Container queries (`@xl/main`…) for shell grids; viewport breakpoints for auth/landing.
- Wrap new scroll regions in `ScrollArea` with `min-h-0` on the flex child.
- Keep charts on `--chart-*` tokens; keep dark surfaces neutral.
- Import existing shared/layout components before composing your own.
- Test light AND dark, desktop AND (student) mobile bottom-nav.

### Don't
- Pixel arbitrary values (`[10px]`), hardcoded hex, `bg-white`/`bg-black`, `text-slate-*`/`text-gray-*`.
- Import `@tanstack/react-table` (not installed). (`motion/react` is fine, sparingly.)
- Add `tailwind.config.js`; use `bg-gradient-to-*` (it's `bg-linear-to-*`); spaces in arbitrary OKLCH (use `_`).
- Put a `-500` lime/mint line/text on white (too light) — use `-700`/ink or chart tokens.
- Reintroduce green into dark surfaces — dark is neutral; green is accent-only.
- Add glows/heavy drop-shadows (flat/editorial); put `transform`/`backdrop-filter` on ancestors of fixed full-screen UI.
- Re-add a sidebar/header/bottom-nav to a child page, or fork `PageHeader`/`StatCard`/`Section`.
- Use any font other than DM Sans / Geist Mono.

---

## 14. Workflow for a new page

1. **Read the nearest existing page** (`(app)/admin/page.tsx`, `(app)/student/page.tsx`) and mirror its composition.
2. **Start with `PageHeader`**; eyebrow matches the nav group (`src/lib/navigation.ts`).
3. **Split into `Section`s** — short title + description each.
4. **Populate with shared components** — `StatCard` grid, plain `Table` for lists, `Sheet`/`Drawer` for create/edit, `ConfirmDialog` for destructive actions.
5. **Empty + loading states** matching the live component's radius/padding.
6. **Charts** → client component, `ui/chart` + chart tokens.
7. **Run both themes** (and student mobile) and confirm nothing goes invisible.

If a request doesn't fit an existing pattern, stop and ask rather than inventing a new visual language.
