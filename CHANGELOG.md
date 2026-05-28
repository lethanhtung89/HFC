# Changelog
## [5.4.0] – 2026-02-17

### 🚀 Performance: Dashboard rendering optimization
- **Staggered chart drawing**: Charts now render one-per-animation-frame instead of all 5 at once.
  Each chart gets its own `requestAnimationFrame` call, yielding to the browser between draws.
  This eliminates the ~200-400ms main thread block that caused visible lag.
- **Fast initial animations**: Chart.js animation duration reduced from 1000ms (default) to 200ms.
  Charts appear almost instantly while keeping a subtle draw-in effect.
- **Update mode 'none'**: When chart data updates, `chart.update('none')` skips animation entirely
  for instant data refresh.
- **content-visibility: auto** on below-fold chart sections (Top 10 enterprises, Stacked chart).
  Browser skips rendering these sections until the user scrolls to them, saving ~150ms of layout.
- **KpiCard memoized**: `React.memo()` wrapper prevents 6 KPI cards from re-rendering when
  parent state changes (e.g. sidebar interactions).
- **Removed scheduleIdle(1200ms) delay**: Charts no longer wait for idle callback.
  They draw immediately after React commit via `requestAnimationFrame`.
- **Page transition animation**: Added 150ms CSS `fadeIn` animation when switching pages.
  Gives visual feedback that navigation happened instead of abrupt content swap.

### Files Changed
| File | Change |
|---|---|
| `src/features/dashboard/DashboardPage.tsx` | Full rewrite: staggered charts, memoized KPI, content-visibility |
| `src/App.tsx` | Page transition CSS, fade-in animation |
| `package.json` | Version 5.4.0 |

## [5.3.7] – 2026-02-17

### 🐛 Critical: Navigation still broken — leftover startTransition in 2 places
- v5.3.6 missed `startTransition` in `handleYearGo` and `handleSidebarSelectCompany`.
- ALL `startTransition` now removed from App.tsx (zero remaining calls).
- `navigateTo` uses `requestAnimationFrame` for visual smoothness without error swallowing.
- `setCurrentPageTransition`, `setSelectedCompanyIdTransition`, popstate handler, year
  selection, sidebar company select — all direct state updates now.
- ErrorBoundary (`PageErrorBoundary`) kept as safety net for render errors.

## [5.3.6] – 2026-02-16

### 🐛 Double-click company name not opening detail page
- `CompaniesPage` had leftover `startTransition` wrapping the double-click handler → silently reverted.
- Cleaned up in this release (no more `startTransition` in CompaniesPage).

### 🚀 Restored smooth navigation with ErrorBoundary safety net
- **Problem in v5.3.5**: Removing `startTransition` fixed navigation but made page switches
  synchronous → laggy/janky on large pages (1.6MB bundle, heavy DOM).
- **Fix**: Restored `startTransition()` for all navigation + added `PageErrorBoundary` component.
  - `startTransition` → React keeps showing current page while preparing new one (no lag)
  - `PageErrorBoundary` → catches render errors that `startTransition` would silently swallow
  - If a page throws during render → shows Vietnamese error message + "Thử lại" button
  - `key={currentPage}` on ErrorBoundary resets error state when navigating away

### Files Changed
| File | Change |
|---|---|
| `src/App.tsx` | Add `PageErrorBoundary`, restore `startTransition`, fix popstate duplicate |

## [5.3.6] – 2026-02-16

### 🐛 Double-click tên doanh nghiệp không mở company detail
- **Root cause**: 3 chỗ trong `CompaniesPage.tsx` vẫn còn `startTransition()` bọc navigation.
  Lý do giống v5.3.5: React revert state khi CompanyDetailPage throw.
- **Fix**: Xóa `startTransition()` khỏi tất cả onClick/onDoubleClick trong CompaniesPage.

### 🔧 Timer "AppMainMount" doesn't exist — warning eliminated
- Thay `console.time/timeEnd` bằng `performance.mark/measure` API.
  Không còn warning trong console.

### Files Changed
| File | Change |
|---|---|
| `src/features/companies/CompaniesPage.tsx` | Xóa 3x `startTransition`, xóa import |
| `src/App.tsx` | Timer: performance.mark thay console.time |

## [5.3.5] – 2026-02-16

### 🐛 Critical: Menu navigation completely broken — clicking sidebar items does nothing
- **Root cause**: `startTransition()` wrapping all `setCurrentPage()` and `setSelectedCompanyId()`
  calls. React 18's `startTransition` silently **reverts** state updates if the resulting render
  throws ANY error. Since page components (CompaniesPage, AnalysisPage, etc.) have minor render
  issues, React aborts every navigation transition and keeps showing Dashboard.
  No error appears in console — React swallows it as a "failed transition".
- **Fix**: Removed ALL `startTransition()` wrappers from navigation, year selection, and company
  selection. State updates are now synchronous — if a page component throws, the error surfaces
  visibly in console and `__HFC_FATAL` handler instead of being silently swallowed.
- **Affected locations** (all in `src/App.tsx`):
  - `navigateTo` — main navigation
  - `setCurrentPageTransition` — page switches from child components
  - `setSelectedCompanyIdTransition` — company selection
  - `handleYearGo` — year switching
  - `handleSidebarSelectCompany` — sidebar company click
  - `onPopState` — browser back/forward

### Carried from v5.3.4
- Direct imports replacing lazy() + Suspense (fixes "Đang tải trang..." stuck)
- Error handler ignoring resource load errors (fixes Cloudflare beacon crash)
- Preload crossorigin consistency
- Boot timeout (12s)

## [5.3.4] – 2026-02-15

### 🐛 Critical: "Đang tải trang..." stuck forever on both LAN and domain
- **Root cause**: `lazy()` + `<Suspense>` wrapping all page components.
  With `inlineDynamicImports: true`, Rollup inlines all modules into one bundle,
  making `lazy()` pointless — it wraps synchronous modules in `Promise.resolve()`.
  If ANY page component throws during initialization or render, the Promise rejects
  silently inside Suspense. Without an `ErrorBoundary`, React keeps showing the
  Suspense fallback ("Đang tải trang...") forever with **no error in console**.
- **Fix**: Replaced all 7 `lazy()` imports with direct `import` statements.
  Removed `<Suspense>` wrapper. Pages now render synchronously — any error
  surfaces immediately in console and `__HFC_FATAL` handler instead of being silently swallowed.
- **Why this works**: Since `inlineDynamicImports: true` bundles everything in one file,
  `lazy()` provides zero code-splitting benefit. Direct imports are faster (no microtask delay)
  and errors are visible.

### 🐛 Cloudflare beacon error handler (from v5.3.3)
- Error listener ignores resource load failures (`if (!e.error) return`)
- Noise filter includes `cloudflareinsights`, `beacon.min.js`, `Script error`

### 🐛 Preload crossorigin consistency (from v5.3.2)
- `<link rel="modulepreload">` and `<link rel="preload">` now include `crossorigin`

### 🐛 Boot timeout (from v5.3.2)
- 12s AbortController timeout on `serverLoadStateFull()`

### Files Changed
| File | Change |
|---|---|
| `src/App.tsx` | Replace lazy→direct imports, remove Suspense, boot timeout, timer fix |
| `src/main.tsx` | Error handler: ignore resource errors, noise filter |
| `vite.config.ts` | Preload hints crossorigin |
| `src/services/persistence/index.ts` | AbortSignal parameter |

## [5.3.3] – 2026-02-15

