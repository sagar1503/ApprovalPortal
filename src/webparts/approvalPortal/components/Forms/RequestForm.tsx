
import * as React from 'react';
import styles from './RequestForm.module.scss';
import { TextField, Dropdown, IDropdownOption, DatePicker, Toggle, PrimaryButton, DefaultButton, Stack } from '@fluentui/react';
import { PeoplePicker, PrincipalType } from "@pnp/spfx-controls-react/lib/PeoplePicker";
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IRequestFormProps {
    context: WebPartContext;
    onSubmit: (formData: any) => void;
    onCancel: () => void;
}

const requestTypeOptions: IDropdownOption[] = [
    { key: 'Leave', text: 'Leave Request' },
    { key: 'Purchase', text: 'Purchase Request' },
    { key: 'Access', text: 'Access Request' },
];

export const RequestForm: React.FunctionComponent<IRequestFormProps> = (props) => {
    const [title, setTitle] = React.useState('');
    const [requestType, setRequestType] = React.useState<string>('Leave');
    const [isOnBehalf, setIsOnBehalf] = React.useState(false);
    const [delegateUser, setDelegateUser] = React.useState<number | null>(null);

    // Dynamic Fields State
    const [amount, setAmount] = React.useState('');
    const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
    const [reason, setReason] = React.useState('');

    const handleSubmit = () => {
        const payload: any = {
            Reason: reason
        };

        if (requestType === 'Purchase') {
            payload.Amount = parseFloat(amount);
        } else if (requestType === 'Leave') {
            payload.StartDate = startDate?.toISOString();
            payload.EndDate = endDate?.toISOString();
        }

        const formData = {
            Title: title,
            RequestType: requestType,
            RequesterDelegateId: isOnBehalf ? delegateUser : null,
            JSON_Payload: JSON.stringify(payload)
        };

        props.onSubmit(formData);
    };

    return (
        <div className={styles.formContainer}>
            <div className={styles.formHeader}>New Request</div>

            <div className={styles.formField}>
                <Toggle
                    label="Submit on behalf of someone else?"
                    checked={isOnBehalf}
                    onChange={(_, checked) => setIsOnBehalf(!!checked)}
                />
            </div>

            {isOnBehalf && (
                <div className={styles.formField}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '5px' }}>Select Requester</label>
                    <PeoplePicker
                        context={props.context as any}
                        webAbsoluteUrl={props.context.pageContext.web.absoluteUrl}
                        personSelectionLimit={1}
                        showtooltip={true}
                        required={true}
                        disabled={false}
                        onChange={async (items) => {
                            if (items.length > 0) {
                                // PnP PeoplePicker v3 returns id as a login name string (e.g. "i:0#.f|membership|user@domain.com")
                                // or sometimes as a numeric string. We need the SharePoint integer user ID.
                                const selectedItem = items[0];
                                try {
                                    if (selectedItem.id && !isNaN(parseInt(selectedItem.id))) {
                                        // If id is already numeric, use it directly
                                        setDelegateUser(parseInt(selectedItem.id));
                                    } else {
                                        // Resolve login name to SharePoint user ID via ensureUser
                                        const loginName = (selectedItem as any).loginName || selectedItem.id || selectedItem.secondaryText;
                                        if (loginName) {
                                            const { getSP } = await import(
                                                /* webpackChunkName: 'pnpjsConfig' */
                                                '../../pnpjsConfig'
                                            );
                                            const sp = getSP();
                                            const ensuredUser = await sp.web.ensureUser(loginName);
                                            setDelegateUser(ensuredUser.Id);
                                            console.log('Resolved delegate user ID:', ensuredUser.Id, 'from login:', loginName);
                                        }
                                    }
                                } catch (err) {
                                    console.error('Failed to resolve delegate user:', err);
                                    // Fallback: try parsing id as integer
                                    if (selectedItem.id) {
                                        setDelegateUser(parseInt(selectedItem.id as string));
                                    }
                                }
                            } else {
                                setDelegateUser(null);
                            }
                        }}
                        showHiddenInUI={false}
                        principalTypes={[PrincipalType.User]}
                        resolveDelay={200}
                    />
                </div>
            )}

            <div className={styles.formField}>
                <TextField label="Title" required value={title} onChange={(_, val) => setTitle(val || '')} />
            </div>

            <div className={styles.formField}>
                <Dropdown
                    label="Request Type"
                    options={requestTypeOptions}
                    selectedKey={requestType}
                    onChange={(_, opt) => setRequestType(opt?.key as string)}
                />
            </div>

            {/* Dynamic Fields */}
            {requestType === 'Purchase' && (
                <div className={styles.formField}>
                    <TextField label="Amount ($)" type="number" value={amount} onChange={(_, val) => setAmount(val || '')} />
                </div>
            )}

            {requestType === 'Leave' && (
                <Stack horizontal tokens={{ childrenGap: 20 }}>
                    <DatePicker label="Start Date" value={startDate} onSelectDate={(d) => setStartDate(d || undefined)} />
                    <DatePicker label="End Date" value={endDate} onSelectDate={(d) => setEndDate(d || undefined)} />
                </Stack>
            )}

            <div className={styles.formField}>
                <TextField label="Business Justification" multiline rows={3} value={reason} onChange={(_, val) => setReason(val || '')} />
            </div>

            <div className={styles.buttonRow}>
                <button className={styles.secondaryButton} onClick={props.onCancel}>Cancel</button>
                <button className={styles.primaryButton} onClick={handleSubmit} disabled={!title}>Submit Request</button>
            </div>
        </div>
    );
};
