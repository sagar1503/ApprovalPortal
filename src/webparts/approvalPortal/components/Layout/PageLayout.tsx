
import * as React from 'react';
import styles from './PageLayout.module.scss';
import { Sidebar } from './Sidebar';

export interface IPageLayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const PageLayout: React.FunctionComponent<IPageLayoutProps> = (props) => {
    return (
        <div className={styles.pageContainer}>
            <Sidebar activeTab={props.activeTab} onTabChange={props.onTabChange} />
            <div className={styles.contentArea}>
                {props.children}
            </div>
        </div>
    );
};
