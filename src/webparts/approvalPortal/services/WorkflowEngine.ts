
import { AppDataService } from "./AppDataService";
import { IRequestItem, IApprovalMatrixItem } from "../ListSchema";

export class WorkflowEngine {
    private _dataService: AppDataService;

    constructor() {
        this._dataService = new AppDataService();
    }

    /**
     * The main brain. Transitions a request from one state to another.
     * @param request The full Request Item
     * @param action 'Approve', 'Reject', 'RequestInfo'
     * @param comment User comments
     * @param currentUser The user acting (Validation)
     */
    public async handleTransition(request: IRequestItem, action: string, comment: string, currentUser: any): Promise<void> {

        // 1. Validation (Security Check)
        // Ensure currentUser is indeed the CurrentAssignee or Delegate
        // For MVP, simple ID check.
        const assigneeId = request.CurrentAssignee?.Id || request.CurrentAssigneeId;
        if (assigneeId !== currentUser.Id) {
            console.warn("Security Alert: User attempted to approve task assigned to someone else.");
            throw new Error("You are not authorized to approve this request.");
        }

        // 2. Audit Log (Before change)
        const snapshot = JSON.stringify(request); // Snapshot state
        await this._dataService.logAudit(request.Id, action, comment, snapshot);

        // Helper: get requester email for notifications
        const getRequesterEmail = async (): Promise<string | undefined> => {
            try {
                return await this._dataService.getUserEmail(request.RequesterId);
            } catch { return undefined; }
        };

        if (action === 'Reject') {
            // Hard Stop
            await this._dataService.updateRequestStatus(request.Id, "Rejected", 99, undefined);

            // Email Requester
            const requesterEmail = await getRequesterEmail();
            if (requesterEmail) {
                await this._dataService.sendNotificationEmail(
                    [requesterEmail],
                    `❌ Your request #${request.Id} has been Rejected`,
                    this.buildEmailBody(request, 'Rejected', comment, currentUser.Title)
                );
            }
            return;
        }

        if (action === 'RequestInfo') {
            // Loop back to Requester
            await this._dataService.updateRequestStatus(request.Id, "Info Requested", request.StageID, request.RequesterId);

            // Email Requester
            const requesterEmail = await getRequesterEmail();
            if (requesterEmail) {
                await this._dataService.sendNotificationEmail(
                    [requesterEmail],
                    `ℹ️ Info Requested on your request #${request.Id}`,
                    this.buildEmailBody(request, 'Info Requested', comment, currentUser.Title)
                );
            }
            return;
        }

        if (action === 'ProvideInfo') {
            // Requester is responding to an info request — route back to the approver who asked
            // Find the approver from the audit log (the person who did "RequestInfo")
            const auditLogs = await this._dataService.getAuditLogs(request.Id);
            const infoRequestEntry = auditLogs.find(log => log.Action === 'RequestInfo');

            // Determine the stage name to restore — use approval matrix
            const matrix = await this._dataService.getApprovalMatrix(request.RequestType);
            const currentStage = matrix.find(m => m.StageOrder === request.StageID);
            const stageName = currentStage?.StageName || `Stage ${request.StageID}`;

            // The approver who requested info
            const previousApproverId = infoRequestEntry?.ActorId;

            if (previousApproverId) {
                await this._dataService.updateRequestStatus(request.Id, stageName, request.StageID, previousApproverId);

                // Email the approver: requester has responded
                try {
                    const approverEmail = await this._dataService.getUserEmail(previousApproverId);
                    if (approverEmail) {
                        await this._dataService.sendNotificationEmail(
                            [approverEmail],
                            `💬 Response received: Request #${request.Id} — ${request.Title}`,
                            this.buildEmailBody(request, stageName, comment, currentUser.Title, true)
                        );
                    }
                } catch (err) {
                    console.warn('[WorkflowEngine] Failed to email approver after info response:', err);
                }
            } else {
                // Fallback: couldn't determine who asked — restore status with no assignee change
                console.warn('[WorkflowEngine] Could not find original approver from audit log, restoring stage name only');
                await this._dataService.updateRequestStatus(request.Id, stageName, request.StageID, undefined);
            }
            return;
        }

        // 3. Determine Next Step (Approve)
        const matrix = await this._dataService.getApprovalMatrix(request.RequestType);
        const currentStageOrder = matrix.find(m => m.StageOrder === request.StageID)?.StageOrder || 0; // If stage 0, next is 1.

        let nextStage: IApprovalMatrixItem | undefined = matrix.find(m => m.StageOrder > currentStageOrder);

        // 4. Evaluate Conditions (Skip Logic)
        // If next stage has condition, check it.
        // Recursive check needed if we skip multiple.
        while (nextStage && nextStage.Condition && nextStage.Condition.trim() !== '' && nextStage.Condition.trim() !== '{}') {
            console.log(`[WorkflowEngine] Evaluating condition for stage "${nextStage.StageName}":`, nextStage.Condition, 'against payload:', request.JSON_Payload);
            const shouldSkip = !this.evaluateCondition(nextStage.Condition, request.JSON_Payload);
            console.log(`[WorkflowEngine] Stage "${nextStage.StageName}" shouldSkip =`, shouldSkip);
            if (shouldSkip) {
                // Skip to next
                const skippedStageOrder = nextStage.StageOrder;
                nextStage = matrix.find(m => m.StageOrder > skippedStageOrder);
            } else {
                break; // Condition Met, this is the stage.
            }
        }

        if (!nextStage) {
            // No more stages -> Approved!
            await this._dataService.updateRequestStatus(request.Id, "Approved", 99, undefined);

            // Email Requester: your request is approved
            const requesterEmail = await getRequesterEmail();
            if (requesterEmail) {
                await this._dataService.sendNotificationEmail(
                    [requesterEmail],
                    `✅ Your request #${request.Id} has been Approved`,
                    this.buildEmailBody(request, 'Approved', comment, currentUser.Title)
                );
            }
            return;
        }

        // 5. Resolve Next Approver
        let nextAssigneeId: number | undefined = undefined;

        if (nextStage.ApproverType === 'Static-User') {
            nextAssigneeId = nextStage.ApproverValueId;
        } else if (nextStage.ApproverType === 'Dynamic-Manager') {
            // Try to resolve manager from user profile first
            try {
                const requesterLogin = await this._dataService.getUserLoginName(request.RequesterId);
                const managerId = await this._dataService.getManagerForUser(requesterLogin);
                if (managerId) {
                    console.log('Resolved manager from user profile, ID:', managerId);
                    nextAssigneeId = managerId;
                }
            } catch (err) {
                console.warn('Profile manager lookup failed:', err);
            }

            // Fallback: if no manager found in profile, use the ApproverValue from the matrix
            if (!nextAssigneeId && nextStage.ApproverValueId) {
                console.log('No manager in profile — falling back to ApproverValue from matrix');
                nextAssigneeId = nextStage.ApproverValueId;
            }
        }

        // 5b. Delegation Check — If the resolved approver has an active OOO delegation, swap
        if (nextAssigneeId) {
            try {
                const delegateId = await this._dataService.getActiveDelegation(nextAssigneeId);
                if (delegateId) {
                    console.log(`[WorkflowEngine] Delegation swap: ${nextAssigneeId} → ${delegateId}`);
                    nextAssigneeId = delegateId;
                }
            } catch (err) {
                console.warn('[WorkflowEngine] Delegation check failed, using original approver:', err);
            }
        }

        // 6. Commit Update
        await this._dataService.updateRequestStatus(request.Id, nextStage.StageName, nextStage.StageOrder, nextAssigneeId);

        // 7. Email Notifications
        // Email the next approver
        if (nextAssigneeId) {
            try {
                const approverEmail = await this._dataService.getUserEmail(nextAssigneeId);
                if (approverEmail) {
                    await this._dataService.sendNotificationEmail(
                        [approverEmail],
                        `🔔 Action Required: Request #${request.Id} — ${request.Title}`,
                        this.buildEmailBody(request, nextStage.StageName, comment, currentUser.Title, true)
                    );
                }
            } catch (err) {
                console.warn('[WorkflowEngine] Failed to email next approver:', err);
            }
        }

        // Email the requester about the stage transition
        const requesterEmail = await getRequesterEmail();
        if (requesterEmail) {
            await this._dataService.sendNotificationEmail(
                [requesterEmail],
                `📋 Update: Your request #${request.Id} moved to ${nextStage.StageName}`,
                this.buildEmailBody(request, nextStage.StageName, comment, currentUser.Title)
            );
        }
    }

