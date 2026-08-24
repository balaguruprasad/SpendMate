---
name: nextjs-architecture
description: Production architecture, project structure, and engineering conventions for the Mesa LMS Next.js frontend — feature-sliced folders, the TanStack Query data layer, the typed fetch/API client, Firebase auth, Zod schemas, domain types mirroring schema.sql, route groups, and providers. USE THIS whenever adding/wiring a feature, data fetching, mutation, API call, query hook, service, auth flow, route, env var, or deciding WHERE a file goes or HOW to structure code in this repo — even if the request doesn't say "architecture". For visual/UI/brand/styling work use the `dashboard` skill instead; this skill is the non-visual engineering counterpart.
---

# Mesa LMS — Production Next.js Architecture

How this frontend is structured and wired. The repo is a deliberate **feature-sliced** Next.js 16 app: domain logic lives in self-contained `features/*` slices, cross-cutting plumbing in `lib/*`, and the App Router in `app/*`. Most slice files are intentional **stubs whose header comment states the canonical pattern** — this skill is the source of truth for filling them consistently so every feature looks the same.

UI/brand/styling (tokens, shell, components, dark mode) is the **`dashboard`** skill's job — don't duplicate it here. This skill owns _structure, data, and conventions_.

---

## 1. Tech stack

| Layer        | Choice                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework    | **Next.js 16** (App Router, RSC, Turbopack). Breaking changes vs training data — check `node_modules/next/dist/docs/` and `AGENTS.md`. Note: middleware is renamed **`proxy`** (`src/proxy.ts`). |
| Language     | TypeScript (strict), React 19.2 (React Compiler via `babel-plugin-react-compiler`)                                                                                                               |
| Server state | **TanStack Query v5** (`@tanstack/react-query`) — all server data flows through it                                                                                                               |
| Validation   | **Zod** — form payloads + runtime parsing                                                                                                                                                        |
| Forms        | `react-hook-form` + `@hookform/resolvers` (zod)                                                                                                                                                  |
| Auth         | **Firebase Auth** (client SDK); backend verifies ID tokens, role via custom claims                                                                                                               |
| HTTP         | Typed **`fetch`** wrapper (`lib/api/client.ts`) — no axios                                                                                                                                       |
| UI           | shadcn/ui (radix-nova) + Tailwind v4 + DM Sans → see the **`dashboard`** skill                                                                                                                   |
| Utils        | `clsx` + `tailwind-merge` → `cn()` in `@/lib/utils`                                                                                                                                              |

Backend (separate): Node/Express on Cloud Run, **Cloud SQL (Postgres)** with **Kysely / raw SQL** (`schema.sql` is the source of truth), files on **GCS**, async via Cloud Tasks. The frontend talks to it over REST through the API client.

**Path alias:** import everything via `@/…` (maps to `src/`). Never deep relative paths like `../../../lib`.

---

## 2. Directory map

```
src/
  app/                      # App Router (routing + layouts only — no business logic)
    (auth)/login/           # unauthenticated route group (neutral shell)
    (app)/                  # authenticated route group
      admin/  …             # admin pages + layout (.theme-admin shell)
      student/ …            # student pages + layout (.theme-student shell + BottomNav)
    layout.tsx · page.tsx · providers.tsx · globals.css
  components/
    ui/                     # shadcn primitives (vendored — don't hand-edit)
    layout/                 # app shell (sidebar, topbar, nav-user, logo, bottom-nav)
    shared/                 # cross-feature widgets (data-table, confirm-dialog, role-guard, …)
    dashboard/              # dashboard-specific client pieces (charts)
  features/<feature>/       # ← the heart of the app (see §3)
  lib/
    api/                    # client.ts · query-keys.ts · http-error.ts
    auth/                   # firebase.ts · auth-context.tsx
    config/                 # env.ts · site.ts · navigation.ts
    utils.ts · constants.ts · navigation.ts
  providers/                # composed client providers (theme, query, auth, tooltip, toaster)
  types/                    # index.ts · models.ts · enums.ts · api.ts  (global domain types)
  hooks/                    # generic hooks (use-mobile, use-debounce, use-auth)
  proxy.ts                  # Next 16 "middleware": auth gate + role redirect
```

