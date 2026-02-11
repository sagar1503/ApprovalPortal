
import * as React from 'react';
import styles from './Dashboard.module.scss';
import { ClockRegular, ArrowTrendingRegular } from '@fluentui/react-icons';

export interface IMetricsCardsProps {
    pendingCount: number;
    myRequestCount: number;
}

export const MetricsCards: React.FunctionComponent<IMetricsCardsProps> = (props) => {
    return (
        <>
            <div className={styles.metricCardPending}>
                <div className={styles.metricHeader}>
                    <div className={styles.metricLabel}>Awaiting Approval</div>
                    <div className={styles.metricIconPending}>
                        <ClockRegular fontSize={18} />
                    </div>
                </div>
                <div className={styles.metricValue}>{props.pendingCount}</div>
                <div className={styles.metricTrend}>Needs your attention</div>
            </div>

            <div className={styles.metricCardOpen}>
                <div className={styles.metricHeader}>
                    <div className={styles.metricLabel}>My Open Requests</div>
                    <div className={styles.metricIconOpen}>
                        <ArrowTrendingRegular fontSize={18} />
                    </div>
                </div>
                <div className={styles.metricValue}>{props.myRequestCount}</div>
                <div className={styles.metricTrend}>Submitted by you</div>
            </div>
        </>
    );
};
