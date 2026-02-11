# Business Request & Approval Portal — Portfolio Case Study

---

## 🎯 Elevator Pitch (30 seconds)

> "I built a full-stack SharePoint Framework web part that replaces Power Automate workflows with a client-side state machine. It handles multi-stage approval routing, conditional stage logic, dynamic manager resolution, OOO delegation, and HTML email notifications — all running in the browser without any server-side dependency. Zero licensing cost, instant transitions, and enterprise-grade audit logging."

---

## 📋 Project Overview

| Item | Detail |
|------|--------|
| **Project** | Business Request & Approval Portal |
| **Type** | SPFx Web Part (Full-stack client-side) |
| **Problem** | Power Automate flows break on connection expiry, cost per-user/per-flow, take 5-10 min to trigger, and are fragile when approval matrices change |
| **Solution** | Client-side workflow engine that transitions requests in ~800ms, with zero Power Automate dependency |
| **Role** | Sole developer — architecture, design, implementation, testing |

---

## 🏗️ Architecture & Technical Decisions

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React.js (TypeScript) in SPFx 1.22 |
| UI | Fluent UI + Custom Design System (24px radius, Poppins font, glassmorphism sidebar) |
| Data | PnPjs v4 → SharePoint REST API (OData queries) |
| Charts | Chart.js + react-chartjs-2 |
| Email | `sp.utility.sendEmail` (in-context, no service account) |
| State Engine | Custom `WorkflowEngine` class (state machine pattern) |

### Data Model (4 SharePoint Lists)
```
Main_Requests ──────── The master request list (header + JSON payload)
Config_ApprovalMatrix ─ Configurable routing rules (who approves what, conditions)
Sys_AuditLog ────────── Immutable history (every action snapshotted)
Config_Delegations ──── OOO coverage (approver → delegate, date range)
```

