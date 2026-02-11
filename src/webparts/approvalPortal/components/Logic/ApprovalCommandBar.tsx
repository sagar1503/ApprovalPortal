
import * as React from 'react';
import { PrimaryButton, DefaultButton, TextField, Dialog, DialogType, DialogFooter } from '@fluentui/react';

export interface IApprovalCommandBarProps {
    onApprove: (comment: string) => void;
    onReject: (comment: string) => void;
    onRequestInfo: (comment: string) => void;
}

export const ApprovalCommandBar: React.FunctionComponent<IApprovalCommandBarProps> = (props) => {
    const [hideDialog, setHideDialog] = React.useState(true);
    const [comment, setComment] = React.useState('');
    const [action, setAction] = React.useState<'Approve' | 'Reject' | 'Info' | null>(null);

    const onActionClick = (act: 'Approve' | 'Reject' | 'Info'): void => {
        setAction(act);
        setHideDialog(false);
    };

    const submitAction = (): void => {
        if (action === 'Approve') props.onApprove(comment);
        if (action === 'Reject') props.onReject(comment);
        if (action === 'Info') props.onRequestInfo(comment);
        setHideDialog(true);
        setComment('');
    };

    return (
        <div style={{
            position: 'sticky', bottom: 0,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '16px 24px',
            boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.06)',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: '0 0 24px 24px',
            display: 'flex', justifyContent: 'flex-end', gap: '12px', zIndex: 100,
            flexWrap: 'wrap' as any
        }}>
            <DefaultButton text="Request Info" onClick={() => onActionClick('Info')}
                styles={{ root: { borderRadius: '50px', padding: '8px 24px' } }} />
            <DefaultButton text="Reject" onClick={() => onActionClick('Reject')}
                styles={{ root: { borderRadius: '50px', padding: '8px 24px', color: '#EF4444', borderColor: '#EF4444' } }} />
            <PrimaryButton text="Approve" onClick={() => onActionClick('Approve')}
                styles={{ root: { borderRadius: '50px', padding: '8px 24px', background: '#10B981', borderColor: '#10B981' } }} />

            <Dialog
                hidden={hideDialog}
                onDismiss={() => setHideDialog(true)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: `${action} Request`,
                    subText: 'Please provide comments for this action.'
                }}
            >
                <TextField multiline rows={3} onChange={(_, val) => setComment(val || '')} />
                <DialogFooter>
                    <PrimaryButton onClick={submitAction} text="Confirm" />
                    <DefaultButton onClick={() => setHideDialog(true)} text="Cancel" />
                </DialogFooter>
            </Dialog>
        </div>
    );
};
