
import * as React from 'react';
import styles from './ApprovalPortal.module.scss';
import { IApprovalPortalProps } from './IApprovalPortalProps';
import { PageLayout } from './Layout/PageLayout';
import { Dashboard } from './Dashboard/Dashboard';
import { RequestForm } from './Forms/RequestForm';
import { RequestDetail } from './Dashboard/RequestDetail';
import { AppDataService } from '../services/AppDataService';
import { WorkflowEngine } from '../services/WorkflowEngine';
import { IRequestItem } from '../ListSchema';
import { Spinner, SpinnerSize } from '@fluentui/react';

export interface IApprovalPortalState {
  activeTab: string;
  loading: boolean;
  currentUser: any;
  myRequests: IRequestItem[];
  pendingRequests: IRequestItem[];
  selectedRequest: IRequestItem | null;
  error: string | null;
  isAdmin: boolean;
  allRequests: IRequestItem[];
  approvalHistory: IRequestItem[];
}

export default class ApprovalPortal extends React.Component<IApprovalPortalProps, IApprovalPortalState> {
  private _dataService: AppDataService;
  private _workflowEngine: WorkflowEngine;

  constructor(props: IApprovalPortalProps) {
    super(props);

    this._dataService = new AppDataService();
    this._workflowEngine = new WorkflowEngine();

    this.state = {
      activeTab: 'home',
      loading: true,
      currentUser: null,
      myRequests: [],
      pendingRequests: [],
      selectedRequest: null,
      error: null,
      isAdmin: false,
      allRequests: [],
      approvalHistory: []
    };
  }

  public async componentDidMount() {
    await this.loadData();
  }

  private loadData = async () => {
    try {
      this.setState({ loading: true });

      // Always fetch current user first — this doesn't depend on custom lists
      const user = await this._dataService.getCurrentUser();
      this.setState({ currentUser: user });

      // Check admin group membership OR Site Admin status
      let isAdmin = false;
      try {
        if (user.IsSiteAdmin) {
          console.log('User is Site Admin — granting admin access.');
          isAdmin = true;
        } else {
          isAdmin = await this._dataService.isUserInGroup('ApprovalPortal - Admins');
        }
      } catch (adminErr) {
        console.warn('Admin check failed:', adminErr);
      }

      // Try to load list data — may fail if lists aren't provisioned yet
      let myRequests: IRequestItem[] = [];
      let pending: IRequestItem[] = [];
      let allRequests: IRequestItem[] = [];
      let approvalHistory: IRequestItem[] = [];
      try {
        myRequests = await this._dataService.getMyRequests(user.Id);
        pending = await this._dataService.getPendingApprovals(user.Id);
        approvalHistory = await this._dataService.getMyApprovalHistory(user.Id);

        // If admin, also load all requests
        if (isAdmin) {
          allRequests = await this._dataService.getAllRequests();
        }
      } catch (listErr) {
        console.warn('Lists may not be provisioned yet:', listErr);
      }

      this.setState({
        myRequests: myRequests,
        pendingRequests: pending,
        allRequests: allRequests,
        approvalHistory: approvalHistory,
        isAdmin: isAdmin,
        loading: false,
        error: null
      });
    } catch (err) {
      console.error(err);
      this.setState({ loading: false, error: 'Failed to load data. Check your connection.' });
    }
  }

  private handleTabChange = (tab: string) => {
    this.setState({ activeTab: tab, selectedRequest: null });
  }

  private handleViewRequest = (request: IRequestItem) => {
    this.setState({ selectedRequest: request, activeTab: 'detail' });
  }

