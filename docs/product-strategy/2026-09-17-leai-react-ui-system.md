# LEAI React UI System

**Status:** Proposed implementation contract for owner review.

## 1. Purpose

This document defines the visual and interaction system for the React rewrite.
It prevents each page from independently choosing components, spacing, copy,
responsive behavior, and state treatment. It does not prescribe a rigid mockup
for every screen.

shadcn/ui is the source for accessible primitives, not LEAI's product identity.
Installed component source belongs to LEAI and is adapted through shared tokens
and product-level composites. Tailwind utilities are the implementation API for
those tokens; arbitrary values and one-off color choices are exceptions.

Official references:

- [shadcn/ui principles](https://ui.shadcn.com/docs)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Vite setup](https://ui.shadcn.com/docs/installation/vite)
- [Tailwind theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind responsive design](https://tailwindcss.com/docs/responsive-design)
- [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)

## 2. Design character

LEAI is an instructor workbench, not a generic SaaS dashboard and not a Canvas
clone. It should feel calm, editorial, and operational: one clear decision at a
time, dense enough for real course work, and quiet enough for long reading and
editing sessions.

Principles:

1. **Structure carries meaning.** Borders, spacing, section headings, and color
   distinguish account, course, mode, and status. They are not decoration.
2. **Progressive disclosure by default.** Keep one short explanation visible.
   Put secondary definitions and boundaries in an accessible info popover.
3. **One status, one home.** Autosave, Team setup, publication, and environment
   states each have one persistent location. Temporary feedback may reinforce an
   action but must not duplicate the full explanation.
4. **Stable geometry.** Tab changes, empty states, and help content do not move
   the wizard footer or resize the outer Builder. Only intended inner regions
   scroll.
5. **Responsive by content pressure.** Components reflow when their available
   width becomes inadequate after navigation rails, not from device names alone.
6. **Motion explains change.** Use motion for open/close, save, progress,
   selection, and newly created content. Avoid ambient card animation.

## 3. Foundation tokens

The initial palette preserves recognizable LEAI continuity while removing the
current proliferation of ad hoc colors:

| Role | Initial value | Use |
| --- | --- | --- |
| Pacific | `#006493` | primary actions, focus accents, links |
| Pacific strong | `#005881` | hover/pressed primary state |
| Ink | `#2A3437` | primary text |
| Slate | `#566164` | secondary text |
| Canvas | `#F8FAFB` | application background |
| Paper | `#FFFFFF` | editable and elevated surfaces |
| Course rail | `#2D3B45` | course-level navigation |
| Team | `#2E7D57` | Team identity and subtle tint source |
| Guided | `#D97706` | Guided identity and subtle tint source |

These values enter Tailwind through `@theme` and semantic CSS variables. React
components use names such as `bg-background`, `text-foreground`,
`bg-primary`, `text-muted-foreground`, and `border-border`, not raw hex values.
Mode colors are informational and never the only carrier of meaning.

Required token groups:

- surfaces and foreground pairs: background, card, popover, muted, sidebar;
- actions: primary, secondary, destructive, link;
- state: success, warning, error, information;
- mode: individual, team, guided, open;
- typography: page title, section title, body, supporting, label, code/data;
- spacing, radius, shadow, focus ring, motion duration, and breakpoints.

Default body text stays under roughly 80 characters per line. Sentence case is
the default. Uppercase eyebrow labels are removed unless they encode a genuine
system category that is otherwise hard to scan.

## 4. Component layers

### 4.1 Upstream primitives

Install only when used by an approved pattern:

- Button, Button Group, Input, Input Group, Textarea, Label
- Checkbox, Radio Group, Select, Switch
- Card, Separator, Badge, Progress, Skeleton, Empty
- Dialog, AlertDialog, Sheet, Popover, Tooltip, Dropdown Menu
- Tabs, Scroll Area, Collapsible
- Sonner for transient cross-surface outcomes

Do not install the upstream component catalog wholesale. Community registry
components require source review before adoption.

### 4.2 LEAI product components

These components own product semantics and may compose several primitives:

| Component | Responsibility |
| --- | --- |
| `AppShell` | environment bar, account rail, course navigation, content region |
| `AccountRail` | Account and All Courses only; collapses into a mobile Sheet |
| `CourseNavigation` | tools belonging to the active course |
| `PageHeader` | one page title, optional short support line, contextual actions |
| `SurveyCard` | mode, status, schedule, sessions, link, supported actions |
| `WorkflowStepper` | five-step progress and navigation; not implemented as Tabs |
| `BuilderFrame` | fixed header/stepper/footer with one scrollable content region |
| `MessageThread` | user bubbles and open Markdown AI responses |
| `AIComposer` | expanding message input, microphone, arrow-send action |
| `AutosaveStatus` | Saving, Saved just now, elapsed save age |
| `ArtifactEditor` | title, mode, History, sections, questions, add/reorder/remove |
| `TeamSetupStatus` | setup-required state and setup action |
| `PreviewLauncher` | concise preview state and one primary action |
| `PublishHandoff` | completion, Builder close, new-card focus/highlight |
| `StudentConversation` | anonymous entry, Team selection, conversation, completion |

`components/ui/` contains owned primitive source. Product components live in
feature or shared-component folders and do not modify primitive behavior for a
single page.

## 5. Page-pattern mapping

### 5.1 Account and course shell

- Desktop: compact `AccountRail` plus `CourseNavigation`.
- Small laptop/tablet: course navigation may collapse; account actions use a
  Sheet or menu rather than compressing labels.
- Mobile: one top bar opens deliberate Account and Course sections.
- `All Courses` exists only at account level.

Use Sidebar/Sheet, Breadcrumb where location is otherwise ambiguous,
DropdownMenu for account actions, and Skeleton for account/course loading.

### 5.2 Feedback home

Use a two-region responsive layout only when both regions remain readable:

- creation/resume area;
- published Survey list.

Survey filters use All, Individual, and Team, with Guided/Open refinement only
inside Individual. Cards use subtle mode tint, not saturated blocks. A resume
button appears only when an actual resumable draft exists; status copy sits
with that action rather than in a separate explanation panel.

### 5.3 Builder

`BuilderFrame` is a Dialog-like application surface but has its own product
layout. Backdrop clicks and Escape do not close it. The close button triggers an
AlertDialog explaining that saved work remains available.

The stepper is a real ordered workflow. `Back` remains on the far left;
continue/publish actions remain on the far right. Footer placement is stable.
Tabs inside a step may switch bounded content such as LEAI/My/Community
templates, but tab contents share a stable minimum content height.

### 5.4 AI and manual workspace

Desktop uses chat and artifact panels. At constrained content width they stack
or switch views rather than squeeze both columns.

- User messages: quiet tinted bubble aligned to the sending side.
- AI messages: open Markdown content with no enclosing chat bubble.
- Composer: one rounded input surface, microphone button, arrow-send button.
- No plus button or model selector.
- Tooltips and popovers use portals and never affect panel geometry.
- Autosave belongs in the artifact header beside History.

### 5.5 Preview

Show one concise statement, the real-student-data warning when relevant, and one
`Open student preview` action. Do not repeat the survey title, optionality, new
tab behavior, and completion state across multiple blocks.

Output settings use Switch plus a short label. Detailed definitions live in an
info popover. Switch movement is animated, with reduced-motion fallback.

### 5.6 Publish and completion

Publish uses a responsive Form plus a compact summary. Date fields stack before
their labels or native controls become crowded.

After success:

1. close the Builder automatically or through one `Complete` action;
2. focus and briefly highlight the new Survey card;
3. keep the share link only on that card;
4. provide Edit settings, Create revised version, and Close/Reopen only when
   supported by the backend capability state.

### 5.7 Team setup later

Publication and copying remain available. Use exactly three coordinated states:

1. Survey card: persistent `Team setup required` badge and `Set up teams` action.
2. Copy action: non-blocking `Link copied. Set up teams before students can
   begin.` confirmation.
3. Student page: one blocking pending state until team labels exist.

Do not add a repeated page banner, copy-confirmation modal, or explanatory
paragraph inside every workflow step.

### 5.8 Supporting tools

- Analyzer: filters, evidence cards, tables, and empty/unavailable states.
- Feedback Chat: same `MessageThread` and `AIComposer` grammar as the Builder.
- Course Banner and Customizations: Field/Form patterns with an explicit preview
  when visual output changes.
- Save to My Templates: focused Dialog, never an expanding block inside Publish.

## 6. Interaction-state contract

Every asynchronous product component defines:

- idle;
- loading or preparing;
- empty;
- success;
- validation failure;
- authorization/session expiry;
- network/server failure;
- conflict or stale version;
- retrying;
- unsupported capability where applicable.

Global toast messages are for cross-surface outcomes. Field and workflow errors
remain beside the affected control. Tooltips explain controls; they do not carry
essential warnings, error recovery, or information required to complete a task.

## 7. Responsive contract

- Build mobile-first with unprefixed utilities, then add changes at wider
  breakpoints.
- Use container queries for reusable panels whose available width depends on
  navigation or split panes.
- Verify usable content widths, not viewport labels alone.
- No page-level horizontal scrolling at 390, 820, 1022, or 1440 CSS pixels.
- Native date/time, select, upload, and microphone controls must be tested in
  WebKit/Safari as well as Chromium and Firefox.
- Footer actions remain reachable with the software keyboard open.

Tailwind class variants are static maps. Components must not construct class
names such as `bg-${mode}-500`, because Tailwind source scanning cannot reliably
generate them.

## 8. Accessibility and motion

Target WCAG 2.2 AA. Release evidence includes:

- semantic headings and landmarks;
- complete keyboard operation and visible focus;
- focus containment and restoration for Dialog, AlertDialog, Sheet, and menus;
- accessible names/descriptions for icon-only controls;
- live-region behavior for saving, recording, generation, and publication;
- 200% and 400% zoom/reflow;
- contrast, forced-colors, reduced motion, touch targets, and error recovery;
- screen-reader checks on the Builder, Student conversation, and Team selection.

Radix primitives provide a baseline for semantics, focus, and keyboard behavior;
LEAI remains responsible for labels, composition, content order, and testing.

## 9. Governance

- `components.json`, global theme CSS, and primitive source are reviewed code.
- Updating shadcn components is a source diff, never an unreviewed overwrite.
- Product components require stories or a local pattern-gallery route covering
  normal, compact, empty, loading, error, and disabled states.
- New ad hoc color, shadow, radius, or spacing values require a documented token
  decision or remain local to a true one-off illustration.
- The implementation plan maps each page to these patterns; it does not create
  a second page-specific design system.
