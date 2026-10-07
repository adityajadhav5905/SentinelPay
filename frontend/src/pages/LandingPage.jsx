import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  ArrowRight, ShieldCheck, Zap, AlertTriangle, Sun, Moon, Menu, X,
  Upload, Eye, FileText, CheckCircle2, TrendingUp, Clock, Brain, Shield,
  ChevronRight, Sparkles, Activity, Search, Bell, XCircle, BarChart3,
  Lock, Globe, Cpu, Database
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/* ═══════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

// ── Animated number counter ──
const Counter = ({ end, suffix = '', decimals = 0, duration = 2200 }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let t = 0;
        const step = end / (duration / 16);
        const id = setInterval(() => {
          t += step;
          if (t >= end) { setVal(end); clearInterval(id); }
          else setVal(decimals ? parseFloat(t.toFixed(decimals)) : Math.floor(t));
        }, 16);
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end, duration, decimals]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

// ── Rotating words in hero headline ──
const RotatingWord = ({ words }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <span className="inline-block relative" style={{ minWidth: '220px' }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[idx]}
          initial={{ y: 30, opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -30, opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"
        >
          {words[idx]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

// ── Floating gradient orb ──
const Orb = ({ className, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25], x: [0, 20, 0], y: [0, -15, 0] }}
    transition={{ duration: 10 + delay * 2, repeat: Infinity, ease: 'easeInOut', delay }}
  />
);

// ── Section reveal wrapper ──
const Reveal = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ═══════════════════════════════════════════════════════════════
   INTERACTIVE PRODUCT DEMO  (Hero right-side)
   ═══════════════════════════════════════════════════════════════ */
