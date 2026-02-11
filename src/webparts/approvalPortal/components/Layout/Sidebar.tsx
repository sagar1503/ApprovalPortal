
import * as React from 'react';
import styles from './Sidebar.module.scss';
import { HomeRegular, AddRegular, HistoryRegular, SettingsRegular } from '@fluentui/react-icons';

export interface ISidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const Sidebar: React.FunctionComponent<ISidebarProps> = (props) => {
    return (
        <div className={styles.sidebarContainer}>
            <div
                className={`${styles.navItem} ${props.activeTab === 'home' ? styles.active : ''}`}
                onClick={() => props.onTabChange('home')}
                title="Home"
            >
                <HomeRegular fontSize={24} />
            </div>
            <div
                className={`${styles.navItem} ${props.activeTab === 'new' ? styles.active : ''}`}
                onClick={() => props.onTabChange('new')}
                title="New Request"
            >
                <AddRegular fontSize={24} />
            </div>
            <div
                className={`${styles.navItem} ${props.activeTab === 'history' ? styles.active : ''}`}
                onClick={() => props.onTabChange('history')}
                title="History"
            >
                <HistoryRegular fontSize={24} />
            </div>
            <div
                className={`${styles.navItem} ${props.activeTab === 'admin' ? styles.active : ''}`}
                onClick={() => props.onTabChange('admin')}
                title="Admin"
            >
                <SettingsRegular fontSize={24} />
            </div>
        </div>
    );
};
