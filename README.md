# Approval Portal

A robust SharePoint Framework (SPFx) application designed to streamline business approval workflows. This solution features a dynamic rule-based engine, customizable approval matrices, and comprehensive audit trails.

## 🚀 Features

-   **Dynamic Workflow Engine**: Automated transition of requests between stages based on configurable logic.
-   **Configurable Approval Matrix**: Define approval flows (Linear, Conditional, Dynamic Managers) without code changes via SharePoint Lists.
-   **Role-Based Access**: Specialized views for Requesters, Approvers, and Admins.
-   **Delegate Management**: Handle Out-of-Office scenarios with automatic task delegation.
-   **Audit Logging**: Detailed, immutable history of all actions, comments, and state changes.
-   **Email Notifications**: Automated alerts for approvals, rejections, information requests, and delegation.

## 🛠 Tech Stack

-   **Framework**: SharePoint Framework (SPFx) 1.22.2
-   **Frontend**: React 17, Fluent UI
-   **Data Interaction**: PnPjs v4
-   **Build Tools**: Gulp, Webpack, Heft

## 📦 Installation & Setup

### Prerequisites
-   Node.js v18+ (Recommended: v20 LTS or v22 LTS)
-   Gulp-cli
-   Yeoman & SharePoint Generator

### Local Development

1.  **Clone the repository**
    ```bash
    git clone https://github.com/sagar1503/ApprovalPortal.git
    cd ApprovalPortal/approval-portal
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run the Solution**
    ```bash
    gulp serve
    ```
    Access the local workbench at:
    `https://{tenant}.sharepoint.com/_layouts/15/workbench.aspx`

## ⚙️ Configuration

The application relies on the following SharePoint Lists. Ensure these are created in your site:

### 1. Main_Requests
Primary storage for all approval requests.
-   **Columns**: RequestType (Text), CurrentStatus (Text), StageID (Number), Requester (Person), CurrentAssignee (Person), JSON_Payload (Note).

### 2. Config_ApprovalMatrix
Defines the workflow steps and logic.
-   **Columns**: 
    -   RequestType (Text)
    -   StageOrder (Number)
    -   StageName (Text)
    -   ApproverType (Choice: 'Dynamic-Manager', 'Static-User', 'Static-Group')
    -   ApproverValueId (Number/Person)
    -   Condition (Note) - *JSON Logic e.g., `{"Amount": ">1000"}`*

### 3. Config_Delegations
Manages temporary approval reassignment.
-   **Columns**: Approver (Person), Delegate (Person), StartDate (Date), EndDate (Date).

### 4. Sys_AuditLog
Immutable log of all workflow actions.
-   **Columns**: RequestID (Lookup), Action (Text), Actor (Person), Comments (Note), Snapshot (Note), Timestamp (Date).

```mermaid
erDiagram
    Main_Requests ||--o{ Sys_AuditLog : "has history"
    Main_Requests }|--|| Config_ApprovalMatrix : "follows rules"
    Config_Delegations }|--|| Main_Requests : "approves on behalf"
    
    Main_Requests {
        int ID
        string Title
        string RequestType
        string CurrentStatus
        int StageID
        person Requester
        person CurrentAssignee
    }
    
    Config_ApprovalMatrix {
        string RequestType
        int StageOrder
        string StageName
        string Condition
    }
    
    Sys_AuditLog {
        int RequestID
        string Action
        person Actor
        string Comments
        datetime Timestamp
    }
```


## 🔮 Future Roadmap

-   **Microsoft Teams Integration**: Native Teams app with Adaptive Cards for seamless approvals directly in chat.
-   **Analytics Dashboard**: Power BI integration to track metrics like "Average Time to Approve" and identify bottlenecks.
-   **AI-Powered Insights**: Smart grouping of similar requests and anomaly detection for fraud prevention.
-   **Mobile Experience**: Dedicated, responsive PWA design for optimized on-the-go approvals.
-   **Document Attachments**: Support for file uploads (PDFs, Images) within requests.
-   **Multi-Language Support**: Localization to support global deployment.

## 🏗 Architecture

### Workflow Engine (`WorkflowEngine.ts`)
The core processing logic acting as a state machine. It handles:
-   **State Transitions**: Moving requests from Stage N to N+1.
-   **Validation**: Ensuring the current actor is authorized.
-   **Condition Evaluation**: determining if a stage should be skipped based on request data.
-   **Notification Dispatching**: Sending emails via `sp.utility.sendEmail`.

```mermaid
graph TD
    A[Start Transition] --> B{Validation}
    B -- Unauthorized --> Z[Error]
    B -- Authorized --> C{Action Type}
    
    C -- Reject --> D[Update Status: Rejected]
    D --> E[Notify Requester]
    
    C -- Request Info --> F[Update Status: Info Requested]
    F --> E
    
    C -- Provide Info --> G[Find Original Approver]
    G --> H[Restore Previous Stage]
    H --> I[Notify Approver]
    
    C -- Approve --> J[Unresolved Next Stage]
    J --> K{Check Conditions}
    K -- Skip --> J
    K -- Met --> L[Resolve Approver]
    
    L --> M{Delegation Check}
    M -- Active --> N[Assign to Delegate]
    M -- None --> O[Assign to Approver]
    
    N --> P[Update Request]
    O --> P
    P --> Q[Notify Next Approver]
```

### Data Service (`AppDataService.ts`)
Centralized layer for all SharePoint interactions using PnPjs.
-   Abstracts REST calls for Items, Profiles, and Emails.
-   Implements retry logic and error handling.

### Component Architecture

```mermaid
graph TD
    App[ApprovalPortalWebPart] --> Main[ApprovalPortal.tsx]
    
    Main --> Service[AppDataService]
    Main --> Engine[WorkflowEngine]
    
    Main --> Layout[PageLayout]
    Layout --> Sidebar[Sidebar Navigation]
    Layout --> Content{Active Tab}
    
    Content -- "My Requests" --> Dashboard[Dashboard Component]
    Content -- "Pending" --> Dashboard
    
    Dashboard --> List[RequestList]
    List --> Item[RequestItem]
    
    Content -- "New Request" --> Form[RequestForm]
    Form --> Validation[Form Validation]
```

## 📸 UI Gallery

> *Note: Placeholders for project screenshots.*

### Dashboard View
![Dashboard View](docs/images/dashboard_view.png)
*Central hub for managing approvals and tracking request status.*

### Request Submission Form
![Request Form](docs/images/Request_Form.png)
*Dynamic form for submitting new approval requests.*

### Request Details
![Request Details](docs/images/Approved_Request.png)
*Detailed view of an approved request.*

### History View
![History View](docs/images/History_View.png)
*Comprehensive list of all requests submitted and approvals made.*

### Admin Dashboard
![Admin Dashboard](docs/images/Admin_Page.png)
*Exclusive view for administrators to manage matrix configurations and system settings.*

## 📝 License
[MIT](LICENSE)