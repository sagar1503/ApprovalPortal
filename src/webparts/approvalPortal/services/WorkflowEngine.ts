
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

        // 2. Audit Log
        const snapshot = JSON.stringify(request); // Snapshot state
        await this._dataService.logAudit(request.Id, action, comment, snapshot);

        if (action === 'Reject') {
            // Hard Stop
            await this._dataService.updateRequestStatus(request.Id, "Rejected", 99, undefined);
            return;
        }

        if (action === 'RequestInfo') {
            // Loop back to Requester
            await this._dataService.updateRequestStatus(request.Id, "Info Requested", request.StageID, request.RequesterId);
            return;
        }

        if (action === 'SubmitInfo') {
            // Requester has provided info.
            // We need to route it back to the stage approver.
            // We can reuse the stage logic below to re-calculate the approver.
            // Just let it fall through to the matrix logic, but ensure we are looking at the CURRENT stage, not the next one.
            const matrix = await this._dataService.getApprovalMatrix(request.RequestType);
            const currentStage = matrix.find(m => m.StageOrder === request.StageID);

            if (currentStage) {
                // Re-assign to stage approver
                let nextAssigneeId: number | undefined = undefined;
                if (currentStage.ApproverType === 'Static-User') {
                    nextAssigneeId = currentStage.ApproverValueId;
                } else if (currentStage.ApproverType === 'Dynamic-Manager') {
                    try {
                        let effectiveRequesterLogin = currentUser.LoginName;
                        // If there is a delegate, we might need that login, but usually 'requesterId' on the item is the submitter.
                        // Wait, if it was 'on behalf of', the manager logic should use the delegate.
                        // We need to fetch the original request item's requester delegate logic again?
                        // Actually, let's just use the same logic as 'handleTransition' would for a new stage, but explicitly for THIS stage.

                        // NOTE: We need the DELEGATE's login if it exists.
                        // The `request` object has `RequesterDelegateId`.
                        if (request.RequesterDelegateId) {
                            const delegateUser = await this._dataService.getUserById(request.RequesterDelegateId);
                            effectiveRequesterLogin = delegateUser.LoginName;
                        } else {
                            const requesterUser = await this._dataService.getUserById(request.RequesterId);
                            effectiveRequesterLogin = requesterUser.LoginName;
                        }

                        const managerId = await this._dataService.getManagerForUser(effectiveRequesterLogin);
                        if (managerId) nextAssigneeId = managerId;
                    } catch (e) {
                        console.warn('Manager lookup failed during SubmitInfo', e);
                    }
                    if (!nextAssigneeId && currentStage.ApproverValueId) {
                        nextAssigneeId = currentStage.ApproverValueId;
                    }
                }

                await this._dataService.updateRequestStatus(request.Id, currentStage.StageName, currentStage.StageOrder, nextAssigneeId);
                return;
            }
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
            return;
        }

        // 5. Resolve Next Approver
        let nextAssigneeId: number | undefined = undefined;

        if (nextStage.ApproverType === 'Static-User') {
            nextAssigneeId = nextStage.ApproverValueId;
        } else if (nextStage.ApproverType === 'Dynamic-Manager') {
            // Try to resolve manager from user profile first
            try {
                const requesterUser = await this._dataService.getUserById(request.RequesterId);
                const managerId = await this._dataService.getManagerForUser(requesterUser.LoginName);
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

        // 6. Commit Update
        await this._dataService.updateRequestStatus(request.Id, nextStage.StageName, nextStage.StageOrder, nextAssigneeId);
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
// Force recompile