### 🐛 Critical: Cloudflare beacon CORS error killing React app on domain access
- **Root cause**: `window.addEventListener('error', ...)` in `main.tsx` captured ALL errors
  including resource load failures (e.g. Cloudflare-injected `beacon.min.js` CORS rejection).
  When `e.error` is `undefined` (resource errors), the handler called `__HFC_FATAL(e.message)`
  which replaced `#root.innerHTML` with an error overlay — **destroying the running React app**.
  On LAN (192.168.100.4:7000) Cloudflare doesn't inject beacon → works fine.
  On domain (hfc.tlserver.pro.vn) Cloudflare injects beacon → CORS fail → app killed.
- **Fix**: Error listener now checks `if (!e.error) return` — ignores resource load errors,
  only handles actual JavaScript runtime errors (`e.error` is an `Error` object).
- **Fix**: Added `cloudflareinsights`, `beacon.min.js`, `Script error` to noise filter.

### 🐛 Preload credential mismatch (carried from v5.3.2)
- Preload hints now include `crossorigin` attribute matching Vite's script/stylesheet tags.
- Eliminates CSS/JS double-fetch through Cloudflare Tunnel.

### 🐛 Boot timeout (carried from v5.3.2)
- 12s AbortController timeout on `serverLoadStateFull()` prevents infinite hang.

### Files Changed
| File | Change |
|---|---|
| `src/main.tsx` | Error listener: ignore resource errors; noise filter update |
| `vite.config.ts` | Preload hints: crossorigin consistency |
| `src/App.tsx` | Boot timeout (12s), timer try-catch |
| `src/services/persistence/index.ts` | Accept AbortSignal |
| `dist/index.html` | Preload crossorigin fix (immediate deploy) |

## [5.3.2] – 2026-02-15

### 🐛 Critical: Preload credential mismatch causing double-fetch (slow tunnel load)
- **Root cause**: `preloadHintsPlugin` injected `<link rel="preload">` and `<link rel="modulepreload">`
  WITHOUT `crossorigin` attribute, but Vite's `<script type="module" crossorigin>` and
  `<link rel="stylesheet" crossorigin>` HAVE `crossorigin`. Browser sees credential-mode mismatch
  → discards preloaded resources → re-fetches them from scratch. Through Cloudflare Tunnel this
  adds 300-800ms per resource (CSS + JS double-fetched).
- **Fix**: Added `crossorigin` to both preload hints in `vite.config.ts::preloadHintsPlugin()`
- **Fix**: Manually patched `dist/index.html` for immediate deploy without rebuild

### 🐛 Boot timeout: prevent infinite "Đang tải trang..." hang
- **Root cause**: `ServerBootGate::loadFromServer()` calls `serverLoadStateFull()` with no timeout.
  If Cloudflare Tunnel stalls or state-api is slow, the Promise never resolves → UI frozen forever.
- **Fix**: Added 12s `AbortController` timeout to `loadFromServer()`
- **Fix**: `serverLoadStateFull()` now accepts optional `AbortSignal` parameter
- On timeout → error screen with "Thử lại" button (instead of infinite spinner)

### 🔧 Minor: Timer warning cleanup
- Wrapped `console.timeEnd('AppMainMount')` in try-catch to suppress "Timer does not exist" warning

### Files Changed
| File | Change |
|---|---|
| `vite.config.ts` | Preload hints: add `crossorigin` attribute |
| `dist/index.html` | Fix crossorigin on preload hints (immediate deploy) |
| `src/App.tsx` | Boot timeout (12s), timer try-catch |
| `src/services/persistence/index.ts` | Accept AbortSignal |
| `build.sh` | Verify preload crossorigin consistency |

## [5.3.1] – 2026-02-12

### 🐛 Critical Bug Fix
- **TDZ crash fixed**: `fmtView` was referenced in `PLHNTable` (lines 1316, 1325) but never defined
  in `QuotaProposalPage.tsx`. This caused `ReferenceError: Cannot access 'pe' before initialization`
  at app startup because `inlineDynamicImports: true` merges all modules into one bundle.
  - Root cause: `fmtView` was renamed to `hcfcFmtView` (line 224) without updating the 2 PLHNTable references
  - Fix: Added `const fmtView = useCallback((value) => fmtNum(value, 2), [])` after line 225

### 🚀 Production Deployment Optimization (Cloudflare Tunnel)
- **nginx.conf**: Added gzip compression (level 5), upstream keepalive, X-XSS-Protection header,
  font/image caching (30d), Connection="" for keepalive reuse on all proxy locations
- **Dockerfile**: Multi-stage build option (node:18-alpine builder → nginx:1.25-alpine), healthcheck
- **docker-compose.yml**: Healthcheck for web, NODE_ENV=production for state-api
- **vite.config.ts**: Added `base: '/'`, `target: 'es2018'`, `/auth` dev proxy

### Files Modified
| File | Change |
|---|---|
| `src/features/quota/QuotaProposalPage.tsx` | Add missing `fmtView` callback |
| `nginx.conf` | Gzip, keepalive, security headers, font caching |
| `Dockerfile` | Multi-stage build with healthcheck |
| `docker-compose.yml` | Healthcheck, NODE_ENV |
| `vite.config.ts` | base, target, auth proxy |


## [5.3.0] - 2026-02-12

### FIX & UX: Startup Stability & Viewport Refactor

- **Startup Crash Fix (TDZ)**: Khắc phục triệt để lỗi `ReferenceError: Cannot access before initialization` (lỗi TDZ) tại trang Đề xuất hạn ngạch. Đã tái cấu trúc toàn bộ thứ tự khai báo State → Derived Data → Effects để đảm bảo tính nhất quán khi build production.
- **Viewport Scroll Refactor**: Thay đổi cơ chế hiển thị từ phân trang sang **cuộn trong vùng nhìn (Scrollable Viewport)** với chiều cao tối đa 720px (~15-18 doanh nghiệp). Giúp người dùng vừa có thể cuộn dọc xem danh sách, vừa nhìn thấy tiêu đề bảng (Sticky Header).
- **Secondary Scroll Removal**: Loại bỏ thanh cuộn ngang phụ ở phía trên đầu bảng theo yêu cầu để giao diện gọn gàng hơn, tập trung vào thanh cuộn ngang tiêu chuẩn ở dưới.
- **Internal Optimization**: Tách các hàm helper định dạng số sang component dùng chung và tối ưu hóa việc hoist các component phụ để cải thiện hiệu năng render.
- **Clean Build Protocol**: Áp dụng quy trình build sạch (Remove dist → Rebuild) để đảm bảo không còn tàn dư của các bản build lỗi trước đó.


## [5.2.0] - 2026-02-12

### FEATURE: Enhanced Table UX (Top Scrollbar)

- **Top Horizontal Scrollbar**: Triển khai thanh cuộn ngang ảo ở phía trên bảng tại Tab HFC (Đề xuất hạn ngạch). Người dùng có thể kéo ngang ngay từ những dòng đầu tiên mà không cần cuộn xuống cuối trang.
- **Scroll Synchronization**: Đồng bộ hóa mượt mà giữa thanh cuộn trên và vùng nội dung bảng bằng `requestAnimationFrame`.
- **Responsive Width**: Tự động cập nhật độ rộng thanh cuộn khi thay đổi số lượng môi chất hoặc ẩn/hiện cột.
- **Merge Cells (HCFC)**: Gộp ô tiêu đề dọc (rowSpan) và cập nhật nhãn "Tổng Nhập Khẩu" cho tab HCFC giúp giao diện chuyên nghiệp hơn.

## [5.1.1] - 2026-02-12

### FIX: App Boot Circular Dependency

- **Fix Production Crash (TDZ)**: Sửa lỗi `Cannot access 'K' before initialization` do Rollup sắp xếp sai thứ tự biến khi build production. Đã chuyển hook `useB21QuotaSync` xuống sau khi khởi tạo state `selectedYear`.
- **Dynamic Import**: Chuyển `QuotaEngine` và `Logging` sang import động để tối ưu loading time và tránh circular dependency tiềm ẩn.
- Khắc phục lỗi "JavaScript error on startup" khi loading ứng dụng.

