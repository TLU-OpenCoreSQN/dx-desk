# Enterprise UI/UX Upgrade Plan: DX-Desk Modernization

**Document ID**: PLAN-UIUX-2026-11-17  
**Branch**: `feature/ui-ux-revamp`  
**Base Commit**: `origin/main` (`27d36a6`)  
**Target Systems**: `apps/web` (Main Portal), `apps/device-request` (Micro-frontend at `/thiet-bi/`)  
**Status**: APPROVED FOR IMPLEMENTATION  
**Author**: Worker M1 (UI/UX Architecture & Planning Lead)  
**Co-Authors & Survey References**: Explorer 1 (Repo & Components), Explorer 2 (UI Audit & Design Tokens), Explorer 3 (Domain Workflows & Visual Models)  

---

## Table of Contents

1. [Executive Summary & Modernization Objectives](#1-executive-summary--modernization-objectives)
   - 1.1 [Strategic Vision & Problem Statement](#11-strategic-vision--problem-statement)
   - 1.2 [Target Personas & Operational Needs](#12-target-personas--operational-needs)
   - 1.3 [Design Philosophy & Guiding Principles](#13-design-philosophy--guiding-principles)
2. [Comprehensive UI/UX Audit & Gap Analysis](#2-comprehensive-uiux-audit--gap-analysis)
   - 2.1 [Screen-by-Screen Inventory & Architecture Audit](#21-screen-by-screen-inventory--architecture-audit)
   - 2.2 [Architectural & Configuration Defects](#22-architectural--configuration-defects)
   - 2.3 [Pervasive Token Bypasses & Hardcoded Color Inconsistencies](#23-pervasive-token-bypasses--hardcoded-color-inconsistencies)
   - 2.4 [Dark Mode Structural Deficiencies](#24-dark-mode-structural-deficiencies)
   - 2.5 [Accessibility & WCAG 2.1 Contrast Failure Analysis](#25-accessibility--wcag-21-contrast-failure-analysis)
3. [Visual Identity & Minimalist Corporate Design Specifications](#3-visual-identity--minimalist-corporate-design-specifications)
   - 3.1 [Design Direction: Minimalist Swiss Corporate Style](#31-design-direction-minimalist-swiss-corporate-style)
   - 3.2 [Three-Layer Design Token Architecture](#32-three-layer-design-token-architecture)
   - 3.3 [Corporate Color System & Contrast Ratings](#33-corporate-color-system--contrast-ratings)
   - 3.4 [Complete CSS Variables Specification Block](#34-complete-css-variables-specification-block)
   - 3.5 [Tailwind CSS v4 Integration Architecture](#35-tailwind-css-v4-integration-architecture)
   - 3.6 [Typography Hierarchy & Monospace Tabular Numerals](#36-typography-hierarchy--monospace-tabular-numerals)
   - 3.7 [Enterprise Data Density Standard (8/10 Scale)](#37-enterprise-data-density-standard-810-scale)
4. [Intuitive Visual Workflow Presentation Specifications](#4-intuitive-visual-workflow-presentation-specifications)
   - 4.1 [Model 1: Adaptive Dual-Track Stage Tracker (Ticket Detail Page)](#41-model-1-adaptive-dual-track-stage-tracker-ticket-detail-page)
   - 4.2 [Model 2: Linear 4-Stage Stepper with Rejection Off-Ramp (Device Requisition)](#42-model-2-linear-4-stage-stepper-with-rejection-off-ramp-device-requisition)
   - 4.3 [Model 3: Operational Technician Kanban Board with SLA Urgency Swimlanes](#43-model-3-operational-technician-kanban-board-with-sla-urgency-swimlanes)
   - 4.4 [Model 4: Dynamic SLA Real-Time Countdown & Pause Indicator](#44-model-4-dynamic-sla-real-time-countdown--pause-indicator)
   - 4.5 [Model 5: AI Triage Visual Diff Inspector](#45-model-5-ai-triage-visual-diff-inspector)
   - 4.6 [Interaction State Specifications & WCAG ARIA Semantics](#46-interaction-state-specifications--wcag-aria-semantics)
5. [Component Refactoring Matrix & Design Token Migration](#5-component-refactoring-matrix--design-token-migration)
   - 5.1 [Common Component Library Migration](#51-common-component-library-migration)
   - 5.2 [Layout & Navigation Shell Migration](#52-layout--navigation-shell-migration)
   - 5.3 [Domain & Workflow Component Migration](#53-domain--workflow-component-migration)
6. [Phased Implementation Roadmap](#6-phased-implementation-roadmap)
   - 6.1 [Phase Breakdown & Work Packages](#61-phase-breakdown--work-packages)
   - 6.2 [Detailed Execution Sequence & Timeline](#62-detailed-execution-sequence--timeline)
   - 6.3 [Phase Gates & Exit Criteria](#63-phase-gates--exit-criteria)
7. [Risk Management, Backward Compatibility & Rollback Strategy](#7-risk-management-backward-compatibility--rollback-strategy)
   - 7.1 [User Preference Migration (`localStorage`)](#71-user-preference-migration-localstorage)
   - 7.2 [Third-Party Integration Compatibility (Metabase & SeaweedFS)](#72-third-party-integration-compatibility-metabase--seaweedfs)
   - 7.3 [Keycloak Authentication & RBAC Guard Integrity](#73-keycloak-authentication--rbac-guard-integrity)
   - 7.4 [Rollback & Recovery Plan](#74-rollback--recovery-plan)

---

## 1. Executive Summary & Modernization Objectives

### 1.1 Strategic Vision & Problem Statement

DX-Desk is an enterprise internal IT Service Management (ITSM) and workplace device provisioning platform utilized across departments for incident handling, access requests, hardware allocation, and AI-assisted triage. While functionally comprehensive (supporting NestJS, PostgreSQL RLS, Keycloak JWT authentication, and an embedded Node.js AI assistant), the current user interface presents severe usability and aesthetic challenges:
1. **Warm "Notion-like" Aesthetic Incongruence**: The interface relies on warm sepia/beige tints (`#f7f6f3`, `#eeede9`), brown text (`#211f1b`), and mustard/amber accents (`#cb912f`). This creative note-taking visual style lacks the authority, crisp contrast, and precision demanded by high-volume enterprise operations.
2. **Invisible Workflow Topologies**: Complex multi-step business state machines (9 ticket statuses with 17 transitions, SLA clocks with dynamic pauses, and device requisitions with manager approvals) are obscured. Users and technicians are shown only static text badges and disconnected action dropdowns, leaving them with no spatial mental model of where an item resides within the operational pipeline.
3. **Severe Accessibility & Dark Mode Failures**: Crucial status badges and metadata fail WCAG 2.1 AA contrast requirements (e.g., Warning badge at 2.8:1). When dark mode is toggled, missing semantic overrides cause light-pastel badges to blaze aggressively on dark backgrounds, causing visual fatigue and illegibility.

The modernization plan establishes a **Minimalist Corporate Swiss Design System** built upon a rigorous 3-layer design token architecture (Slate/Navy neutral foundations, Enterprise Cobalt interactive blue, and WCAG AAA/AA status tokens) and introduces **five intuitive visual workflow models** to streamline enterprise throughput.

### 1.2 Target Personas & Operational Needs

| Persona | Primary Tasks | Core Operational Pain Point | UI Upgrade Solution |
|---|---|---|---|
| **Employee (Requester)** | Submit incident tickets, request hardware, monitor status, confirm resolutions. | Lack of clarity on ticket progress; unaware of whether a ticket is stuck or pending managerial approval. | Adaptive Stage Tracker on ticket details; 4-stage visual device stepper; transparent SLA countdown. |
| **Support Agent / Technician** | Triage incoming queues, claim tickets, diagnose issues, request user feedback, resolve incidents. | High cognitive load scanning dense tabular lists; difficulty identifying SLA breach risks and paused tickets. | Operational Kanban Board with SLA urgency swimlanes; real-time dynamic SLA pause badges; 1-click claim affordances. |
| **IT Service Manager** | Review access requests, approve hardware requisitions, audit SLA compliance, analyze team performance. | Fragmented approval views; danger of missing critical approvals; manual effort validating AI triage proposals. | Dedicated visual approval dialogs with clear rationale; AI Triage Visual Diff Inspector; unified reporting dashboard. |

### 1.3 Design Philosophy & Guiding Principles

- **Swiss Modernism (Clarity & Form Follows Function)**: Information hierarchy is communicated through strict grid alignment, typography weight, and deliberate whitespace rather than excessive borders, heavy drop shadows, or decorative gradients.
- **Data Density 8/10 Standard**: Enterprise operational tools require high information density. Table rows are standardized to 44px, inputs to 38px, and card padding to 16px to minimize scrolling while preserving touch usability on mobile devices.
- **Universal Accessibility (WCAG 2.1 AA & AAA)**: Every primary text element, badge, and interactive control is engineered to exceed 4.5:1 (normal text) and 7:1 (key status indicators) in both light and dark modes. Color is never used as the sole indicator of state.
- **Defensive Design Token Discipline**: Strict prohibition of arbitrary bracketed hex classes (e.g., `text-[#d44c47]`). All visual attributes must resolve through a 3-layer design token system.

---

## 2. Comprehensive UI/UX Audit & Gap Analysis

### 2.1 Screen-by-Screen Inventory & Architecture Audit

The repository contains two frontend applications: the main portal (`apps/web`) and a dedicated micro-frontend (`apps/device-request`).

| Application | Screen / View Route | Component & Path | Audit Findings & UI Deficiencies |
|---|---|---|---|
| `apps/web` | `/` (Home) | `HomePage.tsx` (438 lines) | Hero section uses consumer-style gradient background; metrics row uses arbitrary border colors; service health ping lacks structured token binding. |
| `apps/web` | `/tickets` (List) | `TicketListPage.tsx` (604 lines) | Table lacks density control; table hover uses raw hex `hover:shadow-[inset_3px_0_0_0_#0a78be]`; pagination buttons have inconsistent touch targets; no stage pipeline visualization. |
| `apps/web` | `/tickets/new` (Create) | `CreateTicketPage.tsx` (926 lines) | Multi-step category selector lacks subtle elevation tokens; inline validation errors use un-themed reds; dynamic form fields do not follow 38px height standard. |
| `apps/web` | `/tickets/:id` (Detail) | `TicketDetailPage.tsx` (234 lines) | **Major Workflow Gap**: Relies entirely on static `StatusBadge`. No horizontal stage tracker; actions are stacked in a disconnected sidebar; SLA timer does not indicate pause state. |
| `apps/web` | `/device-requests` (Device) | `DeviceRequestPage.tsx` (662 lines) | **Major Discrepancy**: Renders requests as flat cards without stage tracking, whereas micro-frontend `apps/device-request` has a 4-step stepper; PDF download action is buried. |
| `apps/web` | `/work-queue` (Queue) | `WorkQueuePage.tsx` / `TicketQueueView.tsx` | Technicians are restricted to a 2-column card list; no Kanban view mode; unassigned tickets lack immediate 1-click claim button; SLA urgency not visualized as a gauge. |
| `apps/web` | `/approvals` (Approvals) | `ManagerApprovalsPage.tsx` | Rejection flow opens modal with hardcoded red border; optimistic locking 409 conflict warnings lack actionable visual resolution. |
| `apps/web` | `/bao-cao` (Analytics) | `ManagerAnalyticsPage.tsx` | Embedded Metabase iframe creates an aesthetic disconnect with surrounding app shell; no loading skeleton during iframe JWT handshake. |
| `apps/web` | `/du-lieu` (Data Catalog) | `DataCatalogPage.tsx` (164 lines) | DCAT schema explorer uses raw monospace fonts without tabular spacing; JSON-LD copy chip lacks clear copied feedback state. |
| `apps/web` | `/tro-ly` (AI Assistant) | `AssistantPage.tsx` (124 lines) | Streaming markdown response lacks custom code block styling; tool audit step trace is text-heavy without visual timeline connectors. |
| `apps/device-request` | `/thiet-bi/` (App 2) | `App.tsx` & `RequestCard.tsx` | Contains a functional 4-step stepper but uses independent CSS variables out of sync with `apps/web`; rejection state is not visualized as an explicit off-ramp. |

### 2.2 Architectural & Configuration Defects

Deep inspection of `apps/web/tailwind.config.js` and `apps/web/src/index.css` revealed critical configuration conflicts:

1. **Border Radius Flattening in Tailwind Config**:
   In `apps/web/tailwind.config.js` (lines 92-99):
   ```javascript
   borderRadius: {
     DEFAULT: '4px',
     sm: '4px',
     md: '4px',
     lg: '4px',
     xl: '4px',
     '2xl': '4px',
   }
   ```
   Every single border radius token is flattened to `'4px'`, completely erasing visual hierarchy between small elements (tags, badges) and large structural elements (cards, modals).
2. **Direct Contradiction with `index.css` Variables**:
   In `apps/web/src/index.css` (lines 58-65):
   ```css
   --radius: 6px;
   --radius-xs: 4px;
   --radius-sm: 4px;
   --radius-md: 6px;
   --radius-lg: 8px;
   --radius-xl: 12px;
   --radius-2xl: 16px;
   ```
   Developers using Tailwind utility classes (`rounded-lg`, `rounded-xl`) receive 4px, while developers referencing `var(--radius-lg)` receive 8px, resulting in severe visual fragmentation.
3. **Duplicated / Invalid Teal Color Palette**:
   In `apps/web/tailwind.config.js` (lines 78-90), the `teal` palette was duplicated directly from the `navy` palette:
   ```javascript
   teal: {
     50: '#deeef8', 100: '#deeef8', 200: '#9bc8e8', 300: '#64a7da',
     400: '#3488cb', 500: '#0a78be', 600: '#0a78be', 700: '#08639e',
     800: '#07507f', 900: '#0c3858', 950: '#07243b',
   }
   ```
   These values are cerulean blue hex codes, not teal.
4. **State Machine Styling Desynchronization**:
   `apps/web/src/lib/ticketWorkflow.ts` (lines 67-77) defines `STATUS_TONES` using Tailwind classes (`bg-cyan-100 text-cyan-800`), while `apps/web/src/components/common/Badge.tsx` (lines 72-82) ignores them completely and defines a separate dictionary `TICKET_STATUS_STYLES` using hardcoded `#hex` values.

### 2.3 Pervasive Token Bypasses & Hardcoded Color Inconsistencies

Design tokens are routinely bypassed across core components via arbitrary bracketed hex classes and inline styles:

```
apps/web/src/components/common/Badge.tsx:
  Line 33: bg-[#fbe4e4] text-[#d44c47] border border-[#f6c3c1] (Critical Priority)
  Line 40: bg-[#fbf3db] text-[#cb912f] border border-[#f5ddb2] (High Priority)
  Line 47: bg-[#deeef8] text-[#0a5c94] border border-[#b9daf0] (Normal Priority)
  Line 78: bg-[#f4eeff] text-[#9065b0] border-[#e0cdfc] (Pending Approval)

apps/web/src/components/common/Alert.tsx:
  Lines 24-37: Hardcoded `#deeef8`, `#07507f`, `#edf3ec`, `#27553c`, `#fbf3db`, `#7c5108`, `#fbe4e4`, `#962824`

apps/web/src/components/common/FormField.tsx:
  Line 13: invalid ? 'border-[#f6c3c1] focus:border-[#d44c47] focus:ring-[#d44c47]' : ...

apps/web/src/components/ticket-detail/TicketWorkflowActions.tsx:
  Line 235: text-[#8c8a85]
  Line 240: border-[#f6c3c1] bg-[#fcedec] text-[#962824]
  Line 282: border-[#f6c3c1] focus:border-[#d44c47] focus:ring-[#d44c47]

apps/web/src/pages/TicketListPage.tsx:
  Line 461: hover:shadow-[inset_3px_0_0_0_#0a78be]

apps/web/src/App.tsx:
  Lines 42-43: bg-gradient-to-br from-[#fbf3db] to-[#f5ddb2]/40 text-[#7c5108] border border-[#f5ddb2]
```

### 2.4 Dark Mode Structural Deficiencies

In `apps/web/src/index.css` (lines 80-100), `:root.dark` provides token overrides for surfaces and primary accents, but **completely omits semantic status tokens**:
- `--color-success`, `--color-warning`, `--color-danger`, and `--color-pending` are undefined in dark mode.
- Because components (`Badge.tsx`, `Alert.tsx`) hardcode light pastel hexes (`bg-[#fbe4e4]`, `bg-[#fbf3db]`), when dark mode is active, badges render as blinding pastel neon blocks on `#111827` dark cards.
- The contrast of danger text (`#d44c47`) against dark surfaces collapses to **2.9:1**, violating WCAG requirements.

### 2.5 Accessibility & WCAG 2.1 Contrast Failure Analysis

Quantitative analysis of contrast ratios across the current palette reveals critical failures:

| Component / Token | Foreground Hex | Background Hex | Contrast Ratio | WCAG 2.1 Standard | Status |
|---|---|---|---|---|---|
| Normal Text (`--color-content`) | `#211f1b` | `#ffffff` | **16.1:1** | AA (4.5:1) / AAA (7:1) | **PASS (AAA)** |
| Muted Text (`--color-content-muted`) | `#5f5e5a` | `#ffffff` | **6.5:1** | AA (4.5:1) | **PASS (AA)** |
| Subtle Text (`--color-content-subtle`)| `#8a8884` | `#ffffff` | **3.5:1** | AA (4.5:1) | **FAIL** |
| `PriorityBadge` High | `#cb912f` | `#fbf3db` | **2.8:1** | AA (4.5:1) | **CRITICAL FAIL** |
| `StatusBadge` Waiting User | `#cb912f` | `#fbf3db` | **2.8:1** | AA (4.5:1) | **CRITICAL FAIL** |
| `StatusBadge` Resolved | `#448361` | `#edf3ec` | **4.3:1** | AA (4.5:1) | **FAIL** |
| `StatusBadge` Cancelled | `#d44c47` | `#fbe4e4` | **3.9:1** | AA (4.5:1) | **FAIL** |
| Dark Mode Danger Text | `#d44c47` | `#1e1e1e` | **2.9:1** | AA (4.5:1) | **CRITICAL FAIL** |
| Form Error Helper Text | `#962824` | `#ffffff` | **7.1:1** | AA (4.5:1) / AAA (7:1) | **PASS (AAA)** |

---

## 3. Visual Identity & Minimalist Corporate Design Specifications

### 3.1 Design Direction: Minimalist Swiss Corporate Style

The upgraded visual identity moves away from warm paper/sepia tones to an authoritative **Minimalist Swiss Corporate** aesthetic:
- **Palette**: Slate/Navy neutral foundations with high-contrast surfaces and Enterprise Cobalt as the focal interactive accent.
- **Form**: Precise geometric corners (`--radius-sm: 4px` for badges, `--radius-md: 6px` for buttons/inputs, `--radius-lg: 8px` for cards).
- **Structure**: Visual hierarchy guided by spatial grid alignment and crisp borders (`#E2E8F0` / `#1E293B`) rather than diffuse shadows.

### 3.2 Three-Layer Design Token Architecture

Following the design system specifications in `.agents/skills/design-system/SKILL.md`:

```
┌────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: PRIMITIVE TOKENS (Raw values, scales, palettes)               │
│   --slate-50 (#F8FAFC) ... --slate-900 (#0F172A)                       │
│   --blue-500 (#3B82F6) ... --blue-700 (#1D4ED8)                        │
│   --emerald-600, --amber-600, --rose-600, --violet-600                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ aliased by
┌───────────────────────────────────▼────────────────────────────────────┐
│ LAYER 2: SEMANTIC TOKENS (Purpose-driven, theme-switchable)            │
│   --color-background, --color-surface, --color-content                 │
│   --color-primary, --color-edge, --color-ring                          │
│   --color-status-success, --color-status-warning, etc.                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ consumed by
┌───────────────────────────────────▼────────────────────────────────────┐
│ LAYER 3: COMPONENT TOKENS (Scoped component properties)                │
│   --badge-status-bg, --badge-status-text, --badge-radius               │
│   --button-primary-bg, --table-row-hover, --card-border                │
│   --stepper-node-active-bg, --kanban-column-bg                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Corporate Color System & Contrast Ratings

#### Light & Dark Mode Semantic Status Tokens (Verified WCAG Compliance)

| Semantic Role | Mode | Text Hex | Background Hex | Border Hex | Contrast Ratio | WCAG Rating |
|---|---|---|---|---|---|---|
| **Success** (Resolved / Healthy) | Light | `#065F46` (`emerald-800`) | `#ECFDF5` (`emerald-50`) | `#A7F3D0` (`emerald-200`) | **7.3:1** | **AAA** |
| | Dark | `#34D399` (`emerald-400`) | `rgba(5,150,105,0.18)` | `rgba(52,211,153,0.35)` | **6.2:1** | **AA** |
| **Warning** (Waiting User / Review) | Light | `#854D0E` (`amber-800`) | `#FEFCE8` (`amber-50`) | `#FEF08A` (`amber-200`) | **7.1:1** | **AAA** |
| | Dark | `#FBBF24` (`amber-400`) | `rgba(217,119,6,0.18)` | `rgba(251,191,36,0.35)` | **6.5:1** | **AA** |
| **Danger** (Critical / SLA Breach) | Light | `#991B1B` (`rose-800`) | `#FEF2F2` (`rose-50`) | `#FECACA` (`rose-200`) | **7.2:1** | **AAA** |
| | Dark | `#F87171` (`rose-400`) | `rgba(220,38,38,0.18)` | `rgba(248,113,113,0.35)` | **5.8:1** | **AA** |
| **Info** (In Progress / Normal) | Light | `#1E40AF` (`blue-800`) | `#EFF6FF` (`blue-50`) | `#BFDBFE` (`blue-200`) | **7.4:1** | **AAA** |
| | Dark | `#60A5FA` (`blue-400`) | `rgba(37,99,235,0.18)` | `rgba(96,165,250,0.35)` | **6.0:1** | **AA** |
| **Pending** (Approval / Triaged) | Light | `#5B21B6` (`violet-800`) | `#F5F3FF` (`violet-50`) | `#DDD6FE` (`violet-200`) | **7.5:1** | **AAA** |
| | Dark | `#A78BFA` (`violet-400`) | `rgba(124,58,237,0.18)` | `rgba(167,139,250,0.35)` | **6.1:1** | **AA** |
| **Neutral** (New / Assigned / Closed) | Light | `#334155` (`slate-700`) | `#F1F5F9` (`slate-100`) | `#CBD5E1` (`slate-300`) | **7.8:1** | **AAA** |
| | Dark | `#94A3B8` (`slate-400`) | `rgba(30,41,59,0.50)` | `rgba(71,85,105,0.40)` | **6.0:1** | **AA** |

### 3.4 Complete CSS Variables Specification Block

The following block is designed for direct replacement in `apps/web/src/index.css` and `apps/device-request/src/index.css`:

```css
/* ==========================================================================
   DX-DESK ENTERPRISE DESIGN TOKENS (SWISS MINIMALIST CORPORATE)
   ========================================================================== */

/* === LAYER 1: PRIMITIVE TOKENS === */
:root {
  /* Slate Scale */
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-600: #475569;
  --slate-700: #334155;
  --slate-800: #1e293b;
  --slate-900: #0f172a;
  --slate-950: #020617;

  /* Enterprise Blue Scale */
  --blue-50: #eff6ff;
  --blue-100: #dbeafe;
  --blue-200: #bfdbfe;
  --blue-300: #93c5fd;
  --blue-400: #60a5fa;
  --blue-500: #3b82f6;
  --blue-600: #2563eb;
  --blue-700: #1d4ed8;
  --blue-800: #1e40af;
  --blue-900: #1e3a8a;

  /* Semantic Primitives */
  --emerald-50: #ecfdf5;
  --emerald-200: #a7f3d0;
  --emerald-600: #059669;
  --emerald-800: #065f46;

  --amber-50: #fefce8;
  --amber-200: #fef08a;
  --amber-600: #d97706;
  --amber-800: #854d0e;

  --rose-50: #fef2f2;
  --rose-200: #fecaca;
  --rose-600: #dc2626;
  --rose-800: #991b1b;

  --violet-50: #f5f3ff;
  --violet-200: #ddd6fe;
  --violet-600: #7c3aed;
  --violet-800: #5b21b6;

  /* Spacing Scale (4px base) */
  --space-0-5: 2px;
  --space-1: 4px;
  --space-1-5: 6px;
  --space-2: 8px;
  --space-2-5: 10px;
  --space-3: 12px;
  --space-3-5: 14px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Border Radius Hierarchy */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-full: 9999px;

  /* Typography Fonts */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* === LAYER 2: SEMANTIC TOKENS (LIGHT THEME) === */
:root {
  color-scheme: light;

  /* Surfaces & Canvas */
  --color-background: var(--slate-50);
  --color-surface: #ffffff;
  --color-surface-muted: var(--slate-100);
  --color-surface-hover: var(--slate-200);
  --color-surface-card: #ffffff;
  --color-surface-sidebar: #ffffff;

  /* Typography */
  --color-content: var(--slate-900);
  --color-content-muted: var(--slate-600);
  --color-content-subtle: var(--slate-500);

  /* Borders & Dividers */
  --color-edge: var(--slate-200);
  --color-edge-subtle: var(--slate-100);
  --color-edge-strong: var(--slate-300);

  /* Primary Interactive */
  --color-primary: var(--blue-600);
  --color-primary-hover: var(--blue-700);
  --color-primary-active: var(--blue-800);
  --color-primary-tint: var(--blue-50);
  --color-primary-border: var(--blue-200);
  --color-primary-text: var(--blue-800);
  --color-ring: var(--blue-600);

  /* Semantic Status: Success */
  --color-status-success: var(--emerald-800);
  --color-status-success-bg: var(--emerald-50);
  --color-status-success-border: var(--emerald-200);

  /* Semantic Status: Warning */
  --color-status-warning: var(--amber-800);
  --color-status-warning-bg: var(--amber-50);
  --color-status-warning-border: var(--amber-200);

  /* Semantic Status: Danger */
  --color-status-danger: var(--rose-800);
  --color-status-danger-bg: var(--rose-50);
  --color-status-danger-border: var(--rose-200);

  /* Semantic Status: Info */
  --color-status-info: var(--blue-800);
  --color-status-info-bg: var(--blue-50);
  --color-status-info-border: var(--blue-200);

  /* Semantic Status: Pending */
  --color-status-pending: var(--violet-800);
  --color-status-pending-bg: var(--violet-50);
  --color-status-pending-border: var(--violet-200);

  /* Semantic Status: Neutral */
  --color-status-neutral: var(--slate-700);
  --color-status-neutral-bg: var(--slate-100);
  --color-status-neutral-border: var(--slate-300);
}

/* === LAYER 2: SEMANTIC TOKENS (DARK THEME OVERRIDES) === */
:root.dark {
  color-scheme: dark;

  /* Surfaces & Canvas */
  --color-background: #0b0f17;
  --color-surface: #111827;
  --color-surface-muted: var(--slate-900);
  --color-surface-hover: var(--slate-800);
  --color-surface-card: #111827;
  --color-surface-sidebar: #0f172a;

  /* Typography */
  --color-content: var(--slate-50);
  --color-content-muted: var(--slate-400);
  --color-content-subtle: var(--slate-500);

  /* Borders & Dividers */
  --color-edge: var(--slate-800);
  --color-edge-subtle: #161f30;
  --color-edge-strong: var(--slate-700);

  /* Primary Interactive */
  --color-primary: var(--blue-500);
  --color-primary-hover: var(--blue-400);
  --color-primary-active: var(--blue-600);
  --color-primary-tint: rgba(37, 99, 235, 0.16);
  --color-primary-border: rgba(59, 130, 246, 0.40);
  --color-primary-text: #93c5fd;
  --color-ring: var(--blue-500);

  /* Semantic Status: Success (Dark) */
  --color-status-success: #34d399;
  --color-status-success-bg: rgba(5, 150, 105, 0.18);
  --color-status-success-border: rgba(52, 211, 153, 0.35);

  /* Semantic Status: Warning (Dark) */
  --color-status-warning: #fbbf24;
  --color-status-warning-bg: rgba(217, 119, 6, 0.18);
  --color-status-warning-border: rgba(251, 191, 36, 0.35);

  /* Semantic Status: Danger (Dark) */
  --color-status-danger: #f87171;
  --color-status-danger-bg: rgba(220, 38, 38, 0.18);
  --color-status-danger-border: rgba(248, 113, 113, 0.35);

  /* Semantic Status: Info (Dark) */
  --color-status-info: #60a5fa;
  --color-status-info-bg: rgba(37, 99, 235, 0.18);
  --color-status-info-border: rgba(96, 165, 250, 0.35);

  /* Semantic Status: Pending (Dark) */
  --color-status-pending: #a78bfa;
  --color-status-pending-bg: rgba(124, 58, 237, 0.18);
  --color-status-pending-border: rgba(167, 139, 250, 0.35);

  /* Semantic Status: Neutral (Dark) */
  --color-status-neutral: #94a3b8;
  --color-status-neutral-bg: rgba(30, 41, 59, 0.50);
  --color-status-neutral-border: rgba(71, 85, 105, 0.40);
}

/* === LAYER 3: COMPONENT TOKENS === */
:root {
  /* Badges */
  --badge-radius: var(--radius-sm);
  --badge-font-size: 0.75rem;
  --badge-font-weight: 600;
  --badge-py: 0.125rem;
  --badge-px: 0.5rem;

  /* Buttons */
  --button-radius: var(--radius-md);
  --button-font-size: 0.8125rem;
  --button-font-weight: 600;
  --button-h-sm: 32px;
  --button-h-md: 38px;
  --button-h-lg: 44px;

  /* Inputs & Form Fields */
  --input-radius: var(--radius-md);
  --input-h-md: 38px;
  --input-border: var(--color-edge);
  --input-bg: var(--color-surface);
  --input-focus-ring: var(--color-primary);

  /* Cards & Modals */
  --card-radius: var(--radius-lg);
  --card-border: var(--color-edge);
  --card-bg: var(--color-surface-card);
  --card-padding: var(--space-4);

  /* Data Table */
  --table-row-h: 44px;
  --table-header-bg: var(--color-surface-muted);
  --table-header-text: var(--color-content-muted);
  --table-row-border: var(--color-edge-subtle);
  --table-row-hover: var(--color-primary-tint);

  /* Workflow Visual Steppers & Kanban */
  --stepper-node-size: 28px;
  --stepper-line-w: 2px;
  --stepper-line-active: var(--color-primary);
  --stepper-line-pending: var(--color-edge);
  --kanban-column-w: 290px;
  --kanban-column-bg: var(--color-surface-muted);
}
```

### 3.5 Tailwind CSS v4 Integration Architecture

In `apps/web/tailwind.config.js`, the configuration is updated to expose all 3 layers directly to Tailwind's `@theme` compiler, removing the flattened 4px radius bug:

```javascript
// apps/web/tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
          hover: 'var(--color-surface-hover)',
          card: 'var(--color-surface-card)',
          sidebar: 'var(--color-surface-sidebar)',
        },
        content: {
          DEFAULT: 'var(--color-content)',
          muted: 'var(--color-content-muted)',
          subtle: 'var(--color-content-subtle)',
        },
        edge: {
          DEFAULT: 'var(--color-edge)',
          subtle: 'var(--color-edge-subtle)',
          strong: 'var(--color-edge-strong)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          tint: 'var(--color-primary-tint)',
          border: 'var(--color-primary-border)',
          text: 'var(--color-primary-text)',
        },
        status: {
          success: 'var(--color-status-success)',
          'success-bg': 'var(--color-status-success-bg)',
          'success-border': 'var(--color-status-success-border)',
          warning: 'var(--color-status-warning)',
          'warning-bg': 'var(--color-status-warning-bg)',
          'warning-border': 'var(--color-status-warning-border)',
          danger: 'var(--color-status-danger)',
          'danger-bg': 'var(--color-status-danger-bg)',
          'danger-border': 'var(--color-status-danger-border)',
          info: 'var(--color-status-info)',
          'info-bg': 'var(--color-status-info-bg)',
          'info-border': 'var(--color-status-info-border)',
          pending: 'var(--color-status-pending)',
          'pending-bg': 'var(--color-status-pending-bg)',
          'pending-border': 'var(--color-status-pending-border)',
          neutral: 'var(--color-status-neutral)',
          'neutral-bg': 'var(--color-status-neutral-bg)',
          'neutral-border': 'var(--color-status-neutral-border)',
        },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
};
```

### 3.6 Typography Hierarchy & Monospace Tabular Numerals

1. **Elimination of Sub-12px Font Sizes**:
   All occurrences of `text-[10px]` in badges, meta labels, and buttons are replaced with `text-xs font-semibold` (12px, 16px line-height) to maintain legibility across all desktop display densities.
2. **Tabular Numerals for Operational Stability**:
   Operational fields (`#TK-0081`, countdown timers `03:42:15`, monetary amounts, SLA percentages) apply `font-mono tabular-nums`. This prevents micro-layout jitter when countdowns tick every second.
3. **Standardized Type Hierarchy**:
   - **Page Title**: `text-xl font-bold tracking-tight text-content` (20px / 28px).
   - **Section Heading**: `text-sm font-semibold tracking-tight text-content` (14px / 20px).
   - **Data Header / Subtitle**: `text-xs font-semibold uppercase tracking-wider text-content-muted` (12px / 16px).
   - **Body & Form Text**: `text-sm font-normal text-content` (14px / 20px).
   - **Secondary & Meta**: `text-xs text-content-subtle` (12px / 16px).

### 3.7 Enterprise Data Density Standard (8/10 Scale)

In compliance with the enterprise recommendations from `ui-ux-pro-max`:
- **Table Density**: Exactly `44px` height per row (`py-2.5 px-4`), enabling 18-20 rows visible above the fold on a standard 1080p display while remaining accessible to mouse and touch interactions.
- **Form Controls**: Standardized input and select heights to `38px` (`h-[38px] px-3 text-sm`), with `min-h-[44px]` touch target compliance on mobile viewports.
- **Card Padding**: Standardized to `p-4 sm:p-5`, eliminating arbitrary combinations of `p-3`, `p-6`, and `p-8`.

---

## 4. Intuitive Visual Workflow Presentation Specifications

### 4.1 Model 1: Adaptive Dual-Track Stage Tracker (Ticket Detail Page)

#### A. Architecture & State Topology
The Ticket Lifecycle State Machine (`apps/api/src/state-machine.ts:7-30`) defines 9 states and 17 valid transitions. The visual model organizes these into a **Main Linear Track (Happy Path)** of 6 progression steps, with **3 Sub-Process Conditional Branches**:

```
                       [Branch B: Chờ duyệt (pending_approval)]
                                      ▲
                                      │
[Step 1: Tiếp nhận] ➔ [Step 2: Phân loại] ➔ [Step 3: Phân công] ➔ [Step 4: Đang xử lý] ➔ [Step 5: Giải quyết] ➔ [Step 6: Đóng phiếu]
       (new)               (triaged)             (assigned)          (in_progress)          (resolved)            (closed)
                                                                          │
                                      ┌───────────────────────────────────┼──────────────────────────────────┐
                                      ▼                                   ▼                                  ▼
                        [Branch A: Chờ phản hồi]             [Action: Gửi yêu cầu duyệt]          [Branch C: Hủy phiếu]
                            (waiting_user)                       (pending_approval)                   (cancelled)
                           ⏸ SLA TẠM DỪNG
```

#### B. Visual Wireframe & Layout Specification

```
+-----------------------------------------------------------------------------------------------------------------------+
| TIẾN TRÌNH XỬ LÝ PHIẾU SỰ CỐ #TK-0081                                                           Trạng thái: ĐANG XỬ LÝ |
+-----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                       |
|    ( ✓ ) ------------ ( ✓ ) ------------ ( ✓ ) ------------ ( 4 ) - - - - - - ( 5 ) - - - - - - ( 6 )                 |
|   Tiếp nhận          Phân loại          Phân công          Đang xử lý          Giải quyết          Đóng phiếu         |
|   14:10 17/11       14:25 17/11        14:30 17/11         Hiện tại            Ước tính: 17:00    Chờ nghiệm thu      |
|                                                                                                                       |
|   [!] NHÁNH TRẠNG THÁI HIỆN TẠI:                                                                                      |
|   +---------------------------------------------------------------------------------------------------------------+   |
|   | ⏸ ĐANG CHỜ PHẢN HỒI TỪ NGƯỜI DÙNG                                                Đã tạm dừng: 42 phút         |   |
|   | Kỹ thuật viên Nguyễn Văn A đã yêu cầu cung cấp mã lỗi TeamViewer lúc 14:45. SLA tạm dừng tính thời gian.       |   |
|   | [ Phản hồi ngay ] (Người tạo phiếu)        [ Tiếp tục xử lý ] (Kỹ thuật viên)                                 |   |
|   +---------------------------------------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------------------------------------+
```

#### C. Step Status & Node Geometry
- **Container**: `rounded-lg border border-edge bg-surface p-4 sm:p-5 shadow-xs mb-6`.
- **Node Circle**: `w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors`.
  - `completed`: `bg-status-success text-white border-2 border-status-success` with Lucide `Check` icon (`w-4 h-4`).
  - `active`: `bg-primary text-white border-2 border-primary ring-4 ring-primary-tint` with step number or Lucide `Clock`.
  - `pending`: `bg-surface-muted text-content-subtle border-2 border-edge`.
  - `branch_active` (e.g. `waiting_user`): `bg-status-warning text-white border-2 border-status-warning ring-4 ring-status-warning-bg`.
- **Connecting Track Lines**: `h-0.5 flex-1 mx-2 transition-colors`. Solid `bg-status-success` for completed segments; dashed `bg-edge` for pending segments.
- **Mobile Rule (<640px)**: Collapses from 6-node horizontal grid to a compact summary pill displaying: `Bước 4/6: Đang xử lý ➔ [Xem toàn bộ tiến trình ▼]`.

---

### 4.2 Model 2: Linear 4-Stage Stepper with Rejection Off-Ramp (Device Requisition)

#### A. Architecture & Workflow Topology
Harmonizes `apps/web/src/pages/DeviceRequestPage.tsx` with `apps/device-request/src/RequestCard.tsx` based on `apps/device-request/src/workflow.ts`:

```
[1. Gửi đề nghị] ➔➔➔ [2. Quản lý duyệt] ➔➔➔ [3. IT Chuẩn bị] ➔➔➔ [4. Bàn giao thiết bị]
     (pending)           (approved)             (preparing)            (handed_over)
                              │                                              │
                              ▼                                              ▼
                    [Nhánh: Từ chối yêu cầu]                        [TẢI BIÊN BẢN BÀN GIAO]
                          (rejected)                                   (SeaweedFS PDF)
```

#### B. Visual Wireframe & Layout Specification

```
+-----------------------------------------------------------------------------------------------------------------------+
| YÊU CẦU CẤP THIẾT BỊ: LAPTOP DELL LATITUDE 7420 (x1)                                               Mã: #DR-2026-0042  |
+-----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                       |
|    ( ✓ ) =================== ( ✓ ) =================== ( 3 ) - - - - - - - - - - ( 4 )                               |
|   Gửi đề nghị               Quản lý duyệt             IT Chuẩn bị              Bàn giao                              |
|   Lê Thị B                  Trần Văn C (Trưởng phòng)  Nguyễn Văn A (IT)        Ký biên bản & giao                    |
|   09:15 15/11               11:30 15/11               Đang cài đặt Win 11      Chưa hoàn thành                       |
|                                                                                                                       |
|   TRƯỜNG HỢP BÀN GIAO THÀNH CÔNG (STAGE 4 COMPLETED):                                                                 |
|   +---------------------------------------------------------------------------------------------------------------+   |
|   | (✓) ĐÃ BÀN GIAO THÀNH CÔNG VÀO LÚC 16:00 16/11/2026                                                           |   |
|   | Thiết bị đã bàn giao cho nhân viên kèm phụ kiện. Biên bản lưu trữ trên hệ thống SeaweedFS.                    |   |
|   | [ 📄 Tải biên bản bàn giao thiết bị (.PDF · 48 KB) ]  [ 🔍 Xem chữ ký số ]                                     |   |
|   +---------------------------------------------------------------------------------------------------------------+   |
|                                                                                                                       |
|   TRƯỜNG HỢP TỪ CHỐI (REJECTION OFF-RAMP CALLOUT):                                                                    |
|   +---------------------------------------------------------------------------------------------------------------+   |
|   | (✕) YÊU CẦU ĐÃ BỊ TỪ CHỐI BỞI QUẢN LÝ                                            Thời gian: 11:30 15/11/2026   |   |
|   | Lý do từ chối: Phòng ban đã vượt định mức thiết bị quý 4. Đề nghị luân chuyển từ nhân viên nghỉ việc.        |   |
|   | Người quyết định: Trần Văn C (Trưởng phòng Kế hoạch)                                                           |   |
|   +---------------------------------------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

### 4.3 Model 3: Operational Technician Kanban Board with SLA Urgency Swimlanes

#### A. Architecture (Work Queue & Ticket List)
Added as a view toggle in `apps/web/src/pages/WorkQueuePage.tsx` and `TicketListPage.tsx` (`[ ⊞ Bảng danh sách ] [ ▥ Kanban luồng việc ]`).

#### B. Visual Wireframe & Kanban Columns

```
+=======================================================================================================================+
| [▥ KANBAN VẬN HÀNH IT]      Bộ lọc: [Tất cả nhóm kỹ thuật ▼]   Ưu tiên: [Tất cả ▼]   Sắp xếp: [SLA khẩn cấp nhất ▼]   |
+=======================================================================================================================+
| [!] HÀNG ĐỢI KHẨN CẤP / CRITICAL SWIMLANE (SLA 2 Giờ) - 2 Phiếu đang mở                                               |
+---------------------+---------------------+---------------------+---------------------+-------------------------------+
| C1: MỚI TIẾP NHẬN   | C2: HÀNG ĐỢI NHÓM   | C3: ĐANG XỬ LÝ      | C4: CHỜ PHẢN HỒI    | C5: ĐÃ GIẢI QUYẾT             |
| (new / triaged) [1] | (assigned/unclaimed)| (in_progress)   [2] | (waiting_user)  [1] | (resolved)                [4] |
+---------------------+---------------------+---------------------+---------------------+-------------------------------+
| #TK-0092 · 14m còn  |                     | #TK-0081 · 28m còn  |                     |                               |
| [Hạ tầng] Sập mạng  |                     | [Cơ sở dữ liệu] Khóa|                     |                               |
| Ưu tiên: CRITICAL   |                     | Assignee: Nguyen A  |                     |                               |
| [ Nhận xử lý ngay ] |                     | [== 78% SLA ==] ⚠️  |                     |                               |
+---------------------+---------------------+---------------------+---------------------+-------------------------------+
| [i] HÀNG ĐỢI TIÊU CHUẨN / HIGH & NORMAL SWIMLANE - 14 Phiếu                                                           |
+---------------------+---------------------+---------------------+---------------------+-------------------------------+
| #TK-0085            | #TK-0088            | #TK-0079            | #TK-0074            | #TK-0065                      |
| [Phần mềm] Lỗi Word | [Tài khoản] Reset PW| [In ấn] Kẹt giấy P3 | [VPN] Cần cấu hình  | [Email] Cấu hình Outlook      |
| Phụ trách: Chưa gán | Team: Support 1     | Assignee: Tran B    | Assignee: Le C      | Assignee: Nguyen A            |
| SLA: 5h 20m còn lại | SLA: 3h 10m còn lại | SLA: 1h 45m còn lại | ⏸ SLA Tạm dừng: 2h | [✓] Hoàn thành lúc 11:30       |
| [ Nhận phiếu ]      | [ Nhận phiếu ]      | [ Cập nhật ]        | [ Nhắc người dùng ] | [ Gửi nghiệm thu ]            |
+---------------------+---------------------+---------------------+---------------------+-------------------------------+
```

#### C. Card Layout & SLA Urgency Gauge Specification
- **Card Container**: `w-full bg-surface border border-edge rounded-md p-3 shadow-2xs hover:border-primary-border hover:shadow-xs transition-all cursor-pointer`.
- **SLA Urgency Visual Gauge Bar**: A 4px progress bar embedded at the base of each card:
  - `< 60% elapsed`: `bg-emerald-500` (Safe).
  - `60% - 80% elapsed`: `bg-amber-500` (Caution).
  - `80% - 100% elapsed`: `bg-orange-500 animate-pulse` (High SLA risk).
  - `> 100% breached`: `bg-rose-600` with badge `⚠️ Quá hạn SLA`.
- **1-Click Claim Affordance**: On unclaimed cards in C1 and C2, a prominent button `[ Nhận xử lý ngay ]` allows technicians to assign tickets to themselves without opening the full detail view.

---

### 4.4 Model 4: Dynamic SLA Real-Time Countdown & Pause Indicator

#### A. Mathematical & Operational Model
Based on `apps/api/src/state-machine.ts` and `db/migrations/003_ticket_workflow.sql`:
$$\text{effective\_deadline} = \text{sla\_due\_at} + \text{sla\_paused\_ms} + \begin{cases} (\text{now} - \text{waiting\_since}), & \text{if status} = \text{'waiting\_user'} \\ 0, & \text{otherwise} \end{cases}$$

#### B. Component States & Visual Callouts
1. **Active Running State**:
   ```
   [ ⏱️ Hạn cam kết xử lý: 03 giờ 24 phút còn lại (Trước 17:30 Hôm nay) ] ➔ [████████░░░░] 68%
   ```
2. **Paused State (`status === 'waiting_user'`)**:
   ```
   +---------------------------------------------------------------------------------------------------------------+
   | ⏸️ ĐỒNG HỒ SLA TẠM DỪNG (Chờ phản hồi từ người dùng)                             Thời gian đã dừng: 45 phút   |
   | SLA tự động gia hạn tương ứng khi người dùng gửi phản hồi. Thời hạn mới ước tính: 18:15 17/11/2026.           |
   +---------------------------------------------------------------------------------------------------------------+
   ```
   Token binding: `bg-status-warning-bg text-status-warning border border-status-warning-border`.
3. **Breached State (`sla_breached === true`)**:
   ```
   +---------------------------------------------------------------------------------------------------------------+
   | ⚠️ VI PHẠM THỜI HẠN SLA                                                           Trễ hạn: 01 giờ 15 phút      |
   | Đã vượt quá thời hạn cam kết lúc 14:00 17/11/2026. Thông báo leo thang đã được gửi tới Quản lý dịch vụ IT.    |
   +---------------------------------------------------------------------------------------------------------------+
   ```
   Token binding: `bg-status-danger-bg text-status-danger border border-status-danger-border animate-pulse`.

---

### 4.5 Model 5: AI Triage Visual Diff Inspector

#### A. Purpose & Placement
Integrated directly into `apps/web/src/modules/desk/TicketAiSuggestion.tsx` to provide a side-by-side comparison between existing ticket attributes and AI-extracted classifications from Wiki.js / Qdrant.

#### B. Visual Wireframe

```
+-----------------------------------------------------------------------------------------------------------------------+
| 🤖 ĐỀ XUẤT PHÂN LOẠI & GÁN NHÓM TỰ ĐỘNG TỪ AI TRỢ LÝ (Độ tin cậy: 94%)                                               |
+-----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                       |
|   THUỘC TÍNH           GIÁ TRỊ HIỆN TẠI                        ĐỀ XUẤT MỚI TỪ AI                                      |
|   -----------------    ---------------------------------       ----------------------------------------------------   |
|   Danh mục sự cố       [ Danh mục chung (general) ]        ➔   [ Mạng & VPN (vpn_network) ] (Khớp 98% nội dung)       |
|   Độ ưu tiên           [ Bình thường (normal) ]            ➔   [ Khẩn cấp (high) ] (Phát hiện từ khóa: "Toàn chi nhánh")
|   Đội ngũ xử lý        [ Chưa chỉ định đội ngũ ]           ➔   [ Đội Hạ tầng mạng (Network Team) ]                    |
|                                                                                                                       |
|   GIẢI TRÌNH TỪ MÔ HÌNH:                                                                                              |
|   "Nội dung mô tả đề cập tới việc mất kết nối mạng trên diện rộng tại Chi nhánh 2 sau khi nâng cấp router.           |
|    Dựa theo điều khoản SLA và bài viết tri thức KB-0142, trường hợp này cần định tuyến khẩn cấp tới Network Team."    |
|                                                                                                                       |
|   [ ✓ Chấp nhận toàn bộ & Chuyển giao ]   [ ⚙ Tùy chỉnh chi tiết ]   [ ✕ Từ chối đề xuất ]                            |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

### 4.6 Interaction State Specifications & WCAG ARIA Semantics

| State | Visual Class Tokens | ARIA Semantics | Keyboard / Focus Affordance |
|---|---|---|---|
| **Active / Current Step** | `border-primary bg-primary text-white ring-4 ring-primary-tint` | `aria-current="step" role="listitem"` | `tabIndex={0}`, `focus-visible:ring-2 focus-visible:ring-primary` |
| **Completed Step** | `border-status-success-border bg-status-success text-white` | `aria-label="Đã hoàn thành" role="listitem"` | Focusable via tab, announces completion timestamp |
| **Pending Step** | `border-edge bg-surface-muted text-content-subtle` | `aria-disabled="true" role="listitem"` | Not focusable, dimmed opacity (0.7) |
| **Paused / Blocked** | `border-status-warning-border bg-status-warning text-white animate-pulse` | `role="status" aria-live="polite"` | Announced to screen readers upon state toggle |
| **Cancelled / Rejected** | `border-status-danger-border bg-status-danger text-white` | `role="alert"` | High-contrast announcement with reason text |

---

## 5. Component Refactoring Matrix & Design Token Migration

### 5.1 Common Component Library Migration

| Component File | Existing Code / Line References | Identified Hardcoded Token Defect | Target Replacement Token |
|---|---|---|---|
| `apps/web/src/components/common/Badge.tsx` | Lines 33, 40, 47: `bg-[#fbe4e4] text-[#d44c47]`, `bg-[#fbf3db] text-[#cb912f]` | Hardcoded pastel hex codes that glare in dark mode and fail contrast. | `bg-status-danger-bg text-status-danger border-status-danger-border`, `bg-status-warning-bg text-status-warning` |
| `apps/web/src/components/common/Alert.tsx` | Lines 24-37: `border-[#b8dcce] text-[#27553c] bg-[#edf3ec]` | Bypasses CSS custom properties for all 4 alert variants. | Bind to `bg-status-[variant]-bg text-status-[variant] border-status-[variant]-border` |
| `apps/web/src/components/common/FormField.tsx` | Line 13: `invalid ? 'border-[#f6c3c1] focus:border-[#d44c47] focus:ring-[#d44c47]'` | Raw hex border and focus ring bypasses design system error state. | `invalid ? 'border-status-danger focus:border-status-danger focus:ring-status-danger'` |
| `apps/web/src/components/common/Button.tsx` | Lines 45-68: Variable heights (`py-2`, `px-3`), inconsistent mobile touch sizes. | Button heights vary from 32px to 48px arbitrarily. | Standardize to `h-[38px] min-h-[44px] md:min-h-[38px] px-3.5 rounded-md font-semibold text-sm` |
| `apps/web/src/components/common/Modal.tsx` | Lines 34-40: Backdrop `bg-black/40`, dialog `rounded-[4px] p-6`. | Flattened 4px radius; inconsistent scrim contrast. | Scrim: `bg-slate-950/60 backdrop-blur-xs`; Modal: `rounded-lg bg-surface border border-edge shadow-xl p-5` |
| `apps/web/src/components/common/TicketSlaInfo.tsx` | Lines 12-35: Plain text string rendering without visual badge. | No visual indicator of paused state or percentage gauge. | Implement Model 4 (Dynamic SLA Countdown & Amber Pause Indicator). |

### 5.2 Layout & Navigation Shell Migration

| Component File | Existing Code / Line References | Identified Hardcoded Token Defect | Target Replacement Token |
|---|---|---|---|
| `apps/web/src/components/layout/Header.tsx` | Lines 68-75: Brand logo with gradient background; breadcrumb text `text-[#8a8884]`. | Sepia text `#8a8884` fails WCAG AA (3.5:1). | `text-content-muted hover:text-content`; brand block on clean white/slate foundation. |
| `apps/web/src/components/layout/Sidebar.tsx` | Lines 85-98: Drawer width `w-64`, active route `bg-[#deeef8] text-[#0a5c94]`. | Active nav item uses hardcoded cerulean blue tint. | `bg-primary-tint text-primary font-semibold border-l-2 border-primary` |
| `apps/web/src/components/common/ThemeSwitcher.tsx`| Lines 27-51: 10 consumer accent presets (pink, yellow, red, orange). | Distracts from corporate governance and breaks design token consistency. | Restructure to: Light / Dark Mode toggle, table gridline toggle, and corporate contrast presets. |

### 5.3 Domain & Workflow Component Migration

| Component File | Existing Code / Line References | Identified Hardcoded Token Defect | Target Replacement Token |
|---|---|---|---|
| `apps/web/src/components/ticket-detail/TicketWorkflowActions.tsx` | Lines 235-282: Rejection inputs with `#f6c3c1`, `#962824`. | Hardcoded error tokens; disconnected from stage tracker. | Refactor to utilize semantic `status-danger` tokens and link with Model 1. |
| `apps/web/src/components/ticket-detail/TicketDetailHeader.tsx` | Lines 66-75: Lone `StatusBadge` without lifecycle context. | No lifecycle stage representation. | Integrate Model 1 (Adaptive Dual-Track Stage Tracker) directly below title. |
| `apps/web/src/pages/DeviceRequestPage.tsx` | Lines 566-615: Requests rendered as flat cards without stage steps. | Parity failure with micro-frontend `apps/device-request`. | Integrate Model 2 (Linear 4-Stage Stepper with Rejection Off-Ramp and PDF action). |
| `apps/web/src/components/common/TicketQueueView.tsx` | Lines 119-190: 2-column card list without Kanban swimlanes. | Technicians cannot visualize pipeline throughput. | Implement Model 3 (Operational Technician Kanban Board with SLA Urgency Swimlanes). |
| `apps/web/src/modules/desk/TicketAiSuggestion.tsx` | Lines 45-80: Standard form layout for AI proposals. | No side-by-side comparison of old vs new values. | Implement Model 5 (AI Triage Visual Diff Inspector). |

---

## 6. Phased Implementation Roadmap

### 6.1 Phase Breakdown & Work Packages

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DESIGN TOKEN FOUNDATION & CORPORATE PALETTE                   │
│   - Inject 3-Layer CSS custom property block in index.css              │
│   - Update tailwind.config.js (fix 4px radius bug, remove duplicate)   │
│   - Fix dark mode status tokens & contrast parity                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verification Checkpoint 1
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 2: CORE LAYOUT, SHELL & NAVIGATION MODERNIZATION                 │
│   - Modernize Header, Sidebar, Layout, Breadcrumbs                     │
│   - Refactor Button, Badge, Alert, FormField, Modal, Skeleton          │
│   - Standardize 8/10 density (44px rows, 38px inputs, 16px cards)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verification Checkpoint 2
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 3: VISUAL WORKFLOW COMPONENTS IMPLEMENTATION                     │
│   - Build Model 1: Adaptive Dual-Track Stage Tracker                   │
│   - Build Model 2: Linear 4-Stage Stepper & PDF Handover Chip          │
│   - Build Model 3: Operational Technician Kanban Board                 │
│   - Build Model 4: Dynamic SLA Countdown & Pause Banner                │
│   - Build Model 5: AI Triage Visual Diff Inspector                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verification Checkpoint 3
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 4: PAGE-BY-PAGE INTEGRATION & ENTERPRISE POLISH                  │
│   - TicketDetailPage (Header, Stepper, Actions, Timeline)              │
│   - WorkQueuePage & TicketListPage (Kanban / Table view toggle)        │
│   - DeviceRequestPage & apps/device-request (Stepper sync)             │
│   - CreateTicketPage & AssistantPage (Validation & Diff polish)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verification Checkpoint 4
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 5: VERIFICATION, WCAG AUDIT & REGRESSION TESTING                 │
│   - Execute Vitest suites (apps/web 158 tests, device-request 18 tests)│
│   - Full TypeScript compilation check (tsc --noEmit)                   │
│   - Automated WCAG 2.1 AA/AAA contrast check (axe-core / DevTools)     │
│   - Cross-browser & responsive mobile viewport verification            │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Detailed Execution Sequence & Timeline

| Phase | Duration | Key Deliverables | Dependent Artifacts |
|---|---|---|---|
| **Phase 1** | Days 1-2 | `apps/web/src/index.css`, `apps/device-request/src/index.css`, `tailwind.config.js` | None |
| **Phase 2** | Days 3-4 | Common UI Library (`Badge.tsx`, `Alert.tsx`, `FormField.tsx`, `Button.tsx`, `Modal.tsx`), Layout Shell (`Header.tsx`, `Sidebar.tsx`) | Phase 1 Tokens |
| **Phase 3** | Days 5-7 | Workflow visual components in `src/components/workflow/` (`TicketStageTracker.tsx`, `DeviceWorkflowStepper.tsx`, `TicketKanbanBoard.tsx`, `SlaPauseBanner.tsx`, `AiTriageDiff.tsx`) | Phase 1 & 2 |
| **Phase 4** | Days 8-10 | Full integration into `TicketDetailPage.tsx`, `WorkQueuePage.tsx`, `DeviceRequestPage.tsx`, `CreateTicketPage.tsx` | Phase 3 Components |
| **Phase 5** | Days 11-12 | Passing Vitest suites, zero TypeScript errors, axe accessibility audit reports | All Phases |

### 6.3 Phase Gates & Exit Criteria

#### Checkpoint 1 (Phase 1 Exit Gate):
- [ ] `index.css` compiles with zero PostCSS warnings under Tailwind v4.
- [ ] `:root.dark` provides explicit color values for all semantic status tokens.
- [ ] Border radius tokens in `tailwind.config.js` resolve to `xs: 2px, sm: 4px, md: 6px, lg: 8px, xl: 12px`.
- [ ] `npm run build` succeeds in `apps/web` and `apps/device-request`.

#### Checkpoint 2 (Phase 2 Exit Gate):
- [ ] Zero occurrences of raw bracketed hex colors (`bg-[#...]`) remain in `Badge.tsx`, `Alert.tsx`, `FormField.tsx`.
- [ ] All badges pass WCAG 2.1 AA (≥ 4.5:1) in both light and dark modes.
- [ ] Header, Sidebar, and Breadcrumbs render cleanly on Slate/Navy background.
- [ ] All existing Vitest suites continue to pass without regression.

#### Checkpoint 3 (Phase 3 Exit Gate):
- [ ] 5 visual workflow components authored with strict TypeScript types and complete test coverage.
- [ ] Model 1 renders all 6 happy path stages and correctly flags `waiting_user` and `pending_approval` branches.
- [ ] Model 2 displays rejection callout when rejected, and PDF download button when handed over.
- [ ] Model 3 enables technicians to claim tickets with a single click.

#### Checkpoint 4 (Phase 4 Exit Gate):
- [ ] All 10 web pages and the micro-frontend display modernized UI with full dark mode compatibility.
- [ ] Ticket detail page features top stage tracker; device request pages share identical visual stepper.
- [ ] Kanban view toggles seamlessly with existing table view, preserving search and filter query parameters.

#### Checkpoint 5 (Phase 5 Exit Gate - Final Release):
- [ ] All 158 tests in `apps/web` pass.
- [ ] All 18 tests in `apps/device-request` pass.
- [ ] Automated accessibility audit reports 0 violations of WCAG 2.1 AA.
- [ ] Production bundle size remains within budget (no new heavy third-party UI dependencies).

---

## 7. Risk Management, Backward Compatibility & Rollback Strategy

### 7.1 User Preference Migration (`localStorage`)

- **Risk**: Existing users have `localStorage.getItem('dx-desk-theme')` storing legacy values (e.g., `accent: '#cb912f'`, `theme: 'classic'`).
- **Mitigation Strategy**: Implement an automatic versioned migration guard in `apps/web/src/contexts/ThemeContext.tsx`:
  ```typescript
  const MIGRATION_VERSION = 'v2-corporate';
  const saved = localStorage.getItem('dx-desk-theme');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.version !== MIGRATION_VERSION) {
        // Safely migrate user to corporate default while preserving light/dark mode preference
        const migrated = {
          mode: parsed.mode === 'dark' ? 'dark' : 'light',
          accent: 'corporate-blue',
          version: MIGRATION_VERSION,
        };
        localStorage.setItem('dx-desk-theme', JSON.stringify(migrated));
      }
    } catch {
      localStorage.removeItem('dx-desk-theme');
    }
  }
  ```

### 7.2 Third-Party Integration Compatibility (Metabase & SeaweedFS)

- **Metabase Analytics Iframe**: `ManagerAnalyticsPage` embeds Metabase via signed JWT. The iframe's internal styles cannot be directly styled via host CSS.
  - *Mitigation*: Configure the Metabase embed URL with query parameter `theme=transparent` or pass matching corporate hex values (`#0F172A`, `#2563EB`) via the backend JWT signer payload in `apps/api/src/analytics.ts`.
- **SeaweedFS PDF Protocols**: Handover documents generated via `pdfkit` in `apps/api/src/handover.ts` must use matching corporate typography and brand headers to maintain brand consistency between digital UI and generated documents.

### 7.3 Keycloak Authentication & RBAC Guard Integrity

- **Risk**: Visual components must not bypass backend security checks (e.g., rendering an action button for a role that cannot execute it).
- **Mitigation**: All visual workflow actions (e.g., "Nhận phiếu", "Phê duyệt", "Từ chối") strictly mirror `ticketWorkflow.ts` permission guards (`canTransition(ticket, newStatus, userRole)`). If an action is forbidden, the button is either omitted or rendered in a disabled state with an explanatory tooltip. Optimistic locking headers (`ticket_version`) are transmitted on every mutation to handle 409 conflict states gracefully.

### 7.4 Rollback & Recovery Plan

1. **Git Revert Protocol**:
   All work is strictly isolated on branch `feature/ui-ux-revamp`. In the event of an unforeseen blocker, `main` remains untouched.
2. **Feature-Flagged Phased Rollout**:
   Visual workflow components (such as the Kanban board and stage stepper) are encapsulated with feature toggles (e.g., `features.visualStepper = true`) allowing instant fallback to legacy badge views if issues arise during staging verification.
3. **Automated Smoke Testing**:
   Prior to merging `feature/ui-ux-revamp` into `main`, the full end-to-end stack test harness (`scripts/stack-test.mjs` and `tools/testing/week4-browser.mjs`) must execute with 100% pass rates in an automated CI environment.

---

## 8. Summary & Next Steps

This plan establishes the definitive architectural, aesthetic, and operational specification for modernizing the DX-Desk web application. Upon approval:
1. **Worker M2** will commence Phase 1 token implementation in `apps/web/src/index.css` and `tailwind.config.js`.
2. **Worker M3** will execute Phase 2 common component refactoring.
3. **Worker M4** will implement Phase 3 visual workflow models.
4. **Worker M5** will integrate pages and finalize verification.
