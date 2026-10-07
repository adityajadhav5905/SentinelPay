import { Header } from '../components/layout/Header';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { subscriptionApi } from '../api-integration/subscriptions';
import { authApi } from '../api-integration/auth';
import { apiKeysApi } from '../api-integration/api-keys';
import { notificationsApi } from '../api-integration/notifications';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Key, Trash2, Copy, Plus, Bell, Smartphone, Mail, AlertTriangle } from 'lucide-react';

// Load Razorpay Script
const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PLAN_RANK = {
  'Free': 0,
  'Basic': 1,
  'Pro': 2,
  'Enterprise': 3
};

export default function Settings() {
  const navigate = useNavigate();
  // Fetch Plans
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: subscriptionApi.getPlans
  });

  // Fetch My Subscription
  const { data: subscription, isLoading: subLoading, refetch: refetchSub } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: subscriptionApi.getMySubscription
  });

  // Fetch User (for profile card)
  const { data: user } = useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile
  });

  // Create Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: subscriptionApi.createOrder,
    onSuccess: async (data, planId) => {
      // If free plan, it's instant success
      if (data.success && !data.orderId) {
        toast.success(data.message);
        refetchSub();
        return;
      }

      // Initialize Razorpay
      const res = await loadRazorpay();
      if (!res) {
        toast.error('Razorpay SDK failed to load');
        return;
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: 'SentinelPay',
        description: `Upgrade to ${planId} Plan`,
        order_id: data.orderId,
        handler: async function (response) {
          try {
            toast.loading('Verifying payment...');
            await subscriptionApi.verifyOrder(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            toast.dismiss();
            toast.success('Subscription upgraded successfully!');
            refetchSub();
          } catch (err) {
            toast.dismiss();
            toast.error('Payment verification failed');
            console.error(err);
          }
        },
        prefill: {
          name: `${user?.firstName} ${user?.lastName}`,
          email: user?.email,
        },
        theme: {
          color: '#6366f1',
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to initiate upgrade');
    }
  });

  const handleUpgrade = (planName) => {
    // Mapping frontend plan names to backend IDs if needed, but assuming simple map for now
    // Backend expects: 'starter', 'advanced', 'enterprise'
    const backendPlanId = planName;
    createOrderMutation.mutate(backendPlanId);

  };

  // --- API Keys Logic ---
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);

  const { data: apiKeys = [], isLoading: keysLoading, refetch: refetchKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.list
  });

  const createKeyMutation = useMutation({
    mutationFn: apiKeysApi.create,
    onSuccess: (data) => {
      setGeneratedKey(data);
      setNewKeyName('');
      toast.success('API Key generated successfully');
      refetchKeys();
    },
    onError: () => toast.error('Failed to generate API Key')
  });

  const revokeKeyMutation = useMutation({
    mutationFn: apiKeysApi.revoke,
    onSuccess: () => {
      toast.success('API Key revoked');
      refetchKeys();
    },
    onError: () => toast.error('Failed to revoke API Key')
  });

  // --- Notification Settings Logic ---
  const { data: notificationSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings
  });

  const [notifState, setNotifState] = useState({
    emailEnabled: true,
    phoneEnabled: false,
    phoneNumber: '',
    minSeverityForCall: 'CRITICAL'
  });

  useEffect(() => {
    if (notificationSettings) {
      setNotifState({
        emailEnabled: notificationSettings.emailEnabled ?? true,
        phoneEnabled: notificationSettings.phoneEnabled ?? false,
        phoneNumber: notificationSettings.phoneNumber || '',
        minSeverityForCall: notificationSettings.minSeverityForCall || 'CRITICAL'
      });
    }
  }, [notificationSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: () => toast.success('Notification preferences updated'),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update preferences')
  });

  const handleSaveNotificationSettings = () => {
    updateSettingsMutation.mutate(notifState);
  };


  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return;
    createKeyMutation.mutate(newKeyName);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const isLoading = plansLoading || subLoading || settingsLoading;

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading settings...</div>;
  }

  // Derive usage stats
  const usageCurrent = subscription?.usage?.current || 0;
  const usageLimit = subscription?.usage?.limit || 1000;
  // Handle unlimited (-1)
  const usageDisplayLimit = usageLimit === -1 ? 'Unlimited' : usageLimit.toLocaleString();
  const usagePercent = usageLimit === -1 ? (usageCurrent > 1000 ? 100 : (usageCurrent / 1000) * 10) : Math.min((usageCurrent / usageLimit) * 100, 100);

  // Check for Pro Plan (Assuming user object has subscription from AuthContext or we can use the subscription query)
  const isPro = subscription?.plan === 'Pro' || subscription?.plan === 'Enterprise';

  return (
    <div>
      <Header title="Settings & Entitlements" />

      {/* ... (rest of the component) ... */}

      {/* Notification Preferences Section */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-500" />
              Notification Preferences
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Configure how and when you receive anomaly alerts.</p>
          </div>
          <button
            onClick={handleSaveNotificationSettings}
            disabled={updateSettingsMutation.isPending}
            className="btn btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg"
            style={{ background: 'var(--primary)' }}
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-border/40 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Email Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="font-semibold">Email Alerts</h4>
                  <p className="text-xs text-muted-foreground">Receive detailed analysis reports securely via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={notifState.emailEnabled} onChange={(e) => setNotifState({ ...notifState, emailEnabled: e.target.checked })} />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border-border"></div>
              </label>
            </div>
          </div>

          {/* Phone Settings */}
          <div className="space-y-4">
            <div className={`p-4 border rounded-xl transition-colors ${notifState.phoneEnabled ? 'bg-muted/20 border-border/50' : 'bg-transparent border-border/30'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${notifState.phoneEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      Voice Call & SMS Alerts
                      {!isPro && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full font-bold uppercase">Pro</span>}
                    </h4>
                    <p className="text-xs text-muted-foreground">Immediate calls for high-severity fraud patterns</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    disabled={!isPro}
                    checked={notifState.phoneEnabled}
                    onChange={(e) => setNotifState({ ...notifState, phoneEnabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-disabled:opacity-50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border-border"></div>
                </label>
              </div>

              {notifState.phoneEnabled && (
                <div className="space-y-4 mt-4 pt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Phone Number (E.164 context)</label>
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
                      value={notifState.phoneNumber}
                      onChange={(e) => setNotifState({ ...notifState, phoneNumber: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">Must include country code (e.g., +91, +1)</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-orange-400" /> Minimum Severity for Call
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                      value={notifState.minSeverityForCall}
                      onChange={(e) => setNotifState({ ...notifState, minSeverityForCall: e.target.value })}
                    >
                      <option value="CRITICAL">🔴 CRITICAL ONLY</option>
                      <option value="HIGH">🟠 HIGH & CRITICAL</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Key className="h-5 w-5 text-indigo-500" />
              API Keys
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Manage API keys for accessing the Ingestion API programmatically.</p>
          </div>
          {isPro ? (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="btn btn-primary flex items-center gap-2"
              style={{ background: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}
            >
              <Plus size={16} /> Generate Key
            </button>
          ) : (
            <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
              <span className="text-xs font-bold">PRO FEATURE</span>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden border border-border/40">
          {keysLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No API keys generated yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-transparent min-w-[600px]">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Prefix</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Last Used</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-medium">{key.name}</td>
                      <td className="px-6 py-4 font-mono text-xs bg-muted/20 rounded px-2 py-1 w-fit">{key.keyPrefix}...</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(key.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => revokeKeyMutation.mutate(key.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Revoke Key"
                          disabled={revokeKeyMutation.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Generate Key Modal */}
      {
        showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              {!generatedKey ? (
                <>
                  <h3 className="text-lg font-bold mb-2">Generate New API Key</h3>
                  <p className="text-sm text-muted-foreground mb-4">Enter a name for this key to identify it later.</p>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg bg-muted/30 border border-border focus:ring-2 ring-primary/50 outline-none mb-4"
                    placeholder="e.g. Production Server"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowGenerateModal(false)}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateKey}
                      disabled={!newKeyName.trim() || createKeyMutation.isPending}
                      className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {createKeyMutation.isPending ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check size={24} />
                    </div>
                    <h3 className="text-lg font-bold">API Key Generated</h3>
                    <p className="text-sm text-muted-foreground">Copy this key now. You won't be able to see it again!</p>
                  </div>

                  <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6 relative group">
                    <code className="text-sm font-mono break-all text-primary">{generatedKey.apiKey}</code>
                    <button
                      onClick={() => copyToClipboard(generatedKey.apiKey)}
                      className="absolute top-2 right-2 p-1.5 bg-background border border-border rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowGenerateModal(false);
                        setGeneratedKey(null);
                      }}
                      className="w-full px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )
      }

      <h3 className="text-xl font-bold text-foreground mb-6">Subscription Plans</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const isCurrent = subscription?.plan === plan.name;

          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "glass-panel p-8 rounded-2xl border-2 relative overflow-hidden transition-all duration-300",
                isCurrent
                  ? "border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                  : "border-transparent hover:border-border/20"
              )}
            >
              {isCurrent && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-bl-xl shadow-lg shadow-green-500/20">
                  ACTIVE
                </div>
              )}

              <h4 className="text-lg font-medium text-muted-foreground mb-2">{plan.name}</h4>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-3xl font-bold text-foreground">
                  {typeof plan.price === 'number' ? `₹${plan.price}` : plan.price}
                </span>
                {/* Improve price display checking */}
                {!['Free', 'Custom'].includes(plan.price) && <span className="text-sm text-muted-foreground mb-1"></span>}
              </div>

              <div className="space-y-4 mb-8">
                {plan.features?.map((feature) => (
                  <div key={typeof feature === 'string' ? feature : feature.name} className="flex items-center gap-3">
                    <div className={cn(
                      "flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center",
                      feature.included === false ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                    )}>
                      {feature.included === false ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    </div>
                    <span className={cn("text-sm", feature.included === false ? "text-muted-foreground/60" : "text-foreground")}>
                      {typeof feature === 'string' ? feature : feature.name}
                    </span>
                  </div>
                ))}
              </div>

              <button
                disabled={isCurrent || createOrderMutation.isPending || plan.price === 'Custom' || (PLAN_RANK[plan.name] < (PLAN_RANK[subscription?.plan] || 0))}
                onClick={() => handleUpgrade(plan.name)}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-medium transition-all duration-300",
                  isCurrent
                    ? "bg-green-500/10 text-green-500 ring-1 ring-green-500/50 cursor-default"
                    : plan.price === 'Custom'
                      ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                      : (PLAN_RANK[plan.name] < (PLAN_RANK[subscription?.plan] || 0))
                        ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20",
                )}
              >
                {isCurrent
                  ? 'Current Plan'
                  : plan.price === 'Custom'
                    ? 'Coming Soon'
                    : (PLAN_RANK[plan.name] < (PLAN_RANK[subscription?.plan] || 0))
                      ? 'Included'
                      : createOrderMutation.isPending ? 'Processing...' : 'Upgrade'}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div >
  );
}