## [5.1.0] - 2026-02-12

### FEATURE: Continuous Reactive Sync (B21 → Quota Proposal)

- **Lifted reactive sync logic to App level**: Nâng cấp cơ chế đồng bộ tự động từ trang `QuotaProposalPage` lên cấp `App` thông qua custom hook `useB21QuotaSync`.
- **Luôn hoạt động (Always-on)**: Dữ liệu "Đăng ký năm sau" tại Bảng 2.1 (trong `CompanyDetailPage`) giờ đây sẽ tự động đồng bộ sang Tab HFC (ĐX tCO2) và HCFC (ĐX kg) ngay lập tức, bất kể người dùng đang ở trang nào.
- **Không cần tạo lại báo cáo**: Loại bỏ bước thủ công "Tạo lại từ báo cáo" khi có sự thay đổi nhỏ về số lượng đăng ký tại Bảng 2.1.
- Tự động tính toán lại tổng (Totals) và ODP sau mỗi lần đồng bộ để đảm bảo tính nhất quán dữ liệu.

## [5.0.2] - 2026-02-12

### VERSION: Maintenance & Synchronization

- Đồng bộ hóa phiên bản hệ thống lên 5.0.2.
- Kiểm tra và đảm bảo tính nhất quán của APP_VERSION trong mã nguồn.

## [5.0.1] - 2026-02-12

### FIX: Bảng 2.1 reactive compute + auto-sync Quota theo substanceCode

- Cột `Đăng ký năm sau (tCO₂tđ)` ở Bảng 2.1 được ép là computed field (read-only), tính trực tiếp từ:
  - `Đăng ký năm sau (kg) × GWP` (không nhân GWP lần 2).
- Hook compute ngay tại commit handler của ô `dang_ky_nam_sau_kg`:
  - cập nhật local state tức thời (không chờ save server),
  - đồng bộ trường `dang_ky_nam_sau_tco2` và `dang_ky_nam_sau_tco2td`.
- Ưu tiên map theo `substanceCode/substance_code` nếu có; chỉ fallback theo tên khi thiếu code.
- Khi thiếu GWP: set `tCO2td = null` và ghi log `B21_GWP_MISSING` với `{ substanceCode, companyId, reportYear }`.
- Thêm auto-sync B21 → Quota ngay từ `CompanyDetailPage` (không cần mở tab Quota):
  - HFC: patch `proposedTCO2` (và `proposedKg`) theo `(proposalYear, companyId, substanceCode)`.
  - HCFC: patch `registeredKg/importKg` theo `(proposalYear, companyId, substanceCode)` và recompute ODP/tổng qua pipeline sẵn có.
- Debounce sync 300ms để tránh patch dồn dập khi thao tác nhanh.
- Chống ghi đè user override: chỉ patch substance có `source !== 'USER'`.

## [5.0.0] - 2026-02-12

### PERFORMANCE: Eliminate Input Lag & Reduce Re-renders

**Major version bump** — architectural changes to state management, rendering, and persistence.

---

#### Phase 1: Per-Keystroke Parent Re-render (CRITICAL FIX)

**Problem:** `InlineEditable` was defined as a **closure inside CompanyDetailPage** (4795 lines).
- `inlineEditDraft` state lived in the parent component
- Every keystroke → `setInlineEditDraft` → **full 4795-line component re-renders**

**Fix:** Extracted `InlineEditable` to `src/components/shared/InlineEditable.tsx`
- Each cell manages its own `isEditing` + `draft` state locally
- Custom `React.memo` comparison: ignores callback props, checks only `value`/`path`/`readOnly`
- Stable `handleInlineCommit` callback using refs → memo never invalidated

---

#### Phase 2: Full-Table Re-render on Single Cell Edit (NEW)

**Problem:** All table rows in Bảng 2.1–2.4 were rendered inline in `renderReportOverview()` (~2300 lines).
When ANY cell committed → `updateCompany` → new `companies` state → new `selectedCompany` →
CompanyDetailPage re-renders → `renderReportOverview()` re-executes → **ALL rows re-render**.

**Fix:** Extracted memoized row components to `src/components/shared/TableRows.tsx`:
- `B21Row`, `B22Row`, `B23Row`, `B24Row` — each wrapped in `React.memo` with custom comparator
- Custom `rowDataEqual` comparator: checks only row data fields + `readOnly` + `idx`
- Ignores callback props (`onCommit`, `onDelete`) since they're accessed via refs in parent
- Stable parsers (`numParser`, `priceParser`) defined at module level, not inline per-render
- Self-contained `fmtN` formatting — no dependency on parent `fmtNum` closure

**Before:** Edit 1 cell in B21 → 30+ row components re-render (all 3 slugs × all rows)
**After:** Edit 1 cell in B21 → only 1 row component re-renders (**~97% reduction**)

---

#### Phase 2b: deepClone Elimination in B21 Auto-Match

**Problem:** `useEffect` for substance auto-matching used `deepClone(b21Current)` on every trigger.
For 20+ rows across 3 slugs, this created full recursive clones ~50ms each.

**Fix:** Replaced with shallow clone: `b21Current[k].map(r => ({ ...r }))`.
Only slug arrays are spread; rows get individual shallow copies (sufficient since fields are primitives).

---

#### Phase 2c: Persistence Optimization

- Increased debounce from 600ms → 800ms for better batching during rapid edits
- `JSON.stringify` now runs inside `requestIdleCallback` when available (yields to main thread)
- Flush-on-unload still uses synchronous path for data safety

---

#### Phase 2d: Stable No-Op Functions for Guest Mode

**Problem:** Guest mode props like `isGuest ? (() => {}) : updateCompany` created new arrow function
references on every render, defeating downstream `React.memo`.

**Fix:** Stable `_NOOP` and `_NOOP_NULL` callbacks via `useCallback([], [])` in App.tsx.

---

#### Phase 2e: QuotaProposalPage ColHeader Memoized

`ColHeader` wrapped with `React.memo` — static column headers no longer re-render on data changes.

---

### Files Modified

| File | Change | Lines |
|---|---|---|
| **NEW** `src/components/shared/InlineEditable.tsx` | Self-contained memo'd InlineEditable | +135 |
| **NEW** `src/components/shared/TableRows.tsx` | Memoized B21/B22/B23/B24 row components | +230 |
| `src/features/companies/CompanyDetailPage.tsx` | Use memoized rows, shallow clone B21, remove inline row JSX | -250/+20 |
| `src/features/quota/QuotaProposalPage.tsx` | Memo EditableCell/ColHeader, NoteCell, DebouncedInput notes | +30 |
| `src/App.tsx` | Debounced persistence (800ms + rIC), stable NOOP fns, useCallback | +40 |
| `src/services/persistence/index.ts` | Optimized persistSet equality check | +8 |
| `src/utils/constants.ts` | Version 5.0.0 | |
| `package.json` | Version 5.0.0 | |
| `CHANGELOG.md` | This entry | |

---

### Validation Checklist

- [ ] Type rapidly in Table 2.1 — no lag, no dropped characters
- [ ] Edit one cell → only that cell re-renders (check React DevTools Profiler)
- [ ] Reload page → all data persisted correctly
- [ ] Edit Quota note field → no lag during typing
- [ ] Close tab during edit → data is saved (beforeunload flush)
- [ ] No console errors
- [ ] All existing features work identically

## [4.27.0] - 2026-02-11

### FEATURE: Reactive Data Sync (B21 → Quota Proposal)