    /**
     * Builds an HTML email body for workflow notifications.
     */
    private buildEmailBody(
        request: IRequestItem,
        status: string,
        comment: string,
        actorName: string,
        isActionRequired: boolean = false
    ): string {
        const actionLine = isActionRequired
            ? `<p style="color: #E56B4E; font-weight: 600; font-size: 16px;">⚡ This request requires your action.</p>`
            : '';

        const commentLine = comment
            ? `<p><strong>Comment:</strong> ${comment}</p>`
            : '';

        return `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4F46E5, #6366F1); padding: 20px 24px; border-radius: 12px 12px 0 0;">
                    <h2 style="color: white; margin: 0; font-size: 18px;">Approval Portal Notification</h2>
                </div>
                <div style="background: #ffffff; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
                    ${actionLine}
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6B7280; width: 120px;">Request ID</td>
                            <td style="padding: 8px 0; font-weight: 600;">#${request.Id}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6B7280;">Title</td>
                            <td style="padding: 8px 0; font-weight: 600;">${request.Title}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6B7280;">Type</td>
                            <td style="padding: 8px 0;">${request.RequestType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6B7280;">Status</td>
                            <td style="padding: 8px 0;">
                                <span style="background: ${status === 'Approved' ? '#D1FAE5' : status === 'Rejected' ? '#FEE2E2' : '#EDE9FE'}; color: ${status === 'Approved' ? '#059669' : status === 'Rejected' ? '#DC2626' : '#7C3AED'}; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${status}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6B7280;">Action By</td>
                            <td style="padding: 8px 0;">${actorName}</td>
                        </tr>
                    </table>
                    ${commentLine}
                    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 16px 0;" />
                    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">This is an automated notification from the Approval Portal.</p>
                </div>
            </div>
        `;
    }