  private handleSubmitRequest = async (formData: any) => {
    if (!this.state.currentUser) {
      alert('Unable to submit: user not loaded. Please refresh the page.');
      return;
    }
    try {
      this.setState({ loading: true });

      // Look up the first approver from the approval matrix
      const matrix = await this._dataService.getApprovalMatrix(formData.RequestType);
      const firstStage = matrix.length > 0 ? matrix[0] : undefined; // Already sorted by StageOrder

      const newItem: any = {
        Title: formData.Title,
        RequestType: formData.RequestType,
        RequesterId: this.state.currentUser.Id,
        CurrentStatus: firstStage ? firstStage.StageName : 'Submitted',
        StageID: firstStage ? firstStage.StageOrder : 1,
        JSON_Payload: formData.JSON_Payload
      };

      // Determine who the effective requester is (for manager lookup)
      let effectiveRequesterLogin = this.state.currentUser.LoginName;

      if (formData.RequesterDelegateId) {
        newItem.RequesterDelegateId = formData.RequesterDelegateId;
        try {
          // we need to get the login name of the delegate to find their manager
          const delegateUser = await this._dataService.getUserById(formData.RequesterDelegateId);
          effectiveRequesterLogin = delegateUser.LoginName;
        } catch (e) {
          console.warn('Could not fetch delegate user profile', e);
        }
      }

      console.log('Submitting new item:', newItem);

      // Assign first approver based on ApproverType
      if (firstStage) {
        if (firstStage.ApproverType === 'Dynamic-Manager') {
          // Try to resolve from user profile first
          try {
            const managerId = await this._dataService.getManagerForUser(effectiveRequesterLogin);
            if (managerId) {
              newItem.CurrentAssigneeId = managerId;
            } else if (firstStage.ApproverValueId) {
              // Fallback to matrix value
              newItem.CurrentAssigneeId = firstStage.ApproverValueId;
            }
          } catch (profileErr) {
            console.warn('Manager profile lookup failed, using matrix fallback:', profileErr);
            if (firstStage.ApproverValueId) {
              newItem.CurrentAssigneeId = firstStage.ApproverValueId;
            }
          }
        } else if (firstStage.ApproverValueId) {
          // Static-User or Static-Group
          newItem.CurrentAssigneeId = firstStage.ApproverValueId;
        }
      }

      await this._dataService.createRequest(newItem);
      await this.loadData();
      this.setState({ activeTab: 'home' });

    } catch (err) {
      console.error(err);
      alert('Error submitting request: ' + err);
      this.setState({ loading: false });
    }
  }

  private handleWorkflowAction = async (action: string, comment: string) => {
    if (!this.state.selectedRequest) return;

    try {
      this.setState({ loading: true });
      await this._workflowEngine.handleTransition(
        this.state.selectedRequest,
        action,
        comment,
        this.state.currentUser
      );

      await this.loadData();
      this.setState({ activeTab: 'home', selectedRequest: null });

    } catch (err) {
      console.error(err);
      alert("Workflow Error: " + (err as any).message);
      this.setState({ loading: false });
    }
  }