- Auto-sync khi chỉnh sửa cột "Đăng ký năm sau (kg/tCO₂tđ)" trong Bảng 2.1 → tự động cập nhật Quota Proposal (HFC/HCFC) mà không cần nhấn "Tạo lại từ báo cáo".
- Debounce 500ms để tránh re-sync quá nhiều lần khi user đang edit liên tục.
- Fingerprint-based change detection: chỉ sync khi B21 data thực sự thay đổi.

### LOGIC: Source Tracking & User Edit Protection

- Thêm field `source: 'B21' | 'USER' | 'SYSTEM'` vào `HFCSubstanceAllocation` và `HCFCSubstanceAllocation`.
- Khi user chỉnh sửa NK (kg) trực tiếp trong Quota → đánh dấu `source: 'USER'` → reactive sync sẽ **KHÔNG** ghi đè.
- `buildInitialHFCProposal` / `buildInitialHCFCProposal` set `source: 'B21'` cho dữ liệu gốc.

### ENGINE: Incremental Patch Function

- Thêm `buildIncrementalPatchFromB21()` trong quotaEngine: so sánh B21 data mới vs existing quota → tạo patch chỉ cho fields có thay đổi + source='B21'.

### Files Modified
- `src/services/quotaEngine/index.ts` — source field, buildIncrementalPatchFromB21
- `src/features/quota/QuotaProposalPage.tsx` — reactive sync useEffect, source: USER marking

---

## [4.26.0] - 2026-02-11

### FEATURE: Editable "NK (kg)" for HFC/HCFC Quota Proposals

- Implemented inline editing for "NK (kg)" columns in both HFC and HCFC tabs.
- Manual edits are persistent and saved to local storage immediately.
- Quota engine automatically recomputes tCO2 (HFC) and tODP (HCFC) values upon edit.

### LOGIC: Full Matrix Enforcement (HFC)

- HFC table now automatically populates all 31 template substances (for 2026) for every company.
- Users can now enter quota data for substances that were not originally in the company's B21 report.

### UI REFACTOR: HCFC table single-row layout

- Refactored the HCFC table to use a compact single-row design per company (instead of split rows).
- Dynamically resolve substance ODP metadata for header columns (fixes HCFC-123 display bug).
- Missing substances in HCFC rows are rendered as editable cells (initialized to 0) allowing ad-hoc additions.

### Files Modified
| File | Changes |
|---|---|
| `src/features/quota/QuotaProposalPage.tsx` | Refactored HCFC table to single-row; integrated `EditableCell` for HFC/HCFC; added auto-creation logic for missing substances |
| `src/services/quotaEngine/index.ts` | Refactored `normalizeHFCSubstancesForProposalYear` to enforce Full Matrix with zero-filled entries |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.25.0] - 2026-02-10

### UI REFACTOR: HCFC table layout in Quota Proposal (header/merge/alignment consistency)

- Updated HCFC tab table headers to required two-line format:
  - `Tổng Nhập Khẩu` + `(tODP)`
  - `Tổng Nhập Khẩu` + `(kg)`
  - Subcolumn `NK` + `(ODP)` (replacing old `ODP` label)
- Kept all table headers center-aligned for consistent Mantis look.
- Implemented vertical merged cells (`rowSpan`) per enterprise for columns:
  - `TT`
  - `Tên Công ty`
  - `Tổng Nhập Khẩu (tODP)`
  - `Tổng Nhập Khẩu (kg)`
  - `Ghi chú`
- Adjusted cell alignment:
  - Non-right columns preserved: `TT`, `Tên Công ty`, `Ghi chú`
  - All remaining metric/detail columns right-aligned (`ĐK`, `NK (kg)`, `NK (ODP)` for every HCFC substance).
- Ensured HCFC substance columns are fully rendered for all detected substances (no default hiding behavior).
- Added fixed 2-decimal formatting for `Tổng Nhập Khẩu (tODP)` in both data rows and footer totals, independent of global decimal setting.
- No data logic or formula changes.

### Files Modified
| File | Changes |
|---|---|
| `src/features/quota/QuotaProposalPage.tsx` | HCFC table header text/layout refactor, rowSpan merge rendering, alignment updates, fixed 2-decimal tODP formatter |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.24.0] - 2026-02-10

### UI FIX: Table 2.1–2.4 consistency (text style + non-sticky TT)

- Standardized text rendering for column `Đăng ký năm sau (tCO₂tđ)` in Table 2.1:
  - Removed italic style and custom font-size override.
  - Kept computed/read-only behavior and existing tooltip logic intact.
  - Text now follows the same font family/size/style as other data columns.
- Removed fixed/sticky behavior for `TT` column in report overview tables:
  - Deleted sticky/fixed CSS rules for first column in Table 2.1.
  - `TT` now scrolls horizontally with the rest of the table content (same behavior expectation for Table 2.1–2.4).
  - No change to indexing/sort/data logic.

### Files Modified
| File | Changes |
|---|---|
| `src/features/companies/CompanyDetailPage.tsx` | Normalized `Đăng ký năm sau (tCO₂tđ)` cell text style; removed legacy sticky-offset style variable from Table 2.1 markup |
| `src/assets/css/styles.css` | Removed sticky/fixed/shadow rules for `TT` first column in report overview table styles |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.23.0] - 2026-02-10

### UI: Keep Dashboard and Năm Báo Cáo submenus always visible

- Updated sidebar behavior for `Dashboard` and `Năm Báo Cáo`:
  - Removed expand/collapse chevron icons for both parent items.
  - Removed collapse-toggle behavior so users can no longer collapse these two sections.
  - Child menus for both sections are now always rendered and visible when sidebar is expanded.
- Preserved existing Mantis spacing/style and kept collapse behavior available for other parent items.

### Files Modified
| File | Changes |
|---|---|
| `src/components/layout/MainLayout.tsx` | Removed toggle/chevron logic for `Dashboard` and `Năm Báo Cáo`; forced always-open rendering of child menus |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.22.0] - 2026-02-10

### FIX: Substance Catalog edit stability + live catalog sync to Quota/lookup

- Fixed `Ten goi khac` edit prefill and save behavior:
  - Edit form now always preloads existing aliases.
  - Aliases support robust parse/serialize (`;`, newline, comma) without wiping old values while typing.
  - Save flow merges edited fields into existing record (no accidental loss of non-form fields).
- Removed typing lag during edit:
  - Refactored catalog UI into separate list table + modal edit form.
  - Edit draft state is now local to modal (no full table rerender on each keypress).
  - Search list filtering uses deferred state to keep input responsive.
- Added profiling markers for edit lifecycle:
  - `SUBSTANCE_EDIT_OPEN`
  - `SUBSTANCE_EDIT_CHANGE` (throttled sampling)
  - `SUBSTANCE_SAVE_START` / `SUBSTANCE_SAVE_DONE` / `SUBSTANCE_SAVE_FAIL`
- Unified runtime catalog as single source of truth across app:
  - Added catalog runtime apply/sync helpers in constants layer.
  - Added catalog version + update event to invalidate consumers when catalog changes.
  - Server boot now re-syncs custom catalog from persisted state into runtime registry.
- Quota normalization dropdown now reflects user-added substances immediately:
  - Quota page subscribes to catalog update event and rebuilds catalog items on version change.
  - No page reload required; refresh persistence remains compatible.
- AI substance lookup indexes are now catalog-version aware:
  - Alias/HS indexes rebuild lazily when catalog version changes, ensuring GWP/ODP lookups see latest custom entries.

