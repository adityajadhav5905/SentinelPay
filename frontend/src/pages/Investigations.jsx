import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert, Brain, Search, Filter, CheckCircle2, AlertTriangle, XCircle,
  Clock, ArrowUpRight, Cpu, FileText, Check, ChevronRight, X, ExternalLink,
  Sliders, Activity, Eye, Zap, Layers, BookOpen, ShieldCheck, Scale, RefreshCw,
  UserCheck, AlertOctagon, HelpCircle
} from 'lucide-react';
import { fetchInvestigations, fetchInvestigationDetail, submitInvestigationDecision } from '../api-integration/investigations';
import { toast } from 'sonner';

export default function Investigations() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [activeTab, setActiveTab] = useState('steps'); // steps | factors | rules | behavior
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const queryTxId = searchParams.get('txId');
  const queryCaseNumber = searchParams.get('caseNumber');
  const queryId = searchParams.get('id');

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await fetchInvestigations({
        status: filterStatus,
        priority: filterPriority
      });
      const items = res.data || [];
      setCases(items);
    } catch (err) {
      console.error('Failed to load investigation cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [filterStatus, filterPriority]);

  // Handle deep link / navigation from Live Feed or Anomalies page
  useEffect(() => {
    if (cases.length > 0 && (queryTxId || queryCaseNumber || queryId)) {
      const matched = cases.find(c => 
        c.id === queryId ||
        c.caseNumber === queryCaseNumber ||
        c.transaction?.txId === queryTxId ||
        c.transactionId === queryTxId ||
        c.anomalyId === queryId ||
        c.caseNumber?.toLowerCase().includes((queryTxId || '').toLowerCase())
      );
      if (matched) {
        handleInspectCase(matched.id);
      }
    }
  }, [cases, queryTxId, queryCaseNumber, queryId]);

  const handleInspectCase = async (id) => {
    try {
      setSelectedCaseId(id);
      setDetailLoading(true);
      const detail = await fetchInvestigationDetail(id);
      setCaseDetail(detail);
      setActionNotes('');
    } catch (err) {
      console.error('Failed to load case detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDecision = async (action, actionLabel) => {
    if (!selectedCaseId) return;
    try {
      setSubmittingAction(true);
      await submitInvestigationDecision(selectedCaseId, action, actionNotes);
      toast.success(`Case ${caseDetail?.caseNumber || ''} updated: ${actionLabel}`);
      // Reload detail and list
      const updated = await fetchInvestigationDetail(selectedCaseId);
      setCaseDetail(updated);
      loadCases();
    } catch (err) {
      console.error('Failed to record decision:', err);
      toast.error('Failed to submit triage decision');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'BLOCKED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"><AlertOctagon className="w-3.5 h-3.5" /> Confirmed Fraud</span>;
      case 'VERIFIED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"><ShieldCheck className="w-3.5 h-3.5" /> Verification Sent</span>;
      case 'FLAGGED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"><AlertTriangle className="w-3.5 h-3.5" /> Under Review</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"><CheckCircle2 className="w-3.5 h-3.5" /> Genuine (Cleared)</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"><Clock className="w-3.5 h-3.5" /> Pending Review</span>;
    }
  };

  const getRecommendationBadge = (rec) => {
    switch (rec) {
      case 'BLOCK':
        return <span className="text-xs px-2 py-0.5 rounded font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">CONFIRM FRAUD</span>;
      case 'VERIFY':
        return <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">VERIFY IDENTITY</span>;
      case 'FLAG':
        return <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">ESCALATE REVIEW</span>;
      case 'APPROVE':
        return <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">CLEAR (GENUINE)</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded font-bold bg-muted text-muted-foreground">REVIEW</span>;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium mb-2">
            <Brain className="w-3.5 h-3.5" /> AI Investigation Engine
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Case Investigations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review flagged transactions, AI-generated evidence, risk factors, and take action.
          </p>
        </div>
        <button
          onClick={loadCases}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Cases
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-muted-foreground">Active Cases</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"><FileText className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{cases.length}</div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Investigation cases in queue</div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-muted-foreground">High Risk Cases</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400"><ShieldAlert className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold mt-2 text-red-600 dark:text-red-400">
            {cases.filter(c => c.priority === 'CRITICAL' || c.priority === 'HIGH').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Requiring immediate risk triage</div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-muted-foreground">Avg Model Confidence</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {cases.length > 0 ? `${Math.round((cases.reduce((acc, c) => acc + (c.agentConfidence || 0.92), 0) / cases.length) * 100)}%` : '94%'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Multi-signal correlation accuracy</div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-muted-foreground">Actioned / Cleared</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400"><ShieldCheck className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {cases.filter(c => c.status !== 'PENDING_REVIEW').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Completed analyst evaluations</div>
        </div>
      </div>

      {/* Case List View */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Table Filter Controls */}
        <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter Queue:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-background border border-input text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="FLAGGED">Under Review</option>
              <option value="VERIFIED">Verification Sent</option>
              <option value="BLOCKED">Confirmed Fraud</option>
              <option value="APPROVED">Genuine (Cleared)</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-background border border-input text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Case Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider font-bold border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Case #</th>
                <th className="py-3.5 px-4">Transaction / Entity</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Risk Level</th>
                <th className="py-3.5 px-4">Suggested Action</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading investigation cases...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No investigation cases found for this filter.
                  </td>
                </tr>
              ) : (
                cases.map(c => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-4 px-4 font-mono font-bold text-xs text-foreground">
                      {c.caseNumber}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-foreground">{c.transaction?.merchant || 'Digital Transaction'}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.transaction?.txId || c.transactionId || 'TXN-Direct'}</div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-foreground">
                      ₹{c.transaction?.amount ? Number(c.transaction.amount).toLocaleString('en-IN') : '0'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              c.riskScore >= 0.85 ? 'bg-red-500' : c.riskScore >= 0.65 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.round(c.riskScore * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-foreground">{(c.riskScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Confidence: {((c.agentConfidence || 0.95) * 100).toFixed(0)}%</div>
                    </td>
                    <td className="py-4 px-4">
                      {getRecommendationBadge(c.recommendation)}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(c.status)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleInspectCase(c.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect Case
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Investigation Modal (Fully Theme Consistent in Light & Dark Mode) */}
      <AnimatePresence>
        {selectedCaseId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-5xl bg-card text-card-foreground border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border flex justify-between items-start bg-muted/20">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1.5">
                    <span className="font-mono text-lg font-extrabold text-foreground">{caseDetail?.caseNumber}</span>
                    {getStatusBadge(caseDetail?.status)}
                    {caseDetail?.recommendation && getRecommendationBadge(caseDetail.recommendation)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Merchant: <strong className="text-foreground">{caseDetail?.transaction?.merchant || 'N/A'}</strong> |
                    Amount: <strong className="text-foreground">₹{Number(caseDetail?.transaction?.amount || 0).toLocaleString('en-IN')}</strong> |
                    Location: <strong className="text-foreground">{caseDetail?.transaction?.location || 'N/A'}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCaseId(null)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {detailLoading ? (
                  <div className="py-20 text-center text-muted-foreground">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                    Loading case evidence and risk factors...
                  </div>
                ) : (
                  <>
                    {/* Executive Summary Banner */}
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-sm">
                      <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        <Brain className="w-4 h-4" /> AI Investigation Summary
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {caseDetail?.summary}
                      </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-border gap-6 overflow-x-auto">
                      <button
                        onClick={() => setActiveTab('steps')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
                          activeTab === 'steps'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <FileText className="w-4 h-4" /> Investigation Steps & Trail
                      </button>
                      <button
                        onClick={() => setActiveTab('factors')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
                          activeTab === 'factors'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Sliders className="w-4 h-4" /> Risk Factor Breakdown
                      </button>
                      <button
                        onClick={() => setActiveTab('rules')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
                          activeTab === 'rules'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" /> Matched Rules & Precedents
                      </button>
                      <button
                        onClick={() => setActiveTab('behavior')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
                          activeTab === 'behavior'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Activity className="w-4 h-4" /> Account Activity Context
                      </button>
                    </div>

                    {/* Tab 1: Investigation Steps */}
                    {activeTab === 'steps' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                            Step-by-Step Investigation Timeline
                          </h4>
                          <div className="space-y-3">
                            {(caseDetail?.investigation?.planSteps || []).map((s, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                  {s.step || idx + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-sm text-foreground flex items-center justify-between">
                                    <span>{s.action}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                                      {s.status || 'COMPLETED'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">{s.output || s.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {caseDetail?.investigation?.agentReasoning && (
                          <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                              Synthesis & Reasoning Log
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {caseDetail.investigation.agentReasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Risk Factors */}
                    {activeTab === 'factors' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Key Risk Contributors
                          </h4>
                          <p className="text-xs text-muted-foreground mb-4">
                            Detailed breakdown of the specific transactional and behavioral factors contributing to this anomaly score.
                          </p>
                        </div>

                        <div className="space-y-3">
                          {(caseDetail?.investigation?.shapFactors || []).map((f, idx) => {
                            const impactVal = f.impact || f.importance || 0.3;
                            return (
                              <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-sm font-bold text-foreground">{f.feature}</span>
                                  <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">
                                    +{Math.round(impactVal * 100)}% Risk Impact
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{f.description || f.contribution || 'Elevated risk contribution.'}</p>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full"
                                    style={{ width: `${Math.min(100, Math.round(impactVal * 100))}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Matched Rules & Precedents */}
                    {activeTab === 'rules' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Matched Fraud Rules & Precedents
                          </h4>
                          <p className="text-xs text-muted-foreground mb-4">
                            Historical patterns and regulatory circulars referenced during risk evaluation.
                          </p>
                        </div>

                        <div className="space-y-3">
                          {(caseDetail?.investigation?.ragCitations || []).map((c, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                  {c.code}
                                </span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  {Math.round((c.similarity || 0.90) * 100)}% Match
                                </span>
                              </div>
                              <h5 className="font-bold text-sm text-foreground">{c.title}</h5>
                              {c.snippet && (
                                <p className="text-xs text-muted-foreground leading-relaxed italic bg-background p-2.5 rounded-lg border border-border">
                                  "{c.snippet}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 4: Behavioral Context */}
                    {activeTab === 'behavior' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                            Account Activity & Deviation Matrix
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {Object.entries(caseDetail?.investigation?.behavioralSignals || {}).map(([key, val]) => (
                              <div key={key} className="p-3.5 rounded-xl bg-muted/40 border border-border">
                                <div className="text-[11px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                                <div className="text-sm font-bold text-foreground mt-1">{String(val)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer: Standard Fraud Triage Operations Actions */}
              <div className="p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Add optional analyst justification notes..."
                    className="w-full px-4 py-2 rounded-xl bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={submittingAction}
                    onClick={() => handleDecision('APPROVE', 'Genuine (Cleared)')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30 transition-all flex items-center gap-1.5"
                    title="Clear risk flag and mark as genuine activity"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Genuine (Clear)
                  </button>

                  <button
                    disabled={submittingAction}
                    onClick={() => handleDecision('FLAG', 'Escalated for Review')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/30 transition-all flex items-center gap-1.5"
                    title="Escalate case to senior risk investigators"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Escalate for Review
                  </button>

                  <button
                    disabled={submittingAction}
                    onClick={() => handleDecision('VERIFY', 'Requested Customer Verification')}
                    className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-500/30 transition-all flex items-center gap-1.5"
                    title="Prompt customer for identity/OTP verification"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Request Verification
                  </button>

                  <button
                    disabled={submittingAction}
                    onClick={() => handleDecision('BLOCK', 'Confirmed Fraud (Incident)')}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/30 transition-all flex items-center gap-1.5"
                    title="Confirm true fraud and log incident report"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" /> Confirm Fraud (Incident)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
