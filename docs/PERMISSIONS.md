# Approval Portal — Permissions Guide

## User Roles

| Role | Who | Description |
|---|---|---|
| **Requester** | All employees | Submits requests |
| **Approver** | Managers / designated approvers | Assigned via the approval matrix |
| **Admin** | IT / App owner | Manages workflow configuration |

---

## List Permissions

### `Main_Requests`

| Role | Permission Level | Why |
|---|---|---|
| Requester | **Contribute** | Create items, read all (filtered by app) |
| Approver | **Contribute** | Read assigned items, update status |
| Admin | **Full Control** | Manage all requests |

> **Important**: Read access must be set to **"All items"**:
> List Settings → Advanced Settings → **Read access** → *"All items"*
>
> Data isolation is enforced at the **application level**: requesters only see their own items (`Requester/Id` filter) and approvers only see their assigned items (`CurrentAssignee/Id` filter). Do **not** use "Only their own" — it prevents approvers from viewing requests assigned to them.

### `Config_ApprovalMatrix`

| Role | Permission Level | Why |
|---|---|---|
| Requester | **Read** | Workflow engine reads this for routing |
| Approver | **Read** | Same |
| Admin | **Full Control** | Add/edit workflow stages |

### `Sys_AuditLog`

| Role | Permission Level | Why |
|---|---|---|
| Requester | **Read** | View history of their requests |
| Approver | **Contribute** | Code writes audit entries on actions |
| Admin | **Full Control** | View all audit history |

> **Important**: Read access must be set to **"All items"** so that approvers and requesters can view the full audit trail for a request (entries are created by different users at each stage).
>
> **Tip**: Make this list "Add items only" (no edit/delete for non-admins) to preserve audit integrity.

### `Config_Delegations`

| Role | Permission Level | Why |
|---|---|---|
| Requester | **No access** | Not needed |
| Approver | **Contribute** | Create/manage their own delegations |
| Admin | **Full Control** | Manage all delegations |

---

## Setup Steps

1. Create SharePoint groups: `ApprovalPortal - Requesters`, `ApprovalPortal - Approvers`, `ApprovalPortal - Admins`
2. On each list → **List Settings → Permissions** → Stop inheriting → assign levels from tables above
3. On `Main_Requests` → **Advanced Settings** → set Read access to **"All items"** (app-level filters handle data isolation)
4. On `Sys_AuditLog` → **Advanced Settings** → set Read access to **"All items"** (needed for full audit trail visibility)

The app uses the logged-in user's context (via PnPjs `web.currentUser()`) so SharePoint's native permission layer enforces access automatically — no custom permission code needed.