### Files Modified
| File | Changes |
|---|---|
| `src/features/settings/SettingsPage.tsx` | Modal-based edit refactor, aliases prefill/save fix, perf improvements, edit markers, live catalog persistence wiring |
| `src/utils/constants.ts` | Catalog runtime apply/sync utilities, aliases normalization, catalog version/event, app version bump |
| `src/features/quota/QuotaProposalPage.tsx` | Runtime catalog version listener + refresh for normalization dropdown |
| `src/services/ai/index.ts` | Catalog-version-aware alias/HS index rebuild for lookup consistency |
| `src/App.tsx` | Sync runtime catalog after server state bootstrap |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.21.0] - 2026-02-10

### UI REFACTOR: Quota Proposal header/actions/tabs (Mantis-consistent)

- Redesigned Quota Proposal top layout to improve visual hierarchy and focus:
  - Title emphasized: `Đề xuất hạn ngạch năm YYYY`
  - Compact subtitle: `Dựa trên Báo cáo năm YYYY`
  - Removed verbose header line about Bảng 2.1/Excel dependency
- Consolidated scattered actions into one primary action button (`Thao tác`) at header right:
  - `Tạo lại từ báo cáo`
  - `Export XLSX`
  - `Cột hiển thị`
  - `Decimal places`
- Moved and restyled tabs directly below title area (clearer active state, stronger hierarchy):
  - `HFC (YYYY)`
  - `HCFC (YYYY)`
  - `Phụ lục QĐ (YYYY)`
- Removed search box (`Tìm theo Tên DN / MST`) from Quota Proposal UI.
- Kept business logic/data flow unchanged: generation/export/column visibility/decimal settings retain original behavior.

### Files Modified
| File | Changes |
|---|---|
| `src/features/quota/QuotaProposalPage.tsx` | Header layout refactor, primary action menu, tab reposition/restyle, removed search UI |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |
## [4.20.0] - 2026-02-10

### LOCK: HFC(2026) fixed allowlist columns (31) + strict dedup + no auto column creation

- Added central template config:
  - `HFC_TEMPLATE_BY_PROPOSAL_YEAR[2026]` (31 substances, fixed order)
  - `getHFCSubstanceTemplate(proposalYear)` / `isHFCSubstanceTemplateLocked(proposalYear)`
- Enforced data-layer lock for HFC proposal year 2026:
  - HFC dataset generation only keeps substances mapped to the 2026 allowlist template
  - Substances from Bảng 2.1 outside template are ignored (no new columns created)
  - Added internal debug log for ignored rows: `HFC_2026_SUBSTANCE_IGNORED_FROM_B21`
- Enforced dedup 100%:
  - Dedup by canonical display identity (code-priority), with fallback normalized label matching
  - Dedup resistant to casing/spacing variations via normalized token matching
  - Duplicate entries are merged into one allocation per template column
- Enforced UI lock for HFC(2026):
  - HFC columns are now derived from template for proposal year 2026 (exactly 31 columns, fixed order)
  - No extra columns from catalog/B21 data
  - Column rename/normalize UI action is disabled when HFC template is locked
  - Existing persisted datasets are auto-sanitized on load/update for locked year
- HCFC and PLHN tabs remain unchanged.

### Files Modified
| File | Changes |
|---|---|
| `src/features/quota/config.ts` | Added `HFC_TEMPLATE_BY_PROPOSAL_YEAR` + helper getters |
| `src/services/quotaEngine/index.ts` | Template-aware HFC locking, dedup, ignore-outside-template logging, unique-column generation by proposalYear |
| `src/features/quota/QuotaProposalPage.tsx` | Enforce/sanitize locked HFC rows in UI state updates, template-based unique columns, disable rename action when locked |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `package-lock.json` | Version bump |
| `CHANGELOG.md` | This entry |
## [4.19.0] - 2026-02-10

### REFACTOR: Sidebar "Năm Báo Cáo" thành container + tab con nghiệp vụ

- Tái cấu trúc menu sidebar:
  - `Năm Báo Cáo` chỉ còn vai trò chọn năm (không là màn nội dung độc lập)
  - Thêm 2 tab con chuẩn hóa dưới `Năm Báo Cáo`: `Danh sách Doanh nghiệp`, `Đề xuất Hạn ngạch`
  - Loại bỏ render trùng lặp `Đề xuất Hạn ngạch` ngoài cấu trúc con
- Chuẩn hóa icon theo hệ Mantis/MUI:
  - `Tổng Quan`: `GridViewOutlined`
  - `Phân Tích`: `InsightsOutlined`
  - `Danh sách Doanh nghiệp`: `BusinessOutlined`
  - `Đề xuất Hạn ngạch`: `RequestQuoteOutlined`
- Chuẩn hóa trạng thái active/expand cho menu 2 cấp (Dashboard + Năm Báo Cáo)
- Khi đổi `Năm Báo Cáo`, chỉ cập nhật `selectedYear` dùng chung toàn app, không ép điều hướng trang
- Bổ sung alias route hash cho nhóm `Năm Báo Cáo`:
  - `#report-year/companies` → `companies`
  - `#report-year/quota-proposal` → `quota-proposal`
  - Vẫn tương thích route key cũ để không phá luồng hiện có

### Files Modified
| File | Changes |
|---|---|
| `src/components/layout/MainLayout.tsx` | Refactor menu tree, child tabs, icon mapping, active/expand logic, year selector behavior |
| `src/App.tsx` | Add hash route alias mapping for report-year sub routes, keep backward compatibility, update year-change behavior |
| `src/utils/constants.ts` | Version bump |
| `package.json` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.18.0] - 2026-02-10

### PART 1: FIX Bảng 2.1–2.4 Treo UI + Mất Dữ Liệu

**Root Cause:** Every inline cell edit triggered a cascade of 3 expensive operations:
1. `ensureReportSchema()` → `deepClone(entire reportData)` on EVERY edit (App.tsx line 839)
2. `ensureReportOverviewRowIds()` → another `deepClone` + `updateCompany` if IDs missing (cascade)
3. B21 auto-match `useEffect` → yet another `deepClone` + `updateCompany` if substance names changed (cascade)

Each cascade cycle: ~3 deep clones + JSON.stringify of entire companies array → main thread blocked 200-500ms per edit → UI unresponsive → "Chưa lưu" shown but table frozen.

**Fixes:**
- **`updateCompany(id, updates, { skipNormalize: true })`** — New fast-path option skips `ensureReportSchema`/`deepClone` for inline edits where data is already valid (from `_shallowCloneAtPath`)
- **`_inlineEditCommitRef`** — Ref flag suppresses `normalizedOverview` cascade during inline edit flow
- **B21 auto-match debounced to 300ms** — Prevents blocking during rapid cell editing
- **`setReportDataAtPath` uses `_shallowCloneAtPath`** — Replaces expensive `deepClone` + `_setAtPath`

**Result:** Single cell edit now does 0 deep clones (was 3-6). UI stays responsive during editing.

### PART 2: FIX Danh Mục Môi Chất (Cài đặt)

**Bug 1: Aliases not saving**
- Root cause: Editing input updates `editingDraft.aliases` (array), but `commitEditSubstanceRow` reads stale `editingDraft.aliasesText` (string from beginEdit)
- Fix: `commitEditSubstanceRow` now reads from `draft2.aliases` array first, falls back to `draft2.aliasesText`

**Bug 2: "Xem thêm" hidden / must scroll**
- Root cause: `visibleSubCount` started at 10, "Xem thêm" button inside scrollable container
- Fix: Show all substances by default (`visibleSubCount = 9999`)

**Bug 3: "Thêm môi chất" button non-functional**
- Root cause: `disabled={!!editingSubCode}` + stale `editingSubCode` from abandoned edits → button permanently disabled
- Fix: Button now auto-cancels any stale edit before creating new substance. `disabled` removed.

