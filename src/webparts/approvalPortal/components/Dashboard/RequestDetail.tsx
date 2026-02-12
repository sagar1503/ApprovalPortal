
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
    const payload = JSON.parse(props.request.JSON_Payload || '{}');
    const isApprover = (props.request.CurrentAssignee?.Id || props.request.CurrentAssigneeId) === props.currentUser?.Id;
    const isTerminal = props.request.CurrentStatus === 'Approved' || props.request.CurrentStatus === 'Rejected';

    console.log('RequestDetail render:', props.request);
    console.log('RequesterDelegateId:', props.request.RequesterDelegateId);
    console.log('RequesterDelegate:', props.request.RequesterDelegate);

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
                        {(props.request.RequesterDelegate || props.request.RequesterDelegateId) && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#6B7280' }}>
                                (On behalf of: {props.request.RequesterDelegate?.Title || `#${props.request.RequesterDelegateId}`})
                            </div>
                        )}
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

            {/* Audit Trail */}
            <div className={styles.formField} style={{ marginTop: '8px' }}>
                <label>Approval History</label>
                {auditLogs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {auditLogs.map((log, idx) => (
                            <div key={idx} style={{
                                background: '#F9FAFB', padding: '12px 16px', borderRadius: '12px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                flexWrap: 'wrap', gap: '8px', borderLeft: '3px solid #4F46E5'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>
                                        {log.Action}
                                    </div>
                                    {log.Comments && (
                                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                                            "{log.Comments}"
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

            {/* Response to Info Request (Only for Assignee when status is Info Requested) */}
            {isApprover && props.request.CurrentStatus === 'Info Requested' && (
                <div style={{ marginTop: '20px', padding: '20px', background: '#FEF3C7', borderRadius: '12px', borderLeft: '4px solid #D97706' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#92400E', marginTop: 0 }}>ℹ️ Information Requested</h3>
                    <p style={{ fontSize: '14px', color: '#B45309' }}>
                        The approver has requested more information. Please provide details below and submit to resume the approval process.
                    </p>
                    <textarea
                        id="infoResponse"
                        rows={3}
                        placeholder="Type your response here..."
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', marginTop: '8px' }}
                    />
                    <button
                        onClick={() => {
                            const val = (document.getElementById('infoResponse') as HTMLTextAreaElement).value;
                            if (!val.trim()) {
                                alert('Please enter a response.');
                                return;
                            }
                            props.onAction('SubmitInfo', val);
                        }}
                        style={{
                            marginTop: '12px', padding: '10px 20px', background: '#D97706', color: 'white',
                            border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Submit Response
                    </button>
                </div>
            )}

            {/* Back Button */}
            <div className={styles.buttonRow}>
                <button className={styles.secondaryButton} onClick={props.onBack}>← Back to Dashboard</button>
            </div>

            {/* Approval Command Bar — only for current approver AND NOT Info Requested status (which is handled above) */}
            {isApprover && !isTerminal && props.request.CurrentStatus !== 'Info Requested' && (
                <ApprovalCommandBar
                    onApprove={(c: string) => props.onAction('Approve', c)}
                    onReject={(c: string) => props.onAction('Reject', c)}
                    onRequestInfo={(c: string) => props.onAction('RequestInfo', c)}
                />
            )}
        </div>
    );
};
