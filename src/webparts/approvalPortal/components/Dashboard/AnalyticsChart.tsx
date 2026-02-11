
import * as React from 'react';
import styles from './Dashboard.module.scss';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { IRequestItem } from '../../ListSchema';

ChartJS.register(ArcElement, Tooltip, Legend);

export interface IAnalyticsChartProps {
    requests: IRequestItem[];
}

export const AnalyticsChart: React.FunctionComponent<IAnalyticsChartProps> = (props) => {

    const stats: Record<string, number> = {};
    props.requests.forEach(r => {
        stats[r.RequestType] = (stats[r.RequestType] || 0) + 1;
    });

    const data = {
        labels: Object.keys(stats),
        datasets: [
            {
                data: Object.values(stats),
                backgroundColor: [
                    '#4F46E5', // Indigo
                    '#F97316', // Orange
                    '#10B981', // Green
                    '#6366F1', // Light Indigo
                    '#F59E0B', // Amber
                ],
                borderWidth: 0,
                hoverOffset: 6,
            },
        ],
    };

    const options = {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 16,
                    font: {
                        size: 12,
                        family: "'Segoe UI', sans-serif"
                    }
                }
            }
        }
    };

    return (
        <div className={styles.chartCard}>
            <div className={styles.sectionTitle}>Overview</div>
            <div className={styles.chartContainer}>
                {Object.keys(stats).length > 0 ?
                    <Doughnut data={data} options={options} /> :
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📊</div>
                        <p>No data to display yet</p>
                    </div>
                }
            </div>
        </div>
    );
};