### Files Modified
| File | Changes |
|---|---|
| `src/App.tsx` | `updateCompany` gains `opts.skipNormalize` fast path |
| `src/features/companies/CompanyDetailPage.tsx` | `commitInlineEdit` uses `skipNormalize`; `_inlineEditCommitRef` suppresses cascade; B21 auto-match debounced 300ms; `setReportDataAtPath` uses shallow clone |
| `src/features/settings/SettingsPage.tsx` | Fix aliases save (read `draft.aliases`); show all substances; fix Add button |
| `src/utils/constants.ts` | Version bump |
| `CHANGELOG.md` | This entry |

## [4.17.0] - 2026-02-10

### NEW: Table 2.1 — Cột "Đăng ký năm sau (tCO₂tđ)" (computed, read-only)
- Position: ngay sau cột "Đăng ký năm sau (kg)"
- Formula: `(dang_ky_nam_sau_kg × GWP) / 1000` (tCO₂e = tonnes CO₂ equivalent)
- GWP resolved from Substance Catalog (Settings) — NEVER hardcoded
- Auto-recomputes when: kg changes, substance identity changes, GWP changes
- Visual: italic gray text, red when GWP missing + tooltip "Chưa map GWP theo Danh mục"
- Persistence: derived-only (computed in useEffect, stored alongside other tCO2 fields)

### CHANGED: Quota Proposal now uses B21 tCO₂tđ directly (no double GWP)
- HFC proposal: `proposedTCO2` = `registeredTco2` from Table 2.1 (pre-computed)
- Fallback: if B21 tCO2 not available, compute `kg × GWP / 1000`
- HCFC: unchanged (still uses kg × ODP)
- Logging: `QUOTA_QUOTA_ROW_SET_DX` now includes `dxTco2Source: 'B21_PRECOMPUTED' | 'COMPUTED_KG_GWP'`

### FIX: 7 unmapped substances resolved
**Root cause:** Blend substances (R-407F, R-417A, R-438A) were cataloged as "R-XXX" but reports use "HFC-XXX" labels. The alias list didn't include "HFC-" prefixed variants.

**Substances fixed:**
| Input label | → Resolved to | Fix type |
|---|---|---|
| HFC-407F | R-407F (GWP 1825) | Added alias + prefix-swap fallback |
| HFC-417A | R-417A (GWP 2346) | Added alias + prefix-swap fallback |
| HFC-438 | R-438A (GWP 2265) | Added alias "HFC-438" |
| HFC-467a | R-467A (GWP 2028) | NEW substance added + alias |
| HCFC-410A | R-410A (GWP 2088) | Added alias (misnamed blend) |

**New R-467A entry:** `{ code: "R-467A", type: "Blend", hsCode: "3827.63.90", gwp: 2028 }`

**Prefix-swap fallback in resolveSubstanceIdentity:**
- Pass 4 added: if HFC-XXX doesn't match, try R-XXX
- If HCFC-XXX doesn't match AND isn't a real HCFC (22/123/141/142/225), try R-XXX
- Catches all future "HFC-NNN" → "R-NNN" mismatches automatically

**All blend substances now have HFC- aliases** in the catalog (R-404A → "HFC-404A", etc.)

### Remaining unmapped (data quality issues):
- "Loại khác (Gas lạnh HCFC-21...)" — generic description, cannot map 1:1
- User should correct in Table 2.1 or accept as unmapped

## [4.16.1] - 2026-02-10

### CRITICAL FIX: resolveRowYear returning 0 instead of null → all B21 rows dropped

**Root cause:** `resolveRowYear()` used `Number(null)` which returns `0`. Since b21 nhap_khau rows don't have year fields (`reportYear`, `year`, `nam_bao_cao`, etc.), `rawYear` resolved to `null`. `Number(null) = 0`, and `Number.isFinite(0) = true`, so function returned `0` instead of `null`. The filter `rowYear !== null && rowYear !== reportYear` then evaluated to `0 !== null && 0 !== 2025` → `true` → **all 285 rows from 56 companies dropped as "row_year_mismatch"**.

**Fix:** Added explicit null/undefined/empty check before Number conversion, and require `year > 0`.

```typescript
// Before (BROKEN):
const year = Number(rawYear);                              // Number(null) = 0
return Number.isFinite(year) ? Math.trunc(year) : null;   // returns 0!

// After (FIXED):
if (rawYear === null || rawYear === undefined || rawYear === '') return null;
const year = Number(rawYear);
return (Number.isFinite(year) && year > 0) ? Math.trunc(year) : null;
```

## [4.16.0] - 2026-02-10

### Deterministic Code-Based Mapping: Table 2.1 → Quota Proposal (HFC/HCFC)
### + Critical Fix: Đăng Ký Năm Sau (kg) extraction diagnostics & robustness

**Root cause investigation: "Không tìm thấy Đăng Ký Năm Sau"**
- Added `QUOTA_B21_FIRST_COMPANY_DIAGNOSTIC` log: dumps first company's actual row structure (keys, types, raw dkns value, parsed value).
- Added `QUOTA_B21_ROW_DKNS_NULL` log: per-row diagnostic when resolveNextYearKg returns null (shows raw values for all dkns key candidates).
- Enhanced `QUOTA_REBUILD_MISSING_NEXT_YEAR_KG` log: now includes `sampleDknsValues` showing actual `dang_ky_nam_sau_kg` value/type from first 3 rows + detected keys containing "dang"/"nam_sau".
- `resolveNextYearKg`: added broad pattern match fallback — searches any key containing "dangky"+"namsau" or "dang_ky"+"nam_sau" patterns.
- Row filter: explicitly separate `dkns === 0` (skip as "no registration") from `dkns === null` (field not found). Both skip the row but `dkns === 0` still counts as "resolved field" so company is not flagged as missing.

**Core pipeline: per-company B21 input map (code-based identity)**
- Every `Đăng Ký Năm Sau (kg)` value is now ALWAYS tied to the `Tên chất` from the SAME Table 2.1 row — never treated as standalone.
- Canonical identity resolution pipeline: exact code → normalized name → alias (Vietnamese diacritics-insensitive).
- Per-company input aggregation: `Map<substanceCode, { nextYearKg, rawLabels[], sourcesCount }>`.
- Duplicate code summation: if multiple B21 rows map to the same substanceCode, kg values are SUMMED with `QUOTA_B21_DUPLICATE_CODE_SUM` log.
- Unmapped substances tracked in `unmappedInputs[]` with `{ rawLabel, nextYearKg, rowRef }`.

**Quota row matching by substanceCode (not raw text)**
- Quota table rows keyed by substanceCode as primary identity.
- `buildInitialHFCProposal` and `buildInitialHCFCProposal` now log `QUOTA_QUOTA_ROW_SET_DX` for each substance with dxKg, gwp/odp, and computed dxTco2/dxOdp.
- ĐX (tCO2tđ) = `(dx_kg × GWP) / 1000` (tonnes CO2 equivalent) — consistent with existing app convention.
- ĐX (ODP) = `dx_kg × ODP` for HCFC (raw kgODP); tODP = kgODP / 1000.

**Structured logging (new events)**
- `QUOTA_B21_EXTRACT`: per-company summary (b21Rows, mapped, unmapped, mappedCodes, sumDxKgMapped).
- `QUOTA_B21_DUPLICATE_CODE_SUM`: when multiple rows share same code (companyId, code, summedKg, sourcesCount).
- `QUOTA_QUOTA_ROW_SET_DX`: per-substance-per-company (companyId, proposalYear, code, dxKg, dxTco2/dxOdp).
- `QUOTA_REBUILD_VALIDATION`: aggregate (totalMapped, totalUnmapped, hfcCompanies, hcfcCompanies).
- `QUOTA_VALIDATION_MISMATCH`: cross-check if sumDxTco2 != totalProposedTCO2.