const ProductDemo = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const cycle = () => {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 2400);
      const t2 = setTimeout(() => setStep(2), 5200);
      return [t1, t2];
    };
    let timers = cycle();
    const loop = setInterval(() => { timers = cycle(); }, 9000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const rows = [
    { id: 'TXN-4821', amt: '$142.50', loc: 'New York', ok: true },
    { id: 'TXN-4822', amt: '$8,940', loc: 'Lagos → Tokyo', ok: false },
    { id: 'TXN-4823', amt: '$67.30', loc: 'London', ok: true },
    { id: 'TXN-4824', amt: '$3,200', loc: 'São Paulo', ok: false },
    { id: 'TXN-4825', amt: '$28.99', loc: 'Berlin', ok: true },
  ];

  const stepLabels = ['Upload Data', 'AI Analysis', 'View Results'];

  return (
    <div className="w-full h-full flex flex-col select-none">
      {/* window chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Lock className="w-3 h-3" /> sentinelpay.app/dashboard</span>
        <div className="w-14" />
      </div>

      {/* step bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
        {stepLabels.map((l, i) => (
          <div key={l} className="flex items-center gap-1.5">
            <motion.div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-500 ${step >= i ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-muted text-muted-foreground'}`}
              animate={step === i ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.8, repeat: step === i ? Infinity : 0, repeatDelay: 1 }}
            >
              {step > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </motion.div>
            <span className={`text-[11px] font-medium hidden sm:inline transition-colors duration-300 ${step >= i ? 'text-foreground' : 'text-muted-foreground/60'}`}>{l}</span>
            {i < 2 && <ChevronRight className="w-3 h-3 text-border" />}
          </div>
        ))}
      </div>

      {/* step content */}
      <div className="flex-1 p-4 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/25 rounded-xl bg-primary/[0.04]">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <Upload className="w-10 h-10 text-primary" />
              </motion.div>
              <p className="text-sm font-semibold">Uploading transactions.csv</p>
              <div className="w-52 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2, ease: 'easeInOut' }} />
              </div>
              <p className="text-[11px] text-muted-foreground">2,847 rows • 340 KB</p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="h-full flex flex-col items-center justify-center gap-4">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
                <Cpu className="w-11 h-11 text-primary" />
              </motion.div>
              <p className="text-sm font-semibold">AI scanning every row…</p>
              <p className="text-[11px] text-muted-foreground">Checking 11 risk signals per transaction</p>
              <div className="flex gap-2 flex-wrap justify-center max-w-xs">
                {['Geo velocity', 'Spending spike', 'Time anomaly', 'Amount z-score', 'Device shift'].map((t, i) => (
                  <motion.span key={t} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.25 }} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                    {t}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="h-full flex flex-col gap-2">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/50 text-[11px] font-medium">
                <span>Scan Complete</span>
                <div className="flex gap-3">
                  <span className="text-green-500">2,845 OK</span>
                  <span className="text-red-500">2 Flagged</span>
                </div>
              </div>
              <div className="rounded-lg border border-border/40 overflow-hidden text-[11px]">
                <div className="grid grid-cols-4 gap-1 px-3 py-1.5 bg-muted/30 font-semibold text-muted-foreground">
                  <span>ID</span><span>Amount</span><span>Location</span><span>Status</span>
                </div>
                {rows.map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className={`grid grid-cols-4 gap-1 px-3 py-1.5 border-t border-border/20 ${!r.ok ? 'bg-red-500/[0.04]' : ''}`}>
                    <span className="font-mono">{r.id}</span>
                    <span className={!r.ok ? 'text-red-500 font-semibold' : ''}>{r.amt}</span>
                    <span className="text-muted-foreground">{r.loc}</span>
                    <span>{r.ok
                      ? <span className="inline-flex items-center gap-0.5 text-green-500"><CheckCircle2 className="w-3 h-3" /> OK</span>
                      : <span className="inline-flex items-center gap-0.5 text-red-500 font-semibold"><AlertTriangle className="w-3 h-3" /> Flag</span>}
                    </span>
                  </motion.div>
                ))}
              </div>
              {/* explanation card */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-auto p-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.04] text-[11px]">
                <p className="font-semibold text-red-500 mb-0.5">⚠ TXN-4822 flagged</p>
                <p className="text-muted-foreground">"Card used in Tokyo 2 h after a swipe in Lagos — impossible travel speed."</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════ */
const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileNav, setMobileNav] = useState(false);
  const go = (p) => navigate(p);

  /* ── Features data ── */
  const features = [
    { icon: <Cpu className="w-6 h-6 text-indigo-400" />, title: 'Real-Time Risk Scoring', desc: "Calculates instant fraud probability and behavioral anomaly scores across transactional, temporal, and velocity metrics." },
    { icon: <Brain className="w-6 h-6 text-purple-400" />, title: 'Autonomous Agentic Investigation', desc: "Autonomous AI agents plan multi-step investigations, correlate evidence, check account histories, and formulate calibrated risk verdicts." },
    { icon: <FileText className="w-6 h-6 text-cyan-400" />, title: 'Transparent Risk Factor Breakdown', desc: 'Provides clear explanations and factor attribution for every flagged transaction, eliminating black-box opacity.' },
    { icon: <Globe className="w-6 h-6 text-emerald-400" />, title: 'Knowledge Base & Case Precedents', desc: 'Retrieves similar historical fraud patterns, regulatory mandates (RBI/PCI-DSS), and known threat signatures instantly.' },
    { icon: <ShieldCheck className="w-6 h-6 text-blue-400" />, title: 'Deterministic Policy Governance', desc: 'Applies rigorous business rules and compliance thresholds to enforce reliable final actions: Approved, Flagged, Verified, or Escalated.' },
    { icon: <Bell className="w-6 h-6 text-rose-400" />, title: 'Multi-Channel Response Orchestration', desc: 'Dispatches real-time incident cases, live dashboard feeds, and urgent alerts across Email, SMS, and automated notifications.' },
  ];

  /* ── Comparison data ── */
  const without = [
    'Static rule-based filters that fail on novel attack vectors',
    'Black-box models offering zero reasoning or human-readable explanation',
    'High false positive rates overwhelming risk operations teams',
    'Disjointed manual policy lookup across disconnected PDF documents',
    'Slow batch-only processing without autonomous investigation assistance',
  ];
  const withA = [
    'Adaptive real-time anomaly detection backed by transparent risk factor breakdown',
    'Autonomous AI agent reasoning and multi-point evidence synthesis',
    'Unified regulatory and case precedent retrieval from integrated knowledge base',
    'Hybrid decision governance marrying deterministic rules with intelligent triage',
    'Real-time transaction streaming & statement ingestion with multi-channel alerting',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* ═══════ NAVBAR ═══════ */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => go('/')}>
            <img src="/sentinelpay-logo.svg" alt="SentinelPay" className="h-8 w-8" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-cyan-500">SentinelPay</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">How It Works</a>
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
            <a href="#compare" className="text-sm font-medium hover:text-primary transition-colors">Compare</a>
            <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-muted transition-colors" aria-label="Toggle theme">
              <div className="relative h-5 w-5">
                <Sun className={`absolute inset-0 h-5 w-5 text-yellow-500 transition-all ${theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`} />
                <Moon className={`absolute inset-0 h-5 w-5 text-indigo-400 transition-all ${theme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'}`} />
              </div>
            </button>
            {isAuthenticated ? (
              <button onClick={() => go('/dashboard')} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Dashboard</button>
            ) : (<>
              <button onClick={() => go('/login')} className="px-4 py-2 rounded-full border border-border hover:bg-muted transition-all text-sm font-medium">Sign In</button>
              <button onClick={() => go('/dashboard')} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Get Started</button>
            </>)}
          </div>

          <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden p-2 rounded-xl hover:bg-muted" aria-label="Menu">
            {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileNav && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="md:hidden border-t border-border/50 overflow-hidden">
              <div className="px-4 py-4 space-y-3">
                {['How It Works:#how-it-works', 'Features:#features', 'Compare:#compare'].map(s => {
                  const [label, href] = s.split(':');
                  return <a key={label} href={href} onClick={() => setMobileNav(false)} className="block text-sm font-medium py-2 hover:text-primary transition-colors">{label}</a>;
                })}
                <div className="flex gap-2 pt-3 border-t border-border/30">
                  <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-muted"><Sun className="h-5 w-5" /></button>
                  {isAuthenticated
                    ? <button onClick={() => { go('/dashboard'); setMobileNav(false); }} className="flex-1 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium">Dashboard</button>
                    : <>
                        <button onClick={() => { go('/login'); setMobileNav(false); }} className="flex-1 py-2 rounded-full border border-border text-sm font-medium">Sign In</button>
                        <button onClick={() => { go('/dashboard'); setMobileNav(false); }} className="flex-1 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium">Get Started</button>
                      </>
                  }
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-28 pb-6 lg:pt-40 lg:pb-12 dot-grid overflow-hidden">
        <Orb className="w-[500px] h-[500px] bg-purple-500/20 -top-40 right-0" delay={0} />
        <Orb className="w-[350px] h-[350px] bg-cyan-500/20 top-1/2 -left-32" delay={1.5} />
        <Orb className="w-[300px] h-[300px] bg-indigo-500/15 bottom-0 right-1/4" delay={3} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* left text */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI-Powered Fraud Detection</span>
              </motion.div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1] mb-6">
                Upload your data.
                <br />
                We catch the{' '}
                <RotatingWord words={['fraud.', 'anomalies.', 'threats.', 'risks.']} />
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed">
                SentinelPay scans every transaction with AI and instantly highlights suspicious activity — with plain-English explanations of <em className="text-foreground font-medium">why</em> each one was flagged.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button onClick={() => go('/dashboard')} className="group px-8 py-4 rounded-full bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary/90 transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2">
                  Start Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <a href="#how-it-works" className="px-8 py-4 rounded-full border border-border hover:bg-muted transition-all text-lg font-medium text-center">See How It Works</a>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> No credit card</span>
                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-blue-500" /> SOC 2 compliant</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-purple-500" /> 2-min setup</span>
              </div>
            </motion.div>

            {/* right demo */}
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3 }} className="relative">
              <div className="gradient-border-animated">
                <div className="rounded-2xl bg-card/90 backdrop-blur-sm shadow-2xl overflow-hidden relative scan-line" style={{ minHeight: 400 }}>
                  <ProductDemo />
                </div>
              </div>
              <div className="absolute -inset-3 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-2xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ METRICS STRIP ═══════ */}
      <section className="py-14 border-y border-border/30 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { v: 99.8, s: '%', d: 1, label: 'Detection Accuracy', icon: <TrendingUp className="w-5 h-5 text-green-500" /> },
              { v: 11, s: '', d: 0, label: 'Risk Signals / Row', icon: <Brain className="w-5 h-5 text-purple-500" /> },
              { v: 50, s: 'ms', d: 0, label: 'Avg Response Time', icon: <Clock className="w-5 h-5 text-blue-500" /> },
              { v: 10000, s: '+', d: 0, label: 'TXN / sec Throughput', icon: <Zap className="w-5 h-5 text-yellow-500" /> },
            ].map((m, i) => (
              <Reveal key={i} delay={i * 0.08} className="flex flex-col items-center gap-1.5">
                {m.icon}
                <span className="text-3xl sm:text-4xl font-extrabold"><Counter end={m.v} suffix={m.s} decimals={m.d} /></span>
                <span className="text-sm text-muted-foreground">{m.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ WHAT IS SENTINELPAY ═══════ */}
      <section className="py-20 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">What is SentinelPay?</h2>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
              SentinelPay is an <strong className="text-foreground">intelligent transaction risk monitoring and fraud investigation platform</strong> combining 
              real-time behavioral anomaly detection, risk factor explainability, knowledge base precedent retrieval, and autonomous agentic reasoning.
              Instead of relying solely on opaque scores or fragile static rules, SentinelPay autonomously plans investigations, synthesizes evidence against compliance policies, and enforces deterministic governance to decide whether to <span className="text-emerald-500 font-semibold">Clear Genuine</span>, <span className="text-amber-500 font-semibold">Escalate for Review</span>, <span className="text-blue-500 font-semibold">Request Verification</span>, or <span className="text-rose-500 font-semibold">Confirm Fraud</span>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-muted/30 relative overflow-hidden">
        <Orb className="w-[400px] h-[400px] bg-indigo-500/10 -top-40 -right-40" delay={2} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Autonomous 4-Stage Intelligence Pipeline</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">From real-time multi-modal ingestion to agentic evidence correlation and policy enforcement.</p>
          </Reveal>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: '01', icon: <Upload className="w-6 h-6" />, title: 'Ingestion & OCR', desc: 'Accepts live transaction streams, simulated metadata, or bank statement uploads (PDF/CSV/Excel) with OCR normalization.', grad: 'from-indigo-500 to-indigo-600', glow: 'shadow-indigo-500/20' },
              { n: '02', icon: <Cpu className="w-6 h-6" />, title: 'Risk & Factor Scoring', desc: 'Computes velocity and behavioral features, assigning calibrated risk scores and clear factor attribution breakdown.', grad: 'from-purple-500 to-purple-600', glow: 'shadow-purple-500/20' },
              { n: '03', icon: <Database className="w-6 h-6" />, title: 'Knowledge & Rule Lookup', desc: 'Queries knowledge base for precedent fraud cases, known threat patterns, and regulatory compliance standards.', grad: 'from-cyan-500 to-cyan-600', glow: 'shadow-cyan-500/20' },
              { n: '04', icon: <ShieldCheck className="w-6 h-6" />, title: 'Investigation & Governance', desc: 'Autonomous agent executes multi-step investigation plans, checks deterministic policy rules, and triggers triage alerts.', grad: 'from-emerald-500 to-emerald-600', glow: 'shadow-emerald-500/20' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.1} className="relative group">
                <div className={`p-6 rounded-2xl bg-card border border-border/50 shadow-lg ${s.glow} glow-hover hover:-translate-y-1 transition-all duration-300 h-full flex flex-col justify-between`}>
                  <div>
                    <div className="absolute -top-4 -left-2 text-6xl font-black text-muted-foreground/[0.07] select-none">{s.n}</div>
                    <div className={`mb-4 p-2.5 rounded-xl bg-gradient-to-br ${s.grad} text-white w-fit shadow-lg ${s.glow}`}>{s.icon}</div>
                    <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES BENTO GRID ═══════ */}
      <section id="features" className="py-20 lg:py-28 relative overflow-hidden">
        <Orb className="w-[350px] h-[350px] bg-purple-500/15 bottom-20 -left-20" delay={1} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to stop fraud</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">From AI analysis to real-time alerts — one platform, zero guesswork.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <motion.div whileHover={{ y: -4 }} className="h-full p-7 rounded-2xl bg-card border border-border/50 shadow-sm glow-hover transition-shadow">
                  <div className="mb-4 p-3 rounded-xl bg-background w-fit border border-border">{f.icon}</div>
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ COMPARISON ═══════ */}
      <section id="compare" className="py-20 lg:py-28 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Traditional detection vs SentinelPay</h2>
            <p className="text-lg text-muted-foreground">See why teams are switching from rule-based systems.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Without */}
            <Reveal delay={0.1}>
              <div className="p-8 rounded-2xl border border-red-500/20 bg-red-500/[0.03] h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-red-500/10"><XCircle className="w-5 h-5 text-red-500" /></div>
                  <h3 className="font-bold text-lg">Traditional Approach</h3>
                </div>
                <ul className="space-y-4">
                  {without.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-muted-foreground">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* With */}
            <Reveal delay={0.2}>
              <div className="p-8 rounded-2xl border border-green-500/20 bg-green-500/[0.03] h-full relative overflow-hidden">
                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wide">Recommended</div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-green-500/10"><ShieldCheck className="w-5 h-5 text-green-500" /></div>
                  <h3 className="font-bold text-lg">With SentinelPay</h3>
                </div>
                <ul className="space-y-4">
                  {withA.map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ CTA BANNER ═══════ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="gradient-border-animated">
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-600" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15),transparent_60%)]" />
                <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center text-white">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5">Ready to catch what others miss?</h2>
                  <p className="text-lg text-white/80 max-w-xl mx-auto mb-10">Sign up in 30 seconds. Upload your first file. See results immediately.</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button onClick={() => go('/dashboard')} className="group px-9 py-4 rounded-full bg-white text-indigo-700 text-lg font-bold hover:bg-white/90 transition-all shadow-xl flex items-center gap-2">
                      Start Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={() => go('/login')} className="px-9 py-4 rounded-full border border-white/30 text-white text-lg font-medium hover:bg-white/10 transition-all">
                      Sign In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-14 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src="/sentinelpay-logo.svg" alt="SentinelPay" className="h-6 w-6" />
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-cyan-500">SentinelPay</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">AI-powered fraud detection that explains itself. Built for modern risk teams.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#compare" className="hover:text-foreground transition-colors">Compare</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="cursor-default">Documentation</span></li>
                <li><span className="cursor-default">API Reference</span></li>
                <li><span className="cursor-default">Changelog</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Get Started</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => go('/login')} className="hover:text-foreground transition-colors">Sign In</button></li>
                <li><button onClick={() => go('/dashboard')} className="hover:text-foreground transition-colors">Try Free</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} SentinelPay. All rights reserved.</p>
            <div className="flex gap-6">
              <span className="cursor-default hover:text-foreground transition-colors">Privacy</span>
              <span className="cursor-default hover:text-foreground transition-colors">Terms</span>
              <span className="cursor-default hover:text-foreground transition-colors">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
