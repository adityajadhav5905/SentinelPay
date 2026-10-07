import { useEffect, useState } from 'react';
import { adminApi } from '../../api-integration/admin';
import { BrainCircuit, Play, History, CheckCircle, AlertTriangle, Loader2, RefreshCw, Zap, Server } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminModels() {
    const [modelData, setModelData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [training, setTraining] = useState(false);

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getModels();
            setModelData(data);
        } catch (error) {
            console.error('Failed to load models');
            toast.error('Failed to load model information');
        } finally {
            setLoading(false);
        }
    };

    const handleRetrain = async (modelType) => {
        setTraining(true);
        try {
            const result = await adminApi.retrainModel(modelType);
            toast.success('Retraining triggered successfully', {
                description: result.message || 'The ML service has received the retraining job.'
            });
            // Reload after a short delay
            setTimeout(loadModels, 2000);
        } catch (error) {
            toast.error('Failed to trigger retraining');
        } finally {
            setTraining(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-red-500" />
            </div>
        );
    }

    const activeModel = modelData?.activeModel;
    const history = modelData?.history || [];
    const mlStatus = modelData?.mlServiceStatus;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-foreground">Model Management</h2>
                <button
                    onClick={loadModels}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            {/* ML Service Status */}
            <div className={`p-4 rounded-lg border ${mlStatus === 'healthy' ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'} flex items-center gap-3`}>
                <Server className={`h-5 w-5 ${mlStatus === 'healthy' ? 'text-green-500' : 'text-yellow-500'}`} />
                <div>
                    <p className="font-medium text-sm">ML Service Status</p>
                    <p className={`text-xs ${mlStatus === 'healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {mlStatus === 'healthy' ? 'Online and Operational' : mlStatus || 'Status Unknown'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Active Model Card */}
                <div className="glass-card p-6 rounded-xl border border-white/10 bg-black/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <BrainCircuit className="h-48 w-48 text-white" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <span className={`h-2 w-2 rounded-full ${activeModel?.status === 'ACTIVE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-yellow-500'}`} />
                            <h3 className="text-lg font-semibold text-white">
                                {activeModel?.type || 'Isolation Forest'} ({activeModel?.version || 'v2.1'})
                            </h3>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-muted-foreground text-sm">Status</span>
                                <span className={`text-sm font-medium flex items-center gap-1 ${activeModel?.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {activeModel?.status === 'ACTIVE' ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                    {activeModel?.status || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-muted-foreground text-sm">Model Loaded</span>
                                <span className={`text-sm ${activeModel?.isLoaded ? 'text-green-400' : 'text-zinc-400'}`}>
                                    {activeModel?.isLoaded ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-muted-foreground text-sm">Features</span>
                                <span className="text-zinc-300 text-sm">{activeModel?.features || 11} features</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-muted-foreground text-sm">Last Trained</span>
                                <span className="text-zinc-300 text-sm">
                                    {activeModel?.lastTrained ? new Date(activeModel.lastTrained).toLocaleDateString() : 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-muted-foreground text-sm">Accuracy (F1)</span>
                                <span className="text-zinc-300 text-sm font-bold">
                                    {activeModel?.accuracy ? (activeModel.accuracy * 100).toFixed(1) + '%' : 'N/A'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => handleRetrain('isolation_forest')}
                            disabled={training}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {training ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            {training ? 'Triggering Pipeline...' : 'Trigger Retraining'}
                        </button>
                    </div>
                </div>

                {/* Training History */}
                <div className="glass-card p-6 rounded-xl border border-white/10 bg-black/40">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" /> Training History
                    </h3>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {history.length === 0 ? (
                            <div className="text-center py-8">
                                <BrainCircuit className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
                                <p className="text-muted-foreground text-sm">No training history found.</p>
                                <p className="text-zinc-600 text-xs mt-1">Models will appear here after training runs.</p>
                            </div>
                        ) : (
                            history.map((model) => (
                                <div key={model.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div>
                                        <p className="font-medium text-zinc-200 text-sm flex items-center gap-2">
                                            {model.type}
                                            {model.isActive && (
                                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold">Active</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {model.version} • {new Date(model.trainedAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        {model.accuracy && (
                                            <>
                                                <p className="text-sm font-bold text-zinc-200">{(model.accuracy * 100).toFixed(1)}%</p>
                                                <p className="text-xs text-zinc-500">Accuracy</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-black/40">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => handleRetrain('isolation_forest')}
                        disabled={training}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-left"
                    >
                        <BrainCircuit className="h-6 w-6 text-blue-400 mb-2" />
                        <p className="font-medium text-sm">Retrain Isolation Forest</p>
                        <p className="text-xs text-zinc-500">Primary anomaly detection model</p>
                    </button>
                    <button
                        onClick={() => toast.info('Autoencoder training coming soon')}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-left opacity-50"
                    >
                        <BrainCircuit className="h-6 w-6 text-purple-400 mb-2" />
                        <p className="font-medium text-sm">Retrain Autoencoder</p>
                        <p className="text-xs text-zinc-500">Deep learning model (coming soon)</p>
                    </button>
                    <button
                        onClick={() => handleRetrain('all')}
                        disabled={training}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-left"
                    >
                        <Zap className="h-6 w-6 text-orange-400 mb-2" />
                        <p className="font-medium text-sm">Retrain All Models</p>
                        <p className="text-xs text-zinc-500">Full pipeline refresh</p>
                    </button>
                </div>
            </div>
        </div>
    );
}