    /**
     * Evaluates a condition JSON against the request payload.
     * Supports two formats:
     *   - Nested object: {"Amount":{">":1000}}
     *   - Flat string:   {"Amount":">1000"}
     * Returns true if condition IS met (stage should be included).
     * Returns false if condition is NOT met (stage should be skipped).
     */
    private evaluateCondition(conditionJson: string, payloadJson: string): boolean {
        try {
            if (!conditionJson || conditionJson.trim() === '' || conditionJson.trim() === '{}') {
                return true; // No condition = always include this stage
            }

            const condition = JSON.parse(conditionJson);
            const payload = JSON.parse(payloadJson || '{}');

            for (const key in condition) {
                if (!Object.prototype.hasOwnProperty.call(condition, key)) continue;
                const rule = condition[key];
                const actualValue = parseFloat(payload[key]); // Coerce to number

                console.log(`[WorkflowEngine] Condition check: key="${key}", rule=`, rule, `, actual=${actualValue}`);

                if (isNaN(actualValue)) {
                    console.warn(`[WorkflowEngine] Payload key "${key}" is not a number:`, payload[key]);
                    return true; // Default to include stage if we can't parse
                }

                // Format 1: Nested object — {"Amount": {">": 1000}}
                if (typeof rule === 'object' && rule !== null) {
                    for (const operator in rule) {
                        if (!Object.prototype.hasOwnProperty.call(rule, operator)) continue;
                        const limit = parseFloat(rule[operator]);
                        if (isNaN(limit)) continue;

                        console.log(`[WorkflowEngine] Comparing: ${actualValue} ${operator} ${limit}`);

                        if (operator === '>' && !(actualValue > limit)) return false;
                        if (operator === '>=' && !(actualValue >= limit)) return false;
                        if (operator === '<' && !(actualValue < limit)) return false;
                        if (operator === '<=' && !(actualValue <= limit)) return false;
                        if (operator === '=' && !(actualValue === limit)) return false;
                        if (operator === '==' && !(actualValue === limit)) return false;
                        if (operator === '!=' && !(actualValue !== limit)) return false;
                    }
                }
                // Format 2: Flat string — {"Amount": ">1000"}
                else if (typeof rule === 'string') {
                    if (rule.startsWith(">")) {
                        const limit = parseFloat(rule.substring(1));
                        if (actualValue <= limit) return false;
                    } else if (rule.startsWith("<")) {
                        const limit = parseFloat(rule.substring(1));
                        if (actualValue >= limit) return false;
                    } else if (rule.startsWith("=")) {
                        const limit = parseFloat(rule.substring(1));
                        if (actualValue !== limit) return false;
                    }
                }
            }
            return true; // All conditions met
        } catch (e) {
            console.error("[WorkflowEngine] Condition parsing failed:", e, "conditionJson:", conditionJson);
            return true; // Default to include stage if error
        }
    }
}