**Where does code go?** Domain logic (fetching, mutations, validation, feature types) → `features/<feature>/`. Reused-but-not-domain widgets → `components/shared/`. App-wide plumbing → `lib/`. Global domain shapes → `types/`. Pages stay **thin** — compose features + components, no fetching logic inline.

---

## 3. Feature slices — the core pattern

Every domain lives in `src/features/<feature>/` with the **same anatomy**. Keeping them uniform means any feature is predictable to read and extend.

```
features/courses/
  index.ts                       # public barrel — the ONLY entry other code imports
  services/courses.service.ts    # API calls → typed models (no React)
  hooks/use-courses.ts           # TanStack Query hooks built on the service
  schemas.ts                     # Zod schemas for create/update payloads
  types.ts                       # feature-local DTOs / view-models (not global)
  components/                    # feature-only components
```

Rules:

- **Import features only through their `index.ts` barrel** (`import { useCourses } from "@/features/courses"`), never reach into internal files from outside.
- **services/** are plain async functions that call the API client and return typed **models** (`@/types`). No React, no hooks — so they're testable and reusable.
- **hooks/** wrap services in TanStack Query (`useQuery`/`useMutation`). Components use hooks, never services directly.
- **schemas.ts** holds Zod schemas + their inferred types for forms (`z.infer`). Global, persisted shapes go in `@/types/models.ts`; transient form/DTO shapes stay feature-local in `types.ts`.

Existing slices: `users, programs, terms, courses, topics, materials, recordings, batches, enrollments, course-enrollments, elective-requests, groups, assignments, submissions, grades, announcements, announcement-replies, notifications, activity-logs, auth`.

---

## 4. The data layer (`lib/api`)

These three files are stubs — implement them once to these shapes; every service/hook builds on them.

### 4.1 `client.ts` — typed fetch wrapper

A single `api` helper that prefixes `env.NEXT_PUBLIC_API_BASE_URL`, attaches the Firebase **ID token** (`Authorization: Bearer …`), parses JSON, and throws `ApiError` on non-2xx.

```ts
import { auth } from "@/lib/auth/firebase";
import { env } from "@/lib/config/env";
import { ApiError } from "./http-error";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};
```

### 4.2 `http-error.ts` — `ApiError`

Wraps the backend error envelope (`@/types/api`) so callers/toasts get a stable `.message`, `.status`, `.code`.

### 4.3 `query-keys.ts` — centralized key factory

One factory per feature so keys are consistent and invalidation is safe. Hooks import keys from here — **never inline string keys**.

```ts
export const queryKeys = {
  courses: {
    all: ["courses"] as const,
    list: (params?: ListParams) => ["courses", "list", params] as const,
    detail: (id: string) => ["courses", "detail", id] as const,
  },
  // … one block per feature
};
```

---

## 5. TanStack Query conventions

Provider: `src/providers/query-provider.tsx` (`staleTime: 60s`, `refetchOnWindowFocus: false`, `retry: 1`; draggable devtools in dev). All server reads/writes go through hooks — components never call `fetch` or services directly.

**Query hook:**

```ts
export function useCourses(params?: ListParams) {
  return useQuery({
    queryKey: queryKeys.courses.list(params),
    queryFn: () => coursesService.list(params),
  });
}
```

**Mutation hook — invalidate by key on success:**

```ts
export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCourseInput) => coursesService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.courses.all }),
  });
}
```

Surface mutation errors with `sonner` toasts (already mounted). Prefer invalidation over manual cache writes unless you need optimistic UX. Use `enabled` to gate dependent queries; don't fetch in `useEffect`.

---

## 6. Domain types (`src/types`)

Single source of truth for shapes that cross features. **Mirror `schema.sql`** — keep them in lockstep with the database.

- `enums.ts` — every Postgres enum as a `const` tuple + inferred union (`USER_ROLES` → `UserRole`, `TOPIC_TYPES`, `ASSIGNMENT_STATUSES`, `NOTIFICATION_TYPES`, …). Use these unions, don't retype string literals.
- `models.ts` — entity interfaces (`User`, `Program`, `Batch`, `Course`, `Topic`, `Assignment`, `Submission`, `Grade`, …), `UUID`/`ISODateString` aliases, shared `Timestamps`.
- `api.ts` — transport types: `Paginated<T>`, `ListParams`, the error envelope, `SignedUrl` (GCS uploads).
- `index.ts` — barrel; import from `@/types`.

Domain hierarchy (context for modeling): **Program → Term → Course → Topic**; curriculum is shared per program with **per-batch** instances (enrollments, announcements, assignment instances, submissions, grades). Courses are core/elective with an elective-request approval flow. See `mesa-lms-decisions` memory + `schema.sql`.

---

## 7. Auth & access control

- **Firebase Auth** (email+password). `lib/auth/firebase.ts` initialises the app/auth from `env`. `lib/auth/auth-context.tsx` exposes current user, ID token, sign-in/out; bridged into React via `providers/auth-provider.tsx`. Read it with `@/hooks/use-auth` (`useAuth()`).
- The API client attaches the **ID token**; the backend verifies it and reads **role from custom claims**. Postgres `users.firebase_uid` mirrors the Firebase user.
- **`src/proxy.ts`** (Next 16's renamed middleware) does the optimistic gate: redirect unauthenticated users to `/login`, route by role (admin → `/admin`, student → `/student`). It's optimistic only — real authorization is server-side.
- **`components/shared/role-guard.tsx`** guards client subtrees that need a specific role.
- Roles are exactly **`admin`** and `student` (`UserRole`). The login flow (`features/auth`) signs in, then redirects by claim.

---

## 8. Config, providers, routing

- **`lib/config/env.ts`** — Zod-validated env. Reference each `NEXT_PUBLIC_*` as a literal (Next inlines them). Add new public vars here + to `.env.example`/`.env.local`. Warns in dev, hard-fails a prod build if invalid.
- **`lib/config/site.ts`** (metadata) · **`lib/constants.ts`** (route paths, page sizes, query defaults) — centralize magic values here.
- **`providers/index.tsx`** composes the client tree: `ThemeProvider` → `QueryProvider` → `TooltipProvider` → children + `Toaster` (+ `AuthProvider` once wired). Root `app/layout.tsx` wraps everything in `<Providers>`; `app/providers.tsx` re-exports it.
- **Routing:** route groups `(auth)` (no shell) and `(app)` (role shells). Pages export `metadata = { title }` → templated to `"… · Mesa LMS"`. Keep pages thin; layouts own the chrome (see `dashboard` skill).

---

## 9. Adding a new feature — recipe

1. **Model first.** Add/confirm the entity in `types/models.ts` and any enum in `types/enums.ts` (mirror `schema.sql`).
2. **Scaffold the slice** `features/<feature>/` with `services/`, `hooks/`, `schemas.ts`, `types.ts`, `index.ts`, `components/` — mirror an existing slice.
3. **Service** — async functions on `api` returning typed models. No React.
4. **Query keys** — add a block to `lib/api/query-keys.ts`.
5. **Hooks** — `useQuery`/`useMutation` over the service; invalidate on mutate.
6. **Schemas** — Zod for create/update; infer form types.
7. **Barrel** — re-export the public hooks/components from `index.ts`.
8. **Page** — under `(app)/admin` or `(app)/student`; compose the hooks + shared/`dashboard` components. Thin.
9. **Loading/empty/error** — `shared/loading`, `shared/empty-state`, toasts.

---

## 10. Conventions & guardrails

### Do

- Import via `@/…` and through feature **barrels**; keep services React-free and pages thin.
- Route all server state through **TanStack Query hooks**; keys from the factory; invalidate on mutation.
- Validate input with **Zod**; type everything from `@/types` (enums as unions).
- Centralize env in `env.ts`, constants in `constants.ts`, keys in `query-keys.ts`.
- Keep `types/*` and `schema.sql` in lockstep.
- Default to **Server Components**; add `"use client"` only for interactivity/hooks (query hooks, forms, context).

### Don't

- Call `fetch`/services directly from components, or inline query-key strings.
- Reach into a feature's internal files from outside its barrel.
- Put business/fetching logic in `app/` pages or in `components/ui/*`.
- Add axios or a second data-fetching path; hardcode the API base URL or secrets.
- Retype enum literals or duplicate model shapes locally when a global type exists.
- Hand-edit `components/ui/*` (vendored shadcn) — wrap in `shared/` instead.

If a change doesn't fit these patterns, stop and reconcile with this skill (and the `dashboard` skill for UI) rather than inventing a parallel structure.
