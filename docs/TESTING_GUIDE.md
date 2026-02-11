# Approval Portal — Testing Guide

## Accounts Required

You need **minimum 3 accounts** to fully test all flows:

| Account | Role | Purpose |
|---|---|---|
| **Account A** | Requester | Submits requests |
| **Account B** | Approver (Manager) | Approves/rejects requests |
| **Account C** | Admin / Finance Approver | Second-stage approver for high-value purchases |

> If you only have 2 accounts, you can combine Approver + Admin into one account.

---

## Pre-Setup: Data to Fill in Lists

### `Config_ApprovalMatrix` (required — add these rows)

This list tells the app WHO approves WHAT. Without data here, approvals won't route.

| Title | RequestType | StageOrder | StageName | ApproverType | ApproverValue | Condition |
|---|---|---|---|---|---|---|
| Manager Review | Leave | 1 | Manager Approval | Static-User | *(pick Account B)* | `{}` |
| Manager Review | Purchase | 1 | Manager Approval | Static-User | *(pick Account B)* | `{}` |
| Finance Review | Purchase | 2 | Finance Approval | Static-User | *(pick Account C)* | `{"Amount":{">":1000}}` |
| Manager Review | Access | 1 | Manager Approval | Static-User | *(pick Account B)* | `{}` |

> **Note**: Use `Static-User` instead of `Dynamic-Manager` because Dynamic-Manager requires User Profile Service / Graph API integration (not implemented in MVP). Set the **ApproverValue** person field to the actual user account.

### `Main_Requests` — Leave empty (the app will create items)

### `Sys_AuditLog` — Leave empty (the app writes entries automatically)

### `Config_Delegations` — Leave empty for now (used in advanced testing)

---

## Test Scenarios

### Test 1: Submit a Leave Request
**Login as:** Account A (Requester)

1. Open the workbench page
2. Click the **"New Request"** dark card on the dashboard
3. Fill in:
   - Title: `Annual Leave - March`
   - Request Type: `Leave Request`
   - Start Date: any future date
   - End Date: a date after start
   - Business Justification: `Family vacation`
4. Click **Submit Request**

**Expected Result:**
- ✅ No error dialog
- ✅ Redirected back to the dashboard
- ✅ Go to **Main_Requests** list in SharePoint — you should see the new item with:
  - CurrentStatus = `Submitted`
  - StageID = `1`
  - Requester = Account A

---

### Test 2: Approve a Leave Request
**Login as:** Account B (Approver)

1. Open the workbench page
2. On the dashboard, you should see `Annual Leave - March` in the activity list
3. Click on it to open the detail view
4. You should see the **approval bar** at the bottom (Approve / Reject / Request Info)
5. Click **Approve**
6. In the dialog, type a comment: `Approved, enjoy your vacation`
7. Click **Confirm**

**Expected Result:**
- ✅ Request disappears from pending list
- ✅ In **Main_Requests** list: CurrentStatus = `Approved`, StageID = `99`
- ✅ In **Sys_AuditLog** list: new entry with Action = `Approve`, Actor = Account B

---

### Test 3: Submit a Small Purchase Request (Single Stage)
**Login as:** Account A (Requester)

1. Click **New Request**
2. Fill in:
   - Title: `Office Supplies`
   - Request Type: `Purchase Request`
   - Amount: `200`
   - Business Justification: `Need new whiteboard markers`
3. Click **Submit Request**

**Login as:** Account B (Approver)

4. Open the dashboard — see `Office Supplies` in activity
5. Click on it → Click **Approve** → Add comment → Confirm

**Expected Result:**
- ✅ Since Amount ($200) is NOT > $1000, the Finance stage is **skipped**
- ✅ Request goes directly to `Approved` (StageID = 99)
- ✅ Only 1 approval was needed

---

### Test 4: Submit a Large Purchase Request (Two Stages)
**Login as:** Account A (Requester)

1. Click **New Request**
2. Fill in:
   - Title: `New Laptop - MacBook Pro`
   - Request Type: `Purchase Request`
   - Amount: `2500`
   - Business Justification: `Current laptop is 5 years old`
3. Click **Submit Request**

**Login as:** Account B (Approver — Stage 1)

4. Open dashboard → see the request → Click **Approve** → Confirm

**Expected Result after Stage 1:**
- ✅ CurrentStatus changes to `Finance Approval` (not `Approved` yet!)
- ✅ CurrentAssignee changes to Account C
- ✅ StageID changes to `2`

**Login as:** Account C (Finance Approver — Stage 2)

5. Open dashboard → see the request → Click **Approve** → Confirm

**Expected Result after Stage 2:**
- ✅ CurrentStatus = `Approved`, StageID = `99`
- ✅ Two audit log entries exist (one per approval)

---

### Test 5: Reject a Request
**Login as:** Account A — Submit any request

**Login as:** Account B (Approver)

1. Open the request from the dashboard
2. Click **Reject**
3. Type comment: `Budget not available this quarter`
4. Click **Confirm**

**Expected Result:**
- ✅ CurrentStatus = `Rejected`, StageID = `99`
- ✅ Audit log shows Action = `Reject`

---

### Test 6: Request More Information
**Login as:** Account A — Submit any request

**Login as:** Account B (Approver)

1. Open the request from the dashboard
2. Click **Request Info**
3. Type comment: `Please provide vendor quotes`
4. Click **Confirm**

**Expected Result:**
- ✅ CurrentStatus = `Info Requested`
- ✅ StageID stays the same (doesn't advance)
- ✅ CurrentAssignee changes back to Account A (the requester)
- ✅ Audit log shows Action = `RequestInfo`

---

### Test 7: Submit on Behalf of Someone Else (Delegation)
**Login as:** Account A (Requester)

1. Click **New Request**
2. Toggle **"Submit on behalf of someone else?"** to ON
3. Search and select another user (e.g., Account C)
4. Fill in the rest of the form and submit

**Expected Result:**
- ✅ In Main_Requests: RequesterDelegate field is set to Account C
- ✅ Requester field is Account A (the actual submitter)

---

### Test 8: Permission Check — Unauthorized Approval
**Login as:** Account A (Requester — NOT an approver)

1. If you navigate directly to a request assigned to Account B
2. The approval bar should **NOT appear** (the code checks `CurrentAssigneeId === currentUser.Id`)

**Expected Result:**
- ✅ No Approve/Reject/Request Info buttons visible
- ✅ Only the "Back" button should be shown

---

### Test 9: History Tab
**Login as:** Account A (Requester)

1. Click the **History** icon (clock) in the sidebar
2. You should see all your submitted requests listed

**Expected Result:**
- ✅ Shows all requests submitted by Account A
- ✅ Clicking any item opens the detail view

---

## Quick Checklist

| # | Test | Accounts Used | Pass? |
|---|---|---|---|
| 1 | Submit Leave Request | A | ☐ |
| 2 | Approve Leave Request | B | ☐ |
| 3 | Small Purchase (skip finance) | A, B | ☐ |
| 4 | Large Purchase (2 stages) | A, B, C | ☐ |
| 5 | Reject a Request | A, B | ☐ |
| 6 | Request More Info | A, B | ☐ |
| 7 | Submit on Behalf | A | ☐ |
| 8 | Unauthorized Approval Block | A | ☐ |
| 9 | History Tab | A | ☐ |