**Validation guards during regenerate**
- Per-company: b21RowCount, mappedCount, unmappedCount, sumDxKgByMappedCodes.
- HFC cross-check: sumDxTco2 must equal SUM over substance rows (computed, not user-entered).
- If no mapped inputs: company treated as missing inputs (same behavior as before).
- Success message now shows mapped/unmapped counts.

**New exported types**
- `UnmappedInput`, `CompanyB21InputEntry`, `CompanyB21InputMap`.
- `ExtractRegistrationsResult.inputMaps` field for external access.

**Unit convention (documented)**
- tCO2tđ = kg × GWP / 1000 (tonnes CO2 equivalent) — matches Excel, used throughout.
- tODP = kg × ODP / 1000 (tonnes ODP).
- kgODP = kg × ODP (raw).

**Verification example**
- Table 2.1: HFC-134a, Đăng ký năm sau = 200 kg
- Catalog GWP for HFC-134a = 1430
- ĐX (tCO2tđ) = (200 × 1430) / 1000 = 286 tCO2tđ ✓

## [4.15.0] - 2026-02-10

### Bug Fixes: Quota Regenerate, Substance Rename Display, Table Edit Freeze

**Bug A – "Tạo lại từ báo cáo" failing with missing next-year kg data:**
- Mo rong `NEXT_YEAR_KG_KEYS` tu 9 → 17 keys: them tco2 variants, legacy aliases.
- Them fallback tco2→kg conversion trong `resolveNextYearKg`: neu chi co `dang_ky_nam_sau_tco2td` + GWP, tu dong chuyen doi nguoc ve kg.
- Mo rong `extractB21ImportRows` tu 3 → 6 fallback strategies: ho tro tat ca data format cu/moi (nhap_khau, rows, groups, nhom, flat array).
- Them `QUOTA_REBUILD_COMPANY_B21` debug log per company, cai thien error message voi diagnostic chi tiet (companiesCount, b21RowsCount, missingCompaniesCount).

**Bug B – Substance rename not updating display:**
- Viet lai `getHFCSubstanceLabel`: uu tien `substanceName` tu data rows truoc khi query catalog.
- Them badge "Chua map" voi tooltip cho cot chua normalize.
- Them `QUOTA_SUBSTANCE_NORMALIZED` info log voi full mapping details (old→new).
- Giu `rawSubstanceLabel` cho audit trail.

**Bug C – Table editing freeze and data loss (Tables 2.1–2.4):**
- Them `_shallowCloneAtPath` helper: structural sharing, chi clone objects tren duong mutation path.
- Viet lai `commitInlineEdit`: clear editing state TRUOC (UI responsive ngay), sau do moi chay heavy state update.
- Loai bo `deepClone(company)` toan bo – thay bang shallow clone chi reportData path.
- Them `TABLE_EDIT_COMMIT` debug log.

## [4.14.0] - 2026-02-09

### Quota Rebuild Resolver + Empty-Year Clear + Substance Normalize
- Fix root cause `khong tim thay du lieu dang ky nam sau`: bo extract B2.1 cho `Tao lai tu bao cao` nay ho tro nhieu schema (`nhap_khau`, `rows`, `groups`, `columns+rows`) va resolver duy nhat `resolveNextYearKg(...)`.
- Chuan hoa mapping cot `Dang Ky Nam Sau (kg)` theo bien the key/header: `dang_ky_nam_sau_kg`, label tieng Viet/co dau-khong dau, camelCase, va mapping qua headerMap (khong hardcode index).
- Bo sung guard/log chi tiet khi thieu input theo tung DN: `QUOTA_REBUILD_MISSING_NEXT_YEAR_KG`; dong thoi log chat chua map danh muc: `QUOTA_REBUILD_SUBSTANCE_UNMAPPED`, `QUOTA_SUBSTANCE_MAPPING_MISSING`.
- Khi nam bao cao khong co doanh nghiep: nut `Tao lai tu bao cao` se xoa dataset de xuat cua `proposalYear` hien tai, tra UI ve empty state, khong giu du lieu cu.
- Bo sung metadata dataset rebuild: `sourceReportYear`, `sourceCompaniesCount`, `missingCompaniesCount`, `rebuildRunId`, `rebuildSource`.
- Them tinh nang `Sua/chuan hoa ten moi chat` o tab HFC: mo dialog chon ma chat tu Danh muc moi chat, luu `substanceCode` chuan, cap nhat `substanceName`, recompute ngay cac cot tCO2 theo GWP tu danh muc.

## [4.13.0] - 2026-02-09

### Quota Rebuild Year-Scoping Hardening
- Khoa chat year-scoping cho nut `Tao lai tu bao cao`: chi rebuild tu danh sach doanh nghiep cua `reportYear` dang chon.
- Ep pipeline extract B2.1 theo context nam (`reportYear`, `proposalYear`, `runId`) va chi ghi dataset vao key nam de xuat tuong ung.
- Them hard guards khi rebuild: chan ghi sai khoa nam, xac thuc `proposalYear = sourceReportYear + 1`.
- Day du marker/log su kien theo yeu cau: `QUOTA_REBUILD_START`, `QUOTA_REBUILD_ROWS`, `QUOTA_REBUILD_DONE`, `QUOTA_REBUILD_DROP_ROW`.
- Bo sung metadata dataset sau rebuild: `sourceReportYear`, `sourceCompaniesCount`, `rebuildRunId`, `rebuildSource`.

## [4.12.0] - 2026-02-09

### Quota Proposal Column Controls + Header Merge
- Bo sung nut `Cot hien thi` cho bang De xuat han ngach (tab HFC), cho phep an/hien theo nhom cot:
  - `TT`, `Ten Cong ty`, `DK NK (tCO2)`, `HN cap (tCO2)`, `Tong HN (tCO2)`, `Tong HN (kg)`,
  - `DX (tCO2)`, `TT (tCO2)`, `TT (kg)`, `NK (kg)`, `NK (tCO2)` cho tat ca chat.
- Loai bo co che/nut an-hien theo tung chat HFC (khong can thiet).
- Header cac cot tong quan duoc chuyen sang dang merge cell center (`rowSpan=2`) de canh giua dung yeu cau.
- Chuan hoa font/noi dung dong du lieu doanh nghiep trong bang quota: cung size chu, bo monospace tai noi dung bang.

## [4.11.0] - 2026-02-09

### Quota Proposal Number Format (Decimal Places)
- Bo sung tuy chon `Decimal places` (0-6) tren module `De xuat han ngach`, tuong tu `Format Cells > Number` trong Excel.
- Ap dung dong bo so chu so thap phan cho tat ca so hien thi tai tab `HFC`, `HCFC` va `Phu luc QD`.
- Luu tuy chon vao persistence key `hfcs_quota_decimal_places` de giu lai sau khi refresh.
- Cap nhat parse o editable cell de chap nhan so thap phan (ho tro ca dau `,` va `.`).

## [4.10.0] - 2026-02-09

### Quota Proposal Ordering + Missing Catalog Marker
- Dong bo thu tu `TT` doanh nghiep trong `De xuat han ngach` theo dung danh sach doanh nghiep cua nam bao cao (uu tien `displayOrder`, fallback `order + 1`, tie-break theo ten).
- Co dinh thu tu hien thi chat HFC theo dung danh sach nghiep vu da chi dinh; khong con sap xep alphabet.
- Ho tro alias mapping de cot HFC van map dung du lieu khi ma chat duoi dang bien the (`R-404A`/`HFC-404A`, `R-245fa`/`HFC-245fa`, ...).
- Hien thi dau `!` tren chip/ten cot cho chat chua co trong Danh muc moi chat de bo sung sau.
- Dong bo thu tu nay cho ca UI, export XLSX va PLHN.

