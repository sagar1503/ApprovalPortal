
import { SPFI } from "@pnp/sp";
import { getSP } from "../pnpjsConfig";
import { ListNames, IRequestItem, IApprovalMatrixItem, IAuditLogItem, IDelegationItem } from "../ListSchema";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/batching";
import "@pnp/sp/site-groups";
import "@pnp/sp/site-groups/web";
import "@pnp/sp/sputilities";
import { IEmailProperties } from "@pnp/sp/sputilities";

export class AppDataService {
    private _sp: SPFI;

    constructor() {
        this._sp = getSP();
    }

    public async getCurrentUser(): Promise<any> {
        return await this._sp.web.currentUser();
    }

    public async getMyRequests(userId: number): Promise<IRequestItem[]> {
        return await this._sp.web.lists.getByTitle(ListNames.MAIN_REQUESTS).items
            .select("Id", "Title", "RequestType", "CurrentStatus", "StageID", "Created", "Requester/Title", "Requester/Id", "RequesterId", "RequesterDelegateId", "RequesterDelegate/Title", "RequesterDelegate/Id", "CurrentAssignee/Title", "CurrentAssignee/Id", "CurrentAssigneeId")
            .expand("Requester", "RequesterDelegate", "CurrentAssignee")
            .filter(`Requester/Id eq ${userId} or RequesterDelegateId eq ${userId}`)
            .orderBy("Created", false)();
    }

    public async getPendingApprovals(userId: number): Promise<IRequestItem[]> {
        // Also check for delegations!
        // For MVP, just direct assignment.
        return await this._sp.web.lists.getByTitle(ListNames.MAIN_REQUESTS).items
            .select("Id", "Title", "RequestType", "CurrentStatus", "StageID", "Created", "Requester/Title", "Requester/Id", "RequesterId", "RequesterDelegateId", "RequesterDelegate/Title", "RequesterDelegate/Id", "CurrentAssignee/Title", "CurrentAssignee/Id", "CurrentAssigneeId", "JSON_Payload")
            .expand("Requester", "RequesterDelegate", "CurrentAssignee")
            .filter(`CurrentAssignee/Id eq ${userId}`)
            .orderBy("Created", false)();
    }

    /** Fetches ALL requests (for admin view). */
    public async getAllRequests(): Promise<IRequestItem[]> {
        return await this._sp.web.lists.getByTitle(ListNames.MAIN_REQUESTS).items
            .select("Id", "Title", "RequestType", "CurrentStatus", "StageID", "Created", "Requester/Title", "Requester/Id", "RequesterId", "RequesterDelegateId", "RequesterDelegate/Title", "RequesterDelegate/Id", "CurrentAssignee/Title", "CurrentAssignee/Id", "CurrentAssigneeId", "JSON_Payload")
            .expand("Requester", "RequesterDelegate", "CurrentAssignee")
            .orderBy("Created", false)
            .top(500)();
    }

    /** Checks if the current user belongs to a specific SharePoint group. */
    public async isUserInGroup(groupName: string): Promise<boolean> {
        try {
            const groups = await this._sp.web.currentUser.groups();
            return groups.some((g: any) => g.Title === groupName);
        } catch (err) {
            console.warn('Could not check group membership:', err);
            return false;
        }
    }

    public async getApprovalMatrix(requestType: string): Promise<IApprovalMatrixItem[]> {
        return await this._sp.web.lists.getByTitle(ListNames.CONFIG_APPROVAL_MATRIX).items
            .select("Id", "Title", "RequestType", "StageOrder", "StageName", "ApproverType", "ApproverValueId", "Condition")
            .filter(`RequestType eq '${requestType}'`)
            .orderBy("StageOrder", true)();
    }

    public async createRequest(request: Partial<IRequestItem>): Promise<void> {
        await this._sp.web.lists.getByTitle(ListNames.MAIN_REQUESTS).items.add(request);
    }

