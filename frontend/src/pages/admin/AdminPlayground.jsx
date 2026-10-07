import { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api-integration/admin';
import { Terminal, Send, Trash2, Code, Server, ChevronRight, ChevronDown, MonitorPlay, Search, Layers, Box, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';


export default function AdminPlayground() {
    // Discovery
    const [services, setServices] = useState([]);
    const [isDiscovering, setIsDiscovering] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Selection
    const [selectedService, setSelectedService] = useState(null); // Service Name
    const [expandedTags, setExpandedTags] = useState({}); // { serviceName: { tagName: bool } }

    // Request State
    const [method, setMethod] = useState('POST');
    const [serviceName, setServiceName] = useState('ingestion-service');
    const [path, setPath] = useState('/v1/upload');
    const [port, setPort] = useState(3000);
    const [body, setBody] = useState('{\n  "test": "value"\n}');
    const [headers, setHeaders] = useState([
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Authorization', value: '', enabled: false }
    ]);
    const [params, setParams] = useState([
        { key: '', value: '', enabled: true }
    ]);
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('body'); // body | params | headers

    useEffect(() => {
        loadRoutes();
    }, []);

    const loadRoutes = async () => {
        setIsDiscovering(true);
        try {
            const data = await adminApi.getDiscoveredRoutes();
            setServices(data);
            // Expand first service by default
            if (data.length > 0) setSelectedService(data[0].service);
        } catch (error) {
            toast.error('Discovery failed');
        } finally {
            setIsDiscovering(false);
        }
    };

    // Group endpoints by Tag for a service
    const getGroupedEndpoints = (svc) => {
        const grouped = {};
        svc.endpoints.forEach(ep => {
            const tag = ep.tags?.[0] || 'General';
            if (!grouped[tag]) grouped[tag] = [];
            grouped[tag].push(ep);
        });
        return grouped;
    };

    const toggleTag = (svcName, tagName) => {
        setExpandedTags(prev => ({
            ...prev,
            [svcName]: { ...prev[svcName], [tagName]: !prev[svcName]?.[tagName] }
        }));
    };

    const selectEndpoint = (svc, ep) => {
        setServiceName(svc.service);
        setPort(svc.port);
        setMethod(ep.method);
        setPath(ep.path);
        setBody(ep.body || '{}');
        setResponse(null);
    };

    // Header management
    const addHeader = () => setHeaders([...headers, { key: '', value: '', enabled: true }]);
    const removeHeader = (idx) => setHeaders(headers.filter((_, i) => i !== idx));
    const updateHeader = (idx, field, val) => {
        const updated = [...headers];
        updated[idx][field] = val;
        setHeaders(updated);
    };

    // Param management
    const addParam = () => setParams([...params, { key: '', value: '', enabled: true }]);
    const removeParam = (idx) => setParams(params.filter((_, i) => i !== idx));
    const updateParam = (idx, field, val) => {
        const updated = [...params];
        updated[idx][field] = val;
        setParams(updated);
    };

    const handleSend = async () => {
        setLoading(true);
        setResponse(null);
        try {
            let parsedBody = {};
            try {
                parsedBody = JSON.parse(body);
            } catch (e) {
                if (body.trim() && method !== 'GET') throw new Error('Invalid JSON Body');
            }

            // Build headers object from array
            const headersObj = {};
            headers.filter(h => h.enabled && h.key).forEach(h => {
                headersObj[h.key] = h.value;
            });

            // Build query params
            const queryParams = params.filter(p => p.enabled && p.key).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
            const finalPath = queryParams ? `${path}?${queryParams}` : path;

            const res = await adminApi.proxyRequest({
                service: serviceName,
                port,
                method,
                path: finalPath,
                body: parsedBody,
                headers: headersObj
            });
            setResponse(res);
            toast.success('Success', { className: 'bg-green-500/10 text-green-500 border-green-500/20' });
        } catch (error) {
            console.error(error);
            setResponse({ error: error.response?.data || error.message, status: error.response?.status || 500 });
            toast.error('Failed', { className: 'bg-red-500/10 text-red-500 border-red-500/20' });
        } finally {
            setLoading(false);
        }
    };

    // Filter services based on search
    const filteredServices = useMemo(() => {
        if (!searchTerm) return services;
        const lower = searchTerm.toLowerCase();
        return services.filter(s =>
            s.service.toLowerCase().includes(lower) ||
            s.endpoints.some(e => e.path.toLowerCase().includes(lower))
        );
    }, [services, searchTerm]);

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6 overflow-hidden max-w-[1600px] mx-auto">
            {/* Sidebar: Explorer */}
            <div className="w-80 flex flex-col glass-card border border-white/10 bg-black/40 rounded-xl overflow-hidden shrink-0">
                <div className="p-4 border-b border-white/10 space-y-3 bg-white/5">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-red-500" /> API Explorer
                        </h3>
                        <button onClick={loadRoutes} className="text-xs text-zinc-500 hover:text-white transition-colors">
                            {isDiscovering ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Find endpoints..."
                            className="w-full bg-black/50 border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-xs focus:border-red-500/50 outline-none transition-colors"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800">
                    {filteredServices.map(svc => {
                        const grouped = getGroupedEndpoints(svc);
                        const isExpanded = selectedService === svc.service;

                        return (
                            <div key={svc.service} className="mb-2">
                                <button
                                    onClick={() => setSelectedService(isExpanded ? null : svc.service)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all border border-transparent",
                                        isExpanded ? "bg-white/10 text-white border-white/5" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Box className="h-4 w-4 text-zinc-500" />
                                        <span>{svc.service}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`h-1.5 w-1.5 rounded-full ${svc.status === 'UP' ? 'bg-green-500' : 'bg-red-500'} `} />
                                        {isExpanded ? <ChevronDown className="h-3 w-3 text-zinc-500" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="mt-1 pl-2 space-y-1">
                                        {Object.entries(grouped).map(([tag, endpoints]) => {
                                            const isTagExpanded = expandedTags[svc.service]?.[tag] !== false; // Default open
                                            return (
                                                <div key={tag} className="border-l border-white/10 ml-2 pl-2">
                                                    <button
                                                        onClick={() => toggleTag(svc.service, tag)}
                                                        className="w-full flex items-center gap-2 py-1 text-xs font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-wider"
                                                    >
                                                        {isTagExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                        {tag}
                                                    </button>

                                                    {isTagExpanded && (
                                                        <div className="space-y-0.5 mt-0.5">
                                                            {endpoints.map((ep, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => selectEndpoint(svc, ep)}
                                                                    className="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-white/5 hover:text-white text-zinc-400 flex items-center gap-2 group transition-colors"
                                                                >
                                                                    <span className={cn(
                                                                        "font-mono font-bold w-12 shrink-0 text-[10px]",
                                                                        ep.method === 'GET' && "text-blue-400",
                                                                        ep.method === 'POST' && "text-green-400",
                                                                        ep.method === 'PUT' && "text-orange-400",
                                                                        ep.method === 'DELETE' && "text-red-400",
                                                                    )}>{ep.method}</span>
                                                                    <span className="truncate opacity-80 group-hover:opacity-100">{ep.path}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {Object.keys(grouped).length === 0 && <p className="text-xs text-zinc-600 p-2 italic">No endpoints</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Area: Workspace */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
                {/* Request Editor */}
                <div className="glass-card flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden shrink-0 shadow-lg">
                    {/* Header / URL Bar */}
                    <div className="p-4 border-b border-white/10 flex gap-0 bg-white/5">
                        <select
                            value={method}
                            onChange={e => setMethod(e.target.value)}
                            className={cn(
                                "bg-black border border-white/10 rounded-l-lg px-4 py-2 text-sm font-bold w-28 focus:outline-none focus:ring-1 focus:ring-red-500/50",
                                method === 'GET' && "text-blue-400",
                                method === 'POST' && "text-green-400",
                                method === 'DELETE' && "text-red-400",
                                method === 'PUT' && "text-orange-400",
                            )}
                        >
                            <option>GET</option>
                            <option>POST</option>
                            <option>PUT</option>
                            <option>DELETE</option>
                            <option>PATCH</option>
                        </select>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={path}
                                onChange={e => setPath(e.target.value)}
                                className="w-full h-full bg-black/50 border-y border-r border-white/10 px-4 text-sm font-mono text-white focus:outline-none focus:bg-black/80 transition-colors"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600 font-mono pointer-events-none">
                                {serviceName}:{port}
                            </div>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 rounded-r-lg shadow-lg shadow-red-900/20 active:scale-[0.98] transition-all flex items-center gap-2 text-sm ml-2"
                        >
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />} Send
                        </button>
                    </div>

                    {/* Tabs & Editor */}
                    <div className="flex-1 flex flex-col min-h-[250px] bg-black/20">
                        <div className="flex border-b border-white/10 px-4">
                            {['Body', 'Params', 'Headers'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab.toLowerCase())}
                                    className={cn(
                                        "px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors",
                                        activeTab === tab.toLowerCase() ? "border-red-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 p-0 relative">
                            {activeTab === 'body' && (
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    className="absolute inset-0 w-full h-full bg-transparent p-4 text-xs font-mono text-zinc-300 resize-none focus:outline-none leading-relaxed"
                                    placeholder="{}"
                                    spellCheck="false"
                                />
                            )}
                            {activeTab === 'headers' && (
                                <div className="p-4 space-y-2">
                                    {headers.map((h, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={h.enabled}
                                                onChange={e => updateHeader(idx, 'enabled', e.target.checked)}
                                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Key"
                                                value={h.key}
                                                onChange={e => updateHeader(idx, 'key', e.target.value)}
                                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-zinc-300 focus:border-red-500/50 outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={h.value}
                                                onChange={e => updateHeader(idx, 'value', e.target.value)}
                                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-zinc-300 focus:border-red-500/50 outline-none"
                                            />
                                            <button onClick={() => removeHeader(idx)} className="text-zinc-600 hover:text-red-500 transition-colors p-1">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={addHeader} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white mt-2 transition-colors">
                                        <Plus className="h-3 w-3" /> Add Header
                                    </button>
                                </div>
                            )}
                            {activeTab === 'params' && (
                                <div className="p-4 space-y-2">
                                    {params.map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={p.enabled}
                                                onChange={e => updateParam(idx, 'enabled', e.target.checked)}
                                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Key"
                                                value={p.key}
                                                onChange={e => updateParam(idx, 'key', e.target.value)}
                                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-zinc-300 focus:border-red-500/50 outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={p.value}
                                                onChange={e => updateParam(idx, 'value', e.target.value)}
                                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-zinc-300 focus:border-red-500/50 outline-none"
                                            />
                                            <button onClick={() => removeParam(idx)} className="text-zinc-600 hover:text-red-500 transition-colors p-1">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={addParam} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white mt-2 transition-colors">
                                        <Plus className="h-3 w-3" /> Add Parameter
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Response Viewer */}
                <div className="flex-1 glass-card bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-0 relative">
                    <div className="bg-white/5 border-b border-white/10 px-4 py-2 flex justify-between items-center h-12">
                        <span className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
                            <Code className="h-4 w-4" /> Response
                        </span>
                        {response && (
                            <div className="flex items-center gap-4">
                                <span className={cn(
                                    "text-xs font-bold px-2 py-0.5 rounded",
                                    (response.status || 200) < 300 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                )}>Status: {response.status || 200}</span>
                                <button onClick={() => setResponse(null)} className="text-zinc-600 hover:text-white transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-4 bg-transparent scrollbar-thin scrollbar-thumb-zinc-800">
                        {response ? (
                            <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap word-break-all leading-relaxed">
                                {JSON.stringify(response, null, 2)}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-3 select-none">
                                <Terminal className="h-16 w-16 opacity-50" />
                                <p className="text-sm font-medium">Ready to capture response</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
