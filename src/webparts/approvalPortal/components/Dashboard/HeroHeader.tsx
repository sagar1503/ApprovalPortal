
import * as React from 'react';
import styles from './Dashboard.module.scss';
import { SearchRegular } from '@fluentui/react-icons';

export interface IHeroHeaderProps {
    userName: string;
}

export const HeroHeader: React.FunctionComponent<IHeroHeaderProps> = (props) => {
    return (
        <div className={styles.heroSection}>
            <div className={styles.heroContent}>
                <div className={styles.heroGreeting}>Welcome back, {props.userName} 👋</div>
                <div className={styles.heroSubtext}>
                    Manage approvals, track requests, and keep everything on track.
                </div>
            </div>
            <div className={styles.heroRight}>
                <div className={styles.searchBar}>
                    <SearchRegular style={{ marginRight: '10px', color: 'rgba(255,255,255,0.6)', fontSize: '18px' }} />
                    <input
                        type="text"
                        placeholder="Search requests..."
                    />
                </div>
            </div>
        </div>
    );
};
