
import * as React from 'react';
import styles from './Dashboard.module.scss';
import { AddRegular, TimerRegular } from '@fluentui/react-icons';

export interface IActionCardProps {
    onClick: () => void;
}

export const ActionCard: React.FunctionComponent<IActionCardProps> = (props) => {
    return (
        <div className={styles.actionCard} onClick={props.onClick}>
            <div className={styles.actionCardHeader}>
                <div className={styles.actionCardTitle}>New Request</div>
                <div className={styles.actionIcon}>
                    <AddRegular />
                </div>
            </div>

            <div className={styles.actionCardFooter}>
                <TimerRegular />
                <span>Avg Approval: 2 Days</span>
            </div>
        </div>
    );
};