## [4.9.0] - 2026-02-09

### HFC Column Display Order
- Cap nhat thu tu hien thi cac chat HFC trong tab `HFC` theo dung danh sach uu tien nghiep vu.
- Bo sung map alias de giu dung thu tu ngay ca khi ma du lieu la bien the (vi du `HFC-404A`/`R-404A`).
- Cac chat khong nam trong danh sach uu tien duoc dua xuong sau va sap xep theo ten ma chat.

## [4.8.0] - 2026-02-09

### Quota Proposal Ordering Fix
- Dong bo thu tu `TT` doanh nghiep trong module `De xuat han ngach` theo dung logic cua man `Danh sach Doanh nghiep` trong nam bao cao.
- Su dung cung tieu chi sap xep: uu tien `displayOrder` theo nam, fallback `order + 1`, fallback cuoi `999999`, tie-break theo ten doanh nghiep goc.

## [4.7.0] - 2026-02-09

### Quota Proposal UX/Data Alignment
- Chuan hoa cot `MST` trong module de xuat han ngach: bo dau `.` khi hien thi.
- Dong bo thu tu `TT` doanh nghiep theo dung thu tu danh sach doanh nghiep cua nam bao cao (uu tien `displayOrder`).
- Tab `HCFC`: loai bo doanh nghiep khong co luong nhap khau HCFC.
- Tab `HFC`: cot editable `Cuc cap tong HN (tCO2td)` duoc giu cung co chu, chi doi mau de nhan dien nhanh.
- Tab `HFC`: toan bo gia tri cot `tCO2td` duoc lam tron so nguyen (khong hien thi thap phan).

## [4.6.0] - 2026-02-09

### Quota Proposal Native Business Tool
- Chuyen module `De xuat han ngach` sang kien truc native: khong con su dung Excel lam input van hanh.
- Trich du lieu dau vao tu `Bang 2.1` cua nam bao cao (Y), tu dong map sang nam de xuat (Y+1).
- Hien thuc day du cong thuc HFC/HCFC bang code, bo sung cot editable va cot computed (readonly).
- Tu dong sinh PLHN tu ket qua HFC + HCFC, moi dong co trace cong thuc theo doanh nghiep/moi chat.
- Bo sung bo loc/tim kiem/sort, virtualized rows, toggle show-hide cot, reset layout, export CSV/XLSX/PDF.
- Bo sung profiling markers: `extractFromB21`, `computeHFCProposal`, `computeHCFCProposal`, `buildPLHN`, `firstRenderQuotaView`.
- Sidebar hien thi nhan `De xuat han ngach <Y+1>` theo nam bao cao dang chon.
- Backup/Restore bo sung dataset `quotaProposalByYear` de khong mat du lieu han ngach native.

## [4.5.0] - 2026-02-09

### Quota Proposal Module (by Report Year)
- Thêm module mới `Đề xuất hạn ngạch` trong sidebar (dưới cụm `Năm Báo cáo`) và route `quota-proposal`.
- Bổ sung trang hiển thị 3 tab theo năm đang chọn: `HCFC (<YEAR>)`, `HFC (<YEAR>)`, `Phụ lục QĐ (<YEAR>)`.
- Tích hợp parse Excel theo đúng pattern sheet năm: `HNNHK_HCFC_<YEAR>`, `HNNHK_HFC_<YEAR>`, `PL Quyet dinh_PBHN_<YEAR>`.
- Chỉ render các cột tô màu (solid fill), tự loại cột `Tính toán/Đề xuất`, có fallback cấu hình cột theo index khi style không khả dụng.
- Thêm lưu trữ dataset hạn ngạch theo năm (`hfcs_quotaProposalByYear`) và tự đồng bộ khi chuyển năm báo cáo, không reload trang.
- Bảng dữ liệu hỗ trợ: sticky header, pin cột định danh, search theo Tên DN/MST, sort số cho cột tổng, export CSV/XLSX theo view hiện tại.
- Thêm profiling markers: `parseExcel`, `deriveVisibleColumns`, `buildQuotaTables`, `firstRenderQuotaView`.
- Tối ưu hiệu năng bảng rộng bằng memo hóa dữ liệu dẫn xuất và virtualize row rendering.

## [4.0.1] - 2026-02-07

### UI refactor Table 2.1
- **Bảng 2.1**: Tự động hóa cột TT chuyên nghiệp hơn.
- **Bảng 2.1**: Thay thế nút Xóa bằng Icon Thùng rác kèm hộp thoại xác nhận (Confirmation Dialog).

## [4.0.0] - 2026-02-07

### Performance & Security Update
- **Tối ưu hóa hiệu suất (Phase 3.5)**: 
  - Memo hóa toàn bộ các tính toán nặng trong `CompanyDetailPage` (Reconcile logic).
  - Áp dụng `scheduleIdle` cho persistence và JSON import để giải phóng main thread.
  - Cải thiện PDF rendering pipeline với yielding mechanism (anti-freeze).
- **Cập nhật hệ thống**: Nâng cấp lên phiên bản 4.0.0.

## [3.9.2] - 2026-02-07

### Release
- Nâng cấp phiên bản hệ thống lên 3.9.2.
- Đồng bộ hóa version trên toàn bộ file cấu hình (package.json, constants.ts, index.html).
- Cập nhật số liệu thống kê hệ thống.

## [2.0.0] - 2025-01-27

### Major Refactoring Release

#### 🏗️ Refactor cấu trúc thư mục
- Tạo cấu trúc Vite/TypeScript đầy đủ trong `src/`
- Tách lớp rõ ràng: features, store, services, types, utils, components
- Domain model chuẩn hóa với Enterprise + AnnualReport per year
- Schema versioning với migration support

#### ⚡ Tối ưu performance
- Lazy/dynamic import cho Chart.js, XLSX, PDF.js
- Memo hoá có kiểm soát với proper dependencies
- Debounce/throttle cho thao tác nặng (800ms persist debounce)
- Cleanup toàn bộ side-effects để tránh memory leaks
- Polling interval tối ưu (4s) cho realtime sync

#### 🔧 Fix lỗi runtime/persistence/sync loop
- Fix sync loop khi có conflict hoặc remoteUpdate
- Proper dirty flag tracking để tránh unnecessary saves
- Hash-based change detection để skip no-op saves
- Conflict resolution UI với clear user choices
- Offline mode overlay để prevent data loss

#### 🐳 Docker/nginx
- Giữ nguyên cấu trúc docker-compose với 3 services
- Nginx reverse proxy cho /api routes
- State persistence với volume mount ./data
- Updated version comments

#### 🔄 Backward compatibility/migration
- Đọc được state cũ từ schemaVersion 1
- Auto-migrate enterprises với enterpriseNameKey
- Preserve yearReports structure
- Backward compatible localStorage keys

### Tệp thay đổi
- `index.html` - Updated to v2.0.0 with optimizations
- `package.json` - Updated to v2.0.1
- `README.md` - Updated documentation
- `docker-compose.yml` - Updated version comments
- `src/features/settings/SettingsPage.tsx` - Complete settings page
- `src/features/analysis/AnalysisPage.tsx` - Complete analysis page with charts
- `src/features/companies/CompanyDetailPage.tsx` - Complete company detail page

## [1.75.13] - Previous Release

### UI/UX Improvements
- Dashboard: Count unique enterprise IDs
- Double-click to open company detail
- Highlighted import/export columns
- Icon buttons with tooltips
- Integrated Excel import in Settings

## [1.68.7] - Previous Release

### Multi-Pass Extraction
- 3-layer architecture for PDF extraction
- High resolution image rendering for dense tables
- Intelligent page detection for table types
- Debug logging for extraction troubleshooting

---

For detailed migration guides and API documentation, see the README.md file.
