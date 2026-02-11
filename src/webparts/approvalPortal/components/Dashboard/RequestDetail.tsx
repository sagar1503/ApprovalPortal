
import * as React from 'react';
import styles from '../Forms/RequestForm.module.scss';
import { IRequestItem, IAuditLogItem } from '../../ListSchema';
import { ApprovalCommandBar } from '../Logic/ApprovalCommandBar';
import { AppDataService } from '../../services/AppDataService';

export interface IRequestDetailProps {
    request: IRequestItem;
    currentUser: any;
    onBack: () => void;
    onAction: (action: string, comment: string) => void;
}

export const RequestDetail: React.FunctionComponent<IRequestDetailProps> = (props) => {
    const [auditLogs, setAuditLogs] = React.useState<IAuditLogItem[]>([]);
    const [infoResponse, setInfoResponse] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const payload = JSON.parse(props.request.JSON_Payload || '{}');
    const isApprover = (props.request.CurrentAssignee?.Id || props.request.CurrentAssigneeId) === props.currentUser?.Id;
    const isTerminal = props.request.CurrentStatus === 'Approved' || props.request.CurrentStatus === 'Rejected';
    const isInfoRequested = props.request.CurrentStatus === 'Info Requested';
    const isRequester = props.request.RequesterId === props.currentUser?.Id || props.request.Requester?.Id === props.currentUser?.Id;

    React.useEffect(() => {
        const dataService = new AppDataService();
        dataService.getAuditLogs(props.request.Id)
            .then(logs => setAuditLogs(logs))
            .catch(err => console.warn('Could not load audit logs:', err));
    }, [props.request.Id]);

    const getStatusStyle = (): React.CSSProperties => {
        const status = props.request.CurrentStatus;
        if (status === 'Approved') return { background: '#D1FAE5', color: '#059669' };
        if (status === 'Rejected') return { background: '#FEE2E2', color: '#DC2626' };
        if (status === 'Info Requested') return { background: '#FEF3C7', color: '#D97706' };
        return { background: '#EDE9FE', color: '#7C3AED' };
    };

    const handleProvideInfo = async (): Promise<void> => {
        if (!infoResponse.trim()) return;
        setIsSubmitting(true);
        try {
            props.onAction('ProvideInfo', infoResponse);
        } finally {
            setIsSubmitting(false);
            setInfoResponse('');
        }
    };

    // Find the last "RequestInfo" comment from audit logs to show what was asked
    const infoRequestLog = isInfoRequested ? auditLogs.find(log => log.Action === 'RequestInfo') : undefined;

    return (
        <div className={styles.formContainer}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }} className={styles.formHeader}>
                <span>{props.request.Title}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ ...getStatusStyle(), padding: '5px 14px', borderRadius: '50px', fontSize: '12px', fontWeight: 600 }}>
                        {props.request.CurrentStatus}
                    </span>
                    <span style={{ fontSize: '13px', background: '#F3F4F6', padding: '5px 12px', borderRadius: '12px', color: '#6B7280' }}>
                        ID #{props.request.Id}
                    </span>
                </div>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className={styles.formField}>
                    <label>Requested By</label>
                    <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: '10px', fontSize: '14px' }}>
                        {props.request.Requester?.Title || 'Unknown'}
                    </div>
                </div>
                <div className={styles.formField}>
                    <label>Request Type</label>
                    <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: '10px', fontSize: '14px' }}>
                        {props.request.RequestType}
                    </div>
                </div>
                <div className={styles.formField}>
                    <label>Current Assignee</label>
                    <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: '10px', fontSize: '14px' }}>
                        {props.request.CurrentAssignee?.Title || 'Unassigned'}
                    </div>
                </div>
                <div className={styles.formField}>
                    <label>Stage</label>
                    <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: '10px', fontSize: '14px' }}>
                        Stage {props.request.StageID}
                    </div>
                </div>
            </div>

            {/* Payload Details */}
            <div className={styles.formField} style={{ marginTop: '8px' }}>
                <label>Request Details</label>
                <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '12px', overflow: 'auto' }}>
                    {Object.keys(payload).length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {Object.entries(payload).map(([key, value]) => (
                                <div key={key}>
                                    <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                                    <div style={{ fontSize: '14px', color: '#1F2937' }}>{String(value)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No additional details</span>
                    )}
                </div>
            </div>

            {/* Info Response Panel — shown when status is "Info Requested" and viewer is the requester */}
            {isInfoRequested && isRequester && (
                <div className={styles.formField} style={{ marginTop: '8px' }}>
                    <label style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚠️ Information Requested
                    </label>
                    {infoRequestLog?.Comments && (
                        <div style={{
                            background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 16px',
                            borderRadius: '12px', fontSize: '14px', color: '#92400E', marginBottom: '8px'
                        }}>
                            <strong>Approver asked:</strong> &quot;{infoRequestLog.Comments}&quot;
                        </div>
                    )}
                    <textarea
                        placeholder="Type your response here..."
                        value={infoResponse}
                        onChange={(e) => setInfoResponse(e.target.value)}
                        rows={4}
                        style={{
                            width: '100%', padding: '12px 14px', borderRadius: '12px',
                            border: '1px solid #E5E7EB', fontSize: '14px', fontFamily: 'inherit',
                            resize: 'vertical', outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                            onClick={handleProvideInfo}
                            disabled={isSubmitting || !infoResponse.trim()}
                            style={{
                                background: '#4F46E5', color: 'white', border: 'none',
                                padding: '10px 24px', borderRadius: '50px', fontSize: '14px',
                                fontWeight: 600, cursor: 'pointer', opacity: (isSubmitting || !infoResponse.trim()) ? 0.5 : 1
                            }}
                        >
                            {isSubmitting ? 'Submitting...' : '📤 Submit Response'}
                        </button>
                    </div>
                </div>
            )}

            {/* Audit Trail */}
            <div className={styles.formField} style={{ marginTop: '8px' }}>
                <label>Approval History</label>
                {auditLogs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {auditLogs.map((log, idx) => (
                            <div key={idx} style={{
                                background: '#F9FAFB', padding: '12px 16px', borderRadius: '12px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                flexWrap: 'wrap', gap: '8px', borderLeft: `3px solid ${log.Action === 'ProvideInfo' ? '#D97706' : '#4F46E5'}`
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>
                                        {log.Action === 'ProvideInfo' ? '💬 Info Provided' : log.Action}
                                    </div>
                                    {log.Comments && (
                                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                                            &quot;{log.Comments}&quot;
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'right' }}>
                                    {new Date(log.Timestamp).toLocaleDateString()} {new Date(log.Timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '12px', color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center' }}>
                        No approval actions yet
                    </div>
                )}
            </div>

            {/* Back Button */}
            <div className={styles.buttonRow}>
                <button className={styles.secondaryButton} onClick={props.onBack}>← Back to Dashboard</button>
            </div>

            {/* Approval Command Bar — only for current approver, non-terminal, and NOT Info Requested */}
            {isApprover && !isTerminal && !isInfoRequested && (
                <ApprovalCommandBar
                    onApprove={(c: string) => props.onAction('Approve', c)}
                    onReject={(c: string) => props.onAction('Reject', c)}
                    onRequestInfo={(c: string) => props.onAction('RequestInfo', c)}
                />
            )}
        </div>
    );
};