  public render(): React.ReactElement<IApprovalPortalProps> {
    const { activeTab, loading, currentUser, myRequests, pendingRequests, selectedRequest, isAdmin, allRequests, approvalHistory } = this.state;

    // Terminal statuses — these requests are "done"
    const TERMINAL_STATUSES = ['Approved', 'Rejected'];

    // Filter for dashboard: only open/active requests
    // Using case-insensitive check and trim to be robust against data inconsistencies
    const openMyRequests = myRequests.filter(r => !TERMINAL_STATUSES.some(t => t.toLowerCase() === (r.CurrentStatus || '').trim().toLowerCase()));
    const openPendingRequests = pendingRequests.filter(r => !TERMINAL_STATUSES.some(t => t.toLowerCase() === (r.CurrentStatus || '').trim().toLowerCase()));

    const getStatusBadge = (status: string): React.CSSProperties => {
      if (status === 'Approved') return { background: '#D1FAE5', color: '#059669' };
      if (status === 'Rejected') return { background: '#FEE2E2', color: '#DC2626' };
      if (status === 'Info Requested') return { background: '#FEF3C7', color: '#D97706' };
      return { background: '#EDE9FE', color: '#7C3AED' };
    };

    return (
      <PageLayout activeTab={activeTab} onTabChange={this.handleTabChange} isAdmin={isAdmin}>
        {loading && <Spinner size={SpinnerSize.large} label="Loading..." />}

        {!loading && activeTab === 'home' && (
          <Dashboard
            userDisplayName={currentUser?.Title || 'User'}
            requests={openPendingRequests.length > 0 ? openPendingRequests : openMyRequests}
            pendingCount={openPendingRequests.length}
            myRequestCount={openMyRequests.length}
            onRequestCreate={() => this.setState({ activeTab: 'new' })}
            onRequestClick={this.handleViewRequest}
          />
        )}

        {!loading && activeTab === 'new' && (
          <RequestForm
            context={this.props.context}
            onSubmit={this.handleSubmitRequest}
            onCancel={() => this.setState({ activeTab: 'home' })}
          />
        )}

        {!loading && activeTab === 'detail' && selectedRequest && (
          <RequestDetail
            request={selectedRequest}
            currentUser={currentUser}
            onBack={() => this.setState({ activeTab: 'home', selectedRequest: null })}
            onAction={this.handleWorkflowAction}
          />
        )}

        {/* ── History Tab ── */}
        {!loading && activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* My Submitted Requests */}
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', marginBottom: '4px', marginTop: 0 }}>My Requests</h2>
              <p style={{ fontSize: '14px', color: '#9CA3AF', margin: '0 0 20px 0' }}>All requests you have submitted</p>

              {myRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                  <div style={{ fontSize: '48px', opacity: 0.3, marginBottom: '12px' }}>📋</div>
                  <p>You haven't submitted any requests yet.</p>
                  <button
                    onClick={() => this.setState({ activeTab: 'new' })}
                    style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '50px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}
                  >
                    + Create Your First Request
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myRequests.map(r => (
                    <div
                      key={r.Id}
                      onClick={() => this.handleViewRequest(r)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                        transition: 'background 0.2s', flexWrap: 'wrap', gap: '8px',
                        border: '1px solid #F3F4F6'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                          #{r.Id}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1F2937', fontSize: '14px' }}>{r.Title}</div>
                          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{r.RequestType} • {new Date(r.Created).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ ...getStatusBadge(r.CurrentStatus), padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 600 }}>
                          {r.CurrentStatus}
                        </span>
                        <span style={{ color: '#D1D5DB', fontSize: '18px' }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Requests I've Acted On (Approval History) */}
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', marginBottom: '4px', marginTop: 0 }}>My Approval History</h2>
              <p style={{ fontSize: '14px', color: '#9CA3AF', margin: '0 0 20px 0' }}>Requests you have approved, rejected, or acted on</p>

              {approvalHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>
                  <div style={{ fontSize: '48px', opacity: 0.3, marginBottom: '12px' }}>✅</div>
                  <p>No approval actions taken yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {approvalHistory.map(r => (
                    <div
                      key={`ah-${r.Id}`}
                      onClick={() => this.handleViewRequest(r)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                        transition: 'background 0.2s', flexWrap: 'wrap', gap: '8px',
                        border: '1px solid #F3F4F6'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DBEAFE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                          #{r.Id}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1F2937', fontSize: '14px' }}>{r.Title}</div>
                          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>by {r.Requester?.Title || 'Unknown'} • {r.RequestType} • {new Date(r.Created).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ ...getStatusBadge(r.CurrentStatus), padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 600 }}>
                          {r.CurrentStatus}
                        </span>
                        <span style={{ color: '#D1D5DB', fontSize: '18px' }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Admin / Settings Tab ── */}
        {!loading && activeTab === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Settings Header */}
            <div style={{ background: 'linear-gradient(135deg, #1F2937, #374151)', padding: '28px 32px', borderRadius: '24px', color: 'white' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0' }}>⚙️ Admin Settings</h2>
              <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>Configure approval workflows, manage delegations, and view system info</p>
            </div>

            {/* All Requests — Admin Only */}
            {isAdmin && (
              <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937', margin: '0 0 4px 0' }}>🔍 All Requests</h3>
                    <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>{allRequests.length} total requests in the system</p>
                  </div>
                  <span style={{ background: '#EDE9FE', color: '#7C3AED', padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 600 }}>Admin View</span>
                </div>

                {allRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>
                    <p>No requests found in the system.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                    {allRequests.map(r => (
                      <div
                        key={`admin-${r.Id}`}
                        onClick={() => this.handleViewRequest(r)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                          transition: 'background 0.2s', flexWrap: 'wrap', gap: '8px',
                          border: '1px solid #F3F4F6'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                            #{r.Id}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1F2937', fontSize: '14px' }}>{r.Title}</div>
                            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>by {r.Requester?.Title || 'Unknown'} • {r.RequestType} • {new Date(r.Created).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ ...getStatusBadge(r.CurrentStatus), padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 600 }}>
                            {r.CurrentStatus}
                          </span>
                          <span style={{ color: '#D1D5DB', fontSize: '18px' }}>›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isAdmin && (
              <div style={{ background: '#FEF3C7', padding: '14px 16px', borderRadius: '12px', fontSize: '13px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🔒</span>
                <span>You need to be a member of the <strong>ApprovalPortal - Admins</strong> group to view all requests.</span>
              </div>
            )}

            {/* Approval Matrix Info */}
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937', margin: '0 0 8px 0' }}>📋 Approval Matrix</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 16px 0' }}>
                The approval routing is configured in the <strong>Config_ApprovalMatrix</strong> SharePoint list.
                Each row defines a stage in the approval workflow.
              </p>
              <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '12px', fontSize: '13px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#4F46E5', marginBottom: '4px' }}>Supported Approver Types</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#4B5563', lineHeight: 1.8 }}>
                      <li><strong>Static-User</strong> — Always routes to a specific person</li>
                      <li><strong>Dynamic-Manager</strong> — Routes to the requester's manager (falls back to matrix value)</li>
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#4F46E5', marginBottom: '4px' }}>Key Fields</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#4B5563', lineHeight: 1.8 }}>
                      <li><strong>RequestType</strong> — Category of request</li>
                      <li><strong>StageOrder</strong> — Sequence (1, 2, 3...)</li>
                      <li><strong>Condition</strong> — Skip logic (JSON)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <a
                href={`${window.location.origin}${window.location.pathname.split('/SitePages')[0]}/_layouts/15/listedit.aspx?List=Config_ApprovalMatrix`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: '16px', padding: '10px 20px',
                  background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: 'white',
                  borderRadius: '50px', textDecoration: 'none', fontSize: '13px', fontWeight: 600
                }}
              >
                Open Approval Matrix List →
              </a>
            </div>

            {/* Delegations Info */}
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937', margin: '0 0 8px 0' }}>🔄 Delegations</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 16px 0' }}>
                Set up temporary approval delegations when approvers are away. Configured in the <strong>Config_Delegations</strong> list.
              </p>
              <div style={{ background: '#FEF3C7', padding: '14px 16px', borderRadius: '12px', fontSize: '13px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <span>Delegation enforcement in workflow is planned for a future release.</span>
              </div>
              <a
                href={`${window.location.origin}${window.location.pathname.split('/SitePages')[0]}/_layouts/15/listedit.aspx?List=Config_Delegations`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: '16px', padding: '10px 20px',
                  border: '1px solid #E5E7EB', color: '#4B5563',
                  borderRadius: '50px', textDecoration: 'none', fontSize: '13px', fontWeight: 600,
                  background: 'white'
                }}
              >
                Open Delegations List →
              </a>
            </div>

            {/* System Info */}
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937', margin: '0 0 8px 0' }}>ℹ️ System Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div style={{ background: '#F9FAFB', padding: '14px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Current User</div>
                  <div style={{ fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{currentUser?.Title || 'Loading...'}</div>
                </div>
                <div style={{ background: '#F9FAFB', padding: '14px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>User ID</div>
                  <div style={{ fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{currentUser?.Id || '—'}</div>
                </div>
                <div style={{ background: '#F9FAFB', padding: '14px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Version</div>
                  <div style={{ fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>1.0.0</div>
                </div>
                <div style={{ background: '#F9FAFB', padding: '14px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>SharePoint Lists</div>
                  <div style={{ fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>4 configured</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </PageLayout>
    );
  }
}
