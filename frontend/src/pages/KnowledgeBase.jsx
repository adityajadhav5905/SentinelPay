import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Search, ShieldCheck, FileText, BookOpen, 
  Sparkles, CheckCircle, Sliders, RefreshCw, Plus, X,
  Shield, AlertTriangle, ArrowRight, Tag, Trash2, Power, Check, AlertCircle
} from 'lucide-react';
import { 
  fetchKnowledgeDocs, 
  queryKnowledgeBase, 
  fetchDecisionPolicies,
  createKnowledgeDoc,
  createDecisionPolicy,
  deleteKnowledgeDoc,
  deleteDecisionPolicy,
  updateDecisionPolicy
} from '../api-integration/investigations';
import { toast } from 'sonner';

export default function KnowledgeBase() {
  const [docs, setDocs] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeTab, setActiveTab] = useState('docs'); // 'docs' | 'policies'
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);

  // Form states
  const [newDoc, setNewDoc] = useState({
    code: '',
    title: '',
    category: 'FRAUD_PATTERN',
    summary: '',
    content: '',
    tags: ''
  });

  const [newPolicy, setNewPolicy] = useState({
    name: '',
    description: '',
    priority: 10,
    condition: 'amount > 10000 && riskScore > 0.85',
    action: 'FLAG',
    isEnabled: true
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsRes, policiesRes] = await Promise.all([
        fetchKnowledgeDocs(),
        fetchDecisionPolicies()
      ]);
      if (Array.isArray(docsRes)) setDocs(docsRes);
      else if (docsRes?.data) setDocs(docsRes.data);

      if (Array.isArray(policiesRes)) setPolicies(policiesRes);
      else if (policiesRes?.data) setPolicies(policiesRes.data);
    } catch (e) {
      console.error('Failed to load knowledge data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const res = await queryKnowledgeBase(searchQuery);
      if (res?.results) {
        setSearchResults(res.results);
      } else if (res?.data) {
        setSearchResults(res.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Search query failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateDoc = async (e) => {
    e.preventDefault();
    if (!newDoc.title.trim() || !newDoc.content.trim()) {
      toast.error('Please enter a title and content.');
      return;
    }

    setSubmitting(true);
    try {
      await createKnowledgeDoc(newDoc);
      toast.success('Document added successfully!');
      setShowAddDocModal(false);
      setNewDoc({ code: '', title: '', category: 'FRAUD_PATTERN', summary: '', content: '', tags: '' });
      loadData();
    } catch (err) {
      console.error('Failed to create doc:', err);
      toast.error('Failed to add document.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDoc = async (id, title) => {
    if (!window.confirm(`Are you sure you want to remove "${title}"?`)) return;
    try {
      await deleteKnowledgeDoc(id);
      toast.success('Document removed from knowledge base.');
      setDocs(prev => prev.filter(d => d.id !== id));
      if (searchResults) {
        setSearchResults(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
      toast.error('Failed to delete document.');
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    if (!newPolicy.name.trim()) {
      toast.error('Please enter a rule name.');
      return;
    }

    setSubmitting(true);
    try {
      await createDecisionPolicy(newPolicy);
      toast.success('Decision Rule added successfully!');
      setShowAddPolicyModal(false);
      setNewPolicy({
        name: '',
        description: '',
        priority: 10,
        condition: 'amount > 10000 && riskScore > 0.85',
        action: 'FLAG',
        isEnabled: true
      });
      loadData();
    } catch (err) {
      console.error('Failed to create policy:', err);
      toast.error('Failed to add decision rule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePolicy = async (policy) => {
    const nextState = policy.isEnabled === false;
    try {
      await updateDecisionPolicy(policy.id, { isEnabled: nextState });
      setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, isEnabled: nextState } : p));
      toast.success(`Rule "${policy.name}" ${nextState ? 'enforced (enabled)' : 'un-enforced (disabled)'}`);
    } catch (err) {
      console.error('Failed to toggle policy:', err);
      toast.error('Failed to update rule status.');
    }
  };

  const handleDeletePolicy = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete rule "${name}"?`)) return;
    try {
      await deleteDecisionPolicy(id);
      toast.success('Decision rule deleted.');
      setPolicies(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete policy:', err);
      toast.error('Failed to delete rule.');
    }
  };

  const displayedDocs = searchResults || docs;
  const filteredDocs = displayedDocs.filter(doc => {
    if (activeCategory === 'ALL') return true;
    return doc.category === activeCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Intelligence & Rule Engine
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-foreground">
            Fraud Rules & Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search known fraud patterns, regulatory guidance, and automated decision rules used during transaction analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          
          {activeTab === 'docs' ? (
            <button
              onClick={() => setShowAddDocModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              Add Document
            </button>
          ) : (
            <button
              onClick={() => setShowAddPolicyModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              Add Decision Rule
            </button>
          )}
        </div>
      </div>

      {/* Navigation Switch */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'docs'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Knowledge & Precedents ({docs.length})
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'policies'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Decision Rules & Policies ({policies.length})
        </button>
      </div>

      {activeTab === 'docs' ? (
        <>
          {/* Smart Search Bar */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-indigo-500 dark:text-cyan-400" />
              <span className="text-sm font-bold text-foreground">Smart Pattern & Regulation Search</span>
              <span className="text-xs text-muted-foreground ml-auto">Search across known fraud cases & compliance circulars</span>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. 'Rapid outflow transfers', 'Account takeover', 'High value limit'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
              {searchResults && (
                <button
                  type="button"
                  onClick={() => { setSearchResults(null); setSearchQuery(''); }}
                  className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
                >
                  Clear Results
                </button>
              )}
            </form>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {['ALL', 'FRAUD_PATTERN', 'REGULATION', 'CASE_STUDY', 'POLICY'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    activeCategory === cat
                      ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40'
                      : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Docs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-card border border-border hover:border-indigo-500/40 shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {doc.code || doc.docCode}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {doc.category ? doc.category.replace('_', ' ') : 'GENERAL'}
                      </span>
                      <button
                        onClick={() => handleDeleteDoc(doc.id, doc.title)}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded"
                        title="Remove Document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-foreground mb-2">{doc.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {doc.content}
                  </p>
                </div>

                <div>
                  {doc.tags && (
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
                      {(Array.isArray(doc.tags) ? doc.tags : []).map((t, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                          #{t}
                        </span>
                      ))}
                      {doc.similarityScore && (
                        <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          Match: {(doc.similarityScore * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        /* Policies View */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-card border border-border text-xs text-muted-foreground flex items-center gap-3">
            <Sliders className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
            <span>
              Decision Rules define automated triage suggestions and compliance flags based on transaction risk signals. You can enforce or un-enforce any rule at any time.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {policies.map((pol) => {
              const isEnforced = pol.isEnabled !== false;
              return (
                <div
                  key={pol.id}
                  className={`p-5 rounded-2xl bg-card border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
                    isEnforced ? 'border-border' : 'border-border/40 opacity-70'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-cyan-400 bg-indigo-500/10 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {pol.name}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                        Priority: {pol.priority}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isEnforced ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isEnforced ? 'ENFORCED' : 'UN-ENFORCED'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{pol.description}</p>
                    
                    {/* Condition & Action */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-muted-foreground">Trigger Condition:</span>
                      <code className="bg-background px-2 py-1 rounded border border-border text-indigo-600 dark:text-indigo-300">
                        {typeof pol.condition === 'object' ? JSON.stringify(pol.condition) : String(pol.condition)}
                      </code>
                      <span className="text-muted-foreground">Suggested Action:</span>
                      <span className="font-bold text-foreground px-2 py-1 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                        {pol.action === 'APPROVE' ? 'CLEAR (LEGITIMATE)' : pol.action === 'BLOCK' ? 'CONFIRM FRAUD' : pol.action}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleTogglePolicy(pol)}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                        isEnforced
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                      }`}
                      title={isEnforced ? 'Click to Un-enforce' : 'Click to Enforce'}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {isEnforced ? 'Enforced (Active)' : 'Un-enforce'}
                    </button>

                    <button
                      onClick={() => handleDeletePolicy(pol.id, pol.name)}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Delete Policy"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Add Document (Fully Theme Consistent for Light & Dark Mode) */}
      <AnimatePresence>
        {showAddDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">Add Knowledge Document</h3>
                <button onClick={() => setShowAddDocModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDoc} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Document Reference Code (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. PAT-005, REG-08"
                    value={newDoc.code}
                    onChange={(e) => setNewDoc({ ...newDoc, code: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Account Takeover via Credential Stuffing"
                    value={newDoc.title}
                    onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                  <select
                    value={newDoc.category}
                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="FRAUD_PATTERN">Fraud Pattern</option>
                    <option value="REGULATION">Regulatory Guideline</option>
                    <option value="CASE_STUDY">Case Study</option>
                    <option value="POLICY">Internal Policy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Content Details *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Detailed indicators, rules, or guidance for this fraud pattern..."
                    value={newDoc.content}
                    onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. velocity, upi, phishing, identity-theft"
                    value={newDoc.tags}
                    onChange={(e) => setNewDoc({ ...newDoc, tags: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddDocModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Document'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add Policy Rule (Fully Theme Consistent for Light & Dark Mode) */}
      <AnimatePresence>
        {showAddPolicyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">Add Decision Rule</h3>
                <button onClick={() => setShowAddPolicyModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePolicy} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Rule Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Critical High-Value Risk Rule"
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Escalate transactions when risk score is high."
                    value={newPolicy.description}
                    onChange={(e) => setNewPolicy({ ...newPolicy, description: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Priority (1 = Highest)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newPolicy.priority}
                      onChange={(e) => setNewPolicy({ ...newPolicy, priority: parseInt(e.target.value) || 10 })}
                      className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Recommended Action *</label>
                    <select
                      value={newPolicy.action}
                      onChange={(e) => setNewPolicy({ ...newPolicy, action: e.target.value })}
                      className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="FLAG">FLAG (Escalate for Review)</option>
                      <option value="VERIFY">VERIFY (Request Customer Verification)</option>
                      <option value="BLOCK">CONFIRM FRAUD (Report Incident)</option>
                      <option value="APPROVE">APPROVE (Mark Genuine)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Trigger Condition</label>
                  <input
                    type="text"
                    placeholder="e.g. riskScore >= 0.85 || velocityExceeded == true"
                    value={newPolicy.condition}
                    onChange={(e) => setNewPolicy({ ...newPolicy, condition: e.target.value })}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddPolicyModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Decision Rule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
