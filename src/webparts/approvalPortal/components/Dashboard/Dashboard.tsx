
import * as React from 'react';
import styles from './Dashboard.module.scss';
import { HeroHeader } from './HeroHeader';
import { ActionCard } from './ActionCard';
import { MetricsCards } from './MetricsCards';
import { ActivityList } from './ActivityList';
import { AnalyticsChart } from './AnalyticsChart';
import { IRequestItem } from '../../ListSchema';

export interface IDashboardProps {
    userDisplayName: string;
    requests: IRequestItem[];
    pendingCount: number;
    myRequestCount: number;
    onRequestCreate: () => void;
    onRequestClick?: (item: IRequestItem) => void;
}

export const Dashboard: React.FunctionComponent<IDashboardProps> = (props) => {
    return (
        <div className={styles.dashboardContainer}>
            {/* Hero greeting + search */}
            <HeroHeader userName={props.userDisplayName.split(' ')[0]} />

            {/* Action Card + Metrics in a row */}
            <div className={styles.topRow}>
                <ActionCard onClick={props.onRequestCreate} />
                <MetricsCards
                    pendingCount={props.pendingCount}
                    myRequestCount={props.myRequestCount}
                />
            </div>

            {/* Activity list + Analytics chart */}
            <div className={styles.bottomGrid}>
                <ActivityList requests={props.requests.slice(0, 5)} onClick={props.onRequestClick} />
                <AnalyticsChart requests={props.requests} />
            </div>
        </div>
    );
};