    public async updateRequestStatus(id: number, status: string, stageId: number, assigneeId?: number): Promise<void> {
        const updateData: any = {
            CurrentStatus: status,
            StageID: stageId
        };
        if (assigneeId) {
            updateData.CurrentAssigneeId = assigneeId;
        }
        await this._sp.web.lists.getByTitle(ListNames.MAIN_REQUESTS).items.getById(id).update(updateData);
    }

    public async logAudit(requestId: number, action: string, comments: string, snapshot: string): Promise<void> {
        const user = await this.getCurrentUser();
        await this._sp.web.lists.getByTitle(ListNames.SYS_AUDIT_LOG).items.add({
            Title: action,
            RequestIDId: requestId,
            Action: action,
            ActorId: user.Id,
            Comments: comments,
            Snapshot: snapshot,
            Timestamp: new Date().toISOString()
        });
    }

    public async getAuditLogs(requestId: number): Promise<IAuditLogItem[]> {
        return await this._sp.web.lists.getByTitle(ListNames.SYS_AUDIT_LOG).items
            .select("Id", "Title", "Action", "ActorId", "Timestamp", "Comments", "Snapshot", "RequestIDId")
            .filter(`RequestIDId eq ${requestId}`)
            .orderBy("Timestamp", false)();
    }

    /**
     * Gets all request IDs the user has acted on (from audit log),
     * then fetches those request items for the "approval history" view.
     */
    public async getMyApprovalHistory(userId: number): Promise<IRequestItem[]> {
        try {
            // Step 1: Get distinct request IDs from audit log where this user was the actor
            const auditEntries = await this._sp.web.lists.getByTitle(ListNames.SYS_AUDIT_LOG).items
                .select("RequestIDId")
                .filter(`ActorId eq ${userId}`)
                .orderBy("Timestamp", false)
                .top(200)();

            // Step 2: Deduplicate request IDs
            const requestIds = Array.from(new Set(auditEntries.map((e: any) => e.RequestIDId).filter(Boolean)));

            if (requestIds.length === 0) return [];

            // Step 3: Fetch those request items
            // Build an OR filter for all request IDs
            const idFilter = requestIds.map(id => `Id eq ${id}`).join(' or ');
            return await this._sp.web.lists.getByTitle(ListNames.MAIN_REQUESTS).items
                .select("Id", "Title", "RequestType", "CurrentStatus", "StageID", "Created", "Requester/Title", "Requester/Id", "RequesterId", "RequesterDelegateId", "RequesterDelegate/Title", "RequesterDelegate/Id", "CurrentAssignee/Title", "CurrentAssignee/Id", "CurrentAssigneeId", "JSON_Payload")
                .expand("Requester", "RequesterDelegate", "CurrentAssignee")
                .filter(idFilter)
                .orderBy("Created", false)();
        } catch (err) {
            console.warn('Could not load approval history:', err);
            return [];
        }
    }

    /**
     * Resolves the manager for a given user login name using SharePoint User Profile Service.
     * Returns the manager's site user ID, or undefined if no manager is found.
     */
    public async getManagerForUser(userLoginName: string): Promise<number | undefined> {
        try {
            const profileProps = await this._sp.profiles.getPropertiesFor(userLoginName);
            const managerProp = profileProps.UserProfileProperties?.find(
                (p: any) => p.Key === 'Manager'
            );

            if (managerProp && managerProp.Value) {
                // Manager value is a login name like "i:0#.f|membership|user@domain.com"
                const managerLogin = managerProp.Value;
                // Resolve to a site user to get the Id
                const managerUser = await this._sp.web.ensureUser(managerLogin);
                return managerUser.Id;
            }
            return undefined;
        } catch (err) {
            console.warn('Could not resolve manager from profile:', err);
            return undefined;
        }
    }

    public async getUserById(userId: number): Promise<any> {
        return await this._sp.web.getUserById(userId)();
    }


}
