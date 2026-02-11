
export const ListNames = {
    MAIN_REQUESTS: "Main_Requests",
    CONFIG_APPROVAL_MATRIX: "Config_ApprovalMatrix",
    SYS_AUDIT_LOG: "Sys_AuditLog",
    CONFIG_DELEGATIONS: "Config_Delegations"
};

export interface IRequestItem {
    Id: number;
    Title: string;
    RequestType: string;
    RequesterId: number;
    Requester?: { Title: string, Email: string, Id: number };
    CurrentStatus: string;
    CurrentAssigneeId?: number;
    CurrentAssignee?: { Title: string, Email: string, Id: number };
    StageID: number;
    JSON_Payload: string;
    RequesterDelegateId?: number;
    Created: string;
}

export interface IApprovalMatrixItem {
    Id: number;
    RequestType: string;
    StageOrder: number;
    StageName: string;
    ApproverType: 'Dynamic-Manager' | 'Static-User' | 'Static-Group';
    ApproverValueId?: number;
    Condition: string; // JSON logic string
}

export interface IAuditLogItem {
    Id: number;
    Title: string; // Action
    RequestIDId: number;
    Action: string;
    ActorId: number;
    Timestamp: string;
    Comments: string;
    Snapshot: string;
}

export interface IDelegationItem {
    Id: number;
    ApproverId: number;
    DelegateId: number;
    StartDate: string;
    EndDate: string;
}
