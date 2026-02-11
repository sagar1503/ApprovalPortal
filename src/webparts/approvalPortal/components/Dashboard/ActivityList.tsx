
import * as React from 'react';
import styles from './Dashboard.module.scss';
import { IRequestItem } from '../../ListSchema';
import { DocumentRegular, MoneyRegular, ShieldKeyholeRegular, DocumentBulletListRegular } from '@fluentui/react-icons';

export interface IActivityListProps {
    requests: IRequestItem[];
    onClick?: (item: IRequestItem) => void;
}

const getIconClass = (type: string): string => {
    switch (type) {
        case 'Purchase': return styles.activityIconPurchase;
        case 'Leave': return styles.activityIconLeave;
        case 'Access': return styles.activityIconAccess;
        default: return styles.activityIconLeave;
    }
};

const getStatusClass = (status: string): string => {
    switch (status) {
        case 'Approved': return styles.statusApproved;
        case 'Rejected': return styles.statusRejected;
        case 'Submitted': return styles.statusSubmitted;
        case 'InReview':
        case 'MoreInfoRequested': return styles.statusPending;
        default: return styles.statusDefault;
    }
};

const getIcon = (type: string): React.ReactElement => {
    switch (type) {
        case 'Purchase': return <MoneyRegular />;
        case 'Access': return <ShieldKeyholeRegular />;
        case 'Leave': return <DocumentRegular />;
        default: return <DocumentBulletListRegular />;
    }
};

export const ActivityList: React.FunctionComponent<IActivityListProps> = (props) => {
    return (
        <div className={styles.activityCard}>
            <div className={styles.sectionTitle}>Recent Activity</div>

            {props.requests.length === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📋</div>
                    <p>No recent activity yet. Create your first request!</p>
                </div>
            )}

            {props.requests.map(req => (
                <div
                    key={req.Id}
                    className={styles.activityItem}
                    onClick={() => props.onClick && props.onClick(req)}
                >
                    <div className={styles.activityLeft}>
                        <div className={getIconClass(req.RequestType)}>
                            {getIcon(req.RequestType)}
                        </div>
                        <div>
                            <div className={styles.activityTitle}>{req.Title}</div>
                            <div className={styles.activityDate}>
                                {new Date(req.Created).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric'
                                })}
                            </div>
                        </div>
                    </div>

                    <div className={styles.activityRight}>
                        <div className={getStatusClass(req.CurrentStatus)}>
                            {req.CurrentStatus}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