### Key Architectural Choice: No Power Automate
Instead of server-side flows, the workflow engine is a **JavaScript class** (`WorkflowEngine.ts`) that runs in the approver's browser when they click "Approve." This means:
- **No licensing cost** (no per-user/per-flow PA charges)
- **No connection reference expiry** (the #1 cause of PA failures in enterprises)
- **Instant transitions** (~800ms vs PA's 5-10 min)
- **Admin can change the approval matrix** mid-flow without breaking running instances

---

## ⚡ Key Features I Built

### 1. Configurable Multi-Stage Workflow Engine
- `handleTransition()` algorithm: Validate → Audit → Determine Next Stage → Evaluate Conditions → Resolve Approver → Check Delegation → Commit → Notify
- Supports **conditional stage skipping** (e.g., Finance stage only triggers for amounts > $1,000)
- Condition parser handles nested JSON: `{"Amount":{">":1000}}`

### 2. Dynamic Approver Resolution
- **Dynamic-Manager**: Queries SharePoint User Profile Service to find the requester's manager
- **Static-User**: Reads from approval matrix configuration
- Fallback chain: Profile Service → Matrix fallback → Error handling

### 3. OOO Delegation System
- Queries `Config_Delegations` list to check if the resolved approver has an active delegate
- Automatically swaps the assignee if today falls within the delegation window
- Transparent to the requester

### 4. HTML Email Notifications
- Branded HTML emails sent via `sp.utility.sendEmail` on every workflow transition
- Four notification types: Action Required, Stage Update, Approved, Rejected
- Fire-and-forget pattern — email failures never block the workflow

### 5. Admin Portal
- SharePoint group-based role detection (`isUserInGroup`)
- Admins see all requests across the organization
- Standard users only see their own requests and assigned approvals

### 6. Custom UI (Not Default SharePoint)
- Designed a premium dashboard with metrics cards, doughnut analytics, hero header
- Floating sidebar navigation with glassmorphism effect
- Status badges, hover animations, responsive card layout
- Replaced Segoe UI with Poppins for modern app feel

---

## 🧠 Interview Talking Points

### "Tell me about a technical challenge you solved"
> "The approval matrix in SharePoint stored conditions as multi-line text with nested JSON like `{"Amount":{">":1000}}`. My initial condition parser assumed a flat string format and silently failed — every request triggered every stage regardless of the amount. I debugged it by adding instrumented logging at each evaluation step, identified the format mismatch, and rewrote the parser to handle both nested objects and flat strings with support for six comparison operators."

### "How did you handle security without item-level permissions?"
> "SharePoint item-level permissions don't scale past 5,000 items and can't be managed from client-side SPFx code. Instead, I used app-enforced security: the list is set to 'Read All Items' but every query includes OData filters like `Requester/Id eq currentUserId` or `CurrentAssignee/Id eq currentUserId`. Admins are gated via SharePoint group membership checks. This is the standard enterprise pattern used by large organizations."

### "Why not use Power Automate?"
> "Three reasons: First, PA flows break when connection references expire — this is the #1 support ticket in SharePoint. Second, PA has per-user licensing costs that scale with the organization. Third, PA triggers can take 5-10 minutes on busy tenants. My client-side engine transitions in under a second, has zero licensing dependency, and if the approval matrix changes, running requests automatically follow the new path on their next transition."

### "How do you handle edge cases like the approver being on leave?"
> "I built a delegation system with a `Config_Delegations` SharePoint list. Before committing a transition, the workflow engine checks if the resolved approver has an active delegation entry (date range check). If they do, it transparently swaps to the delegate. The requester doesn't even know — they just see it routed to the right person."

### "How is the audit trail implemented?"
> "Every action (Submit, Approve, Reject, Request Info) writes an entry to `Sys_AuditLog` with the actor, timestamp, comments, and a full JSON snapshot of the request at that moment. This is immutable and queryable — unlike SharePoint version history, which is hard to query programmatically. We use this to power the 'My Approval History' view."

---

## 💼 Cold Message / LinkedIn Template

### Short Version (InMail/DM)
> Hi [Name], I'm a SharePoint/M365 developer with hands-on experience building SPFx web parts. I recently built a Business Approval Portal that replaces Power Automate with a client-side workflow engine — multi-stage routing, conditional logic, OOO delegation, and email notifications, all running in the browser.
>
> I'm looking for part-time/contract SharePoint Online opportunities. Would love to chat if you have any openings. Happy to share a demo or walkthrough.

### Longer Version (Email)
> Subject: SPFx Developer — Built a No-Flow Approval Engine in SharePoint
>
> Hi [Name],
>
> I came across [Company]'s work with SharePoint/M365 and wanted to reach out. I'm a SharePoint Framework developer looking for part-time or contract work.
>
> My recent project is a **Business Request & Approval Portal** — a custom SPFx web part that handles multi-stage approval workflows entirely client-side, eliminating Power Automate dependency. Key highlights:
>
> • **Configurable workflow engine** with conditional stage routing (e.g., Finance approval only for amounts > $1,000)
> • **Dynamic manager resolution** via User Profile Service + configurable fallbacks
> • **OOO delegation** — auto-routes to delegate when approver is unavailable
> • **HTML email notifications** on every workflow transition
> • **Custom premium UI** — not the standard SharePoint look
>
> **Tech stack:** SPFx 1.22, React/TypeScript, PnPjs v4, Fluent UI, Chart.js
>
> I'd welcome the chance to discuss any SharePoint development needs you have. Happy to share a live demo or code walkthrough.
>
> Best regards,
> Sagar

---

## 📊 Resume Bullet Points

- Architected and developed a client-side approval workflow engine in SPFx, eliminating Power Automate dependency and reducing transition time from 5-10 minutes to under 1 second
- Designed configurable multi-stage approval routing with JSON-based conditional logic, dynamic manager resolution via User Profile Service, and OOO delegation
- Built enterprise-grade audit logging with immutable snapshots, powering real-time request tracking and approval history views
- Implemented branded HTML email notifications via SharePoint's sendEmail utility, triggered on all workflow transitions
- Created a custom premium UI with dashboard analytics, glassmorphism navigation, and responsive card-based layouts using Fluent UI and Chart.js

---

## 🛠️ Skills This Project Demonstrates

| Skill | Evidence |
|-------|---------|
| **SPFx Development** | Full web part with property pane, lifecycle management, deployment to App Catalog |
| **React + TypeScript** | Component architecture, state management, async data loading, error boundaries |
| **PnPjs v4** | CRUD operations, batch queries, User Profile Service, site groups, sendEmail |
| **SharePoint Data Modeling** | Relational list design, lookup columns, JSON payloads, OData filtering |
| **Workflow Design** | State machine pattern, condition evaluation, recursive stage skipping |
| **UI/UX Design** | Custom design system, SCSS modules, responsive layouts, accessibility |
| **Enterprise Architecture** | Security model, audit logging, delegation, performance optimization |
