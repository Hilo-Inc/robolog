"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Settings, Zap, Clock, Cpu, Save, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OllamaConfig {
    model: string;
    temperature: number;
    top_p: number;
    top_k: number;
    repeat_penalty: number;
    num_predict: number;
    keep_alive: string;
    streaming: boolean;
    stop_tokens: string;
}

interface ModelInfo {
    name: string;
    size: string;
    modified: string;
    details: {
        family: string;
        parameter_size: string;
        quantization_level: string;
    };
}

const DEFAULT_CONFIG: OllamaConfig = {
    model: "gemma3n:e2b",
    temperature: 0.2,
    top_p: 0.8,
    top_k: 20,
    repeat_penalty: 1.1,
    num_predict: 500,
    keep_alive: "10m",
    streaming: true,
    stop_tokens: "---,###"
};

const KEEP_ALIVE_OPTIONS = [
    { value: "5m", label: "5 minutes", description: "Good for light usage" },
    { value: "10m", label: "10 minutes", description: "Balanced performance" },
    { value: "30m", label: "30 minutes", description: "Heavy usage" },
    { value: "1h", label: "1 hour", description: "Continuous operation" },
    { value: "-1", label: "Indefinite", description: "Keep loaded permanently" },
    { value: "0", label: "Immediate", description: "Unload after each request" }
];

export default function ConfigPage() {
    const [config, setConfig] = useState<OllamaConfig>(DEFAULT_CONFIG);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [systemInfo, setSystemInfo] = useState<any>(null);

    // Load current configuration
    useEffect(() => {
        loadConfiguration();
        checkConnection();
        loadModels();
        loadSystemInfo();
    }, []);

    const loadConfiguration = async () => {
        try {
            const response = await fetch('/analyzer/status');
            const data = await response.json();
            if (data.configuration) {
                setConfig({
                    model: data.configuration.model || DEFAULT_CONFIG.model,
                    temperature: data.configuration.temperature || DEFAULT_CONFIG.temperature,
                    top_p: data.configuration.top_p || DEFAULT_CONFIG.top_p,
                    top_k: data.configuration.top_k || DEFAULT_CONFIG.top_k,
                    repeat_penalty: data.configuration.repeat_penalty || DEFAULT_CONFIG.repeat_penalty,
                    num_predict: data.configuration.num_predict || DEFAULT_CONFIG.num_predict,
                    keep_alive: data.configuration.keep_alive || DEFAULT_CONFIG.keep_alive,
                    streaming: data.configuration.streaming !== false,
                    stop_tokens: Array.isArray(data.configuration.stop) ? data.configuration.stop.join(',') : DEFAULT_CONFIG.stop_tokens
                });
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    };

    const checkConnection = async () => {
        try {
            const response = await fetch('/analyzer/status');
            setIsConnected(response.ok);
        } catch (error) {
            setIsConnected(false);
        }
    };

    const loadModels = async () => {
        try {
            const response = await fetch('/analyzer/ollama/models');
            if (response.ok) {
                const data = await response.json();
                setModels(data.models || []);
            }
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    };

    const loadSystemInfo = async () => {
        try {
            const response = await fetch('/analyzer/status');
            if (response.ok) {
                const data = await response.json();
                setSystemInfo(data);
            }
        } catch (error) {
            console.error('Failed to load system info:', error);
        }
    };

    const saveConfiguration = async () => {
        setStatus('loading');
        try {
            const response = await fetch('/analyzer/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    stop: config.stop_tokens.split(',').map(s => s.trim()).filter(s => s)
                })
            });

            if (response.ok) {
                setStatus('success');
                setMessage('Configuration saved successfully!');
            } else {
                setStatus('error');
                setMessage('Failed to save configuration');
            }
        } catch (error) {
            setStatus('error');
            setMessage('Error connecting to analyzer');
        }

        setTimeout(() => {
            setStatus('idle');
            setMessage('');
        }, 3000);
    };

    const resetToDefaults = () => {
        setConfig(DEFAULT_CONFIG);
        setMessage('Configuration reset to defaults');
        setTimeout(() => setMessage(''), 2000);
    };

    const testModel = async () => {
        setStatus('loading');
        try {
            const response = await fetch('/analyzer/test-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: config.model })
            });

            if (response.ok) {
                const data = await response.json();
                setStatus('success');
                setMessage(`Model test successful! Response time: ${data.responseTime}ms`);
            } else {
                setStatus('error');
                setMessage('Model test failed');
            }
        } catch (error) {
            setStatus('error');
            setMessage('Error testing model');
        }

        setTimeout(() => {
            setStatus('idle');
            setMessage('');
        }, 5000);
    };

    const warmUpModel = async () => {
        setStatus('loading');
        try {
            const response = await fetch('/analyzer/warm-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: config.model, keep_alive: config.keep_alive })
            });

            if (response.ok) {
                setStatus('success');
                setMessage('Model warmed up successfully!');
            } else {
                setStatus('error');
                setMessage('Failed to warm up model');
            }
        } catch (error) {
            setStatus('error');
            setMessage('Error warming up model');
        }

        setTimeout(() => {
            setStatus('idle');
            setMessage('');
        }, 3000);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="h-8 w-8" />
                <div>
                    <h1 className="text-3xl font-bold">Ollama Configuration</h1>
                    <p className="text-muted-foreground">
                        Optimize AI model performance and behavior for log analysis
                    </p>
                </div>
                <div className="ml-auto">
                    <Badge variant={isConnected ? "default" : "destructive"}>
                        {isConnected ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                        {isConnected ? "Connected" : "Disconnected"}
                    </Badge>
                </div>
            </div>

            {message && (
                <Alert className={status === 'error' ? 'border-red-500' : status === 'success' ? 'border-green-500' : ''}>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="performance" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="performance" className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Performance
                    </TabsTrigger>
                    <TabsTrigger value="model" className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        Model
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Advanced
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        System
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="performance" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                Performance Optimization
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <Label htmlFor="keep-alive" className="text-base font-medium">
                                        Model Keep-Alive
                                    </Label>
                                    <Select value={config.keep_alive} onValueChange={(value) => setConfig(prev => ({ ...prev, keep_alive: value }))}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select keep-alive duration" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {KEEP_ALIVE_OPTIONS.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <div>
                                                        <div className="font-medium">{option.label}</div>
                                                        <div className="text-xs text-muted-foreground">{option.description}</div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-sm text-muted-foreground">
                                        How long to keep the model loaded in memory. Longer times reduce startup delays.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="streaming"
                                            checked={config.streaming}
                                            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, streaming: checked }))}
                                        />
                                        <Label htmlFor="streaming" className="text-base font-medium">
                                            Enable Streaming
                                        </Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Stream responses as they're generated for faster perceived performance.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button onClick={warmUpModel} disabled={status === 'loading'} variant="outline">
                                    <Zap className="h-4 w-4 mr-2" />
                                    Warm Up Model
                                </Button>
                                <Button onClick={testModel} disabled={status === 'loading'} variant="outline">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Test Model
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="model" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Cpu className="h-5 w-5" />
                                Model Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <Label htmlFor="model" className="text-base font-medium">Current Model</Label>
                                <Select value={config.model} onValueChange={(value) => setConfig(prev => ({ ...prev, model: value }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.map(model => (
                                            <SelectItem key={model.name} value={model.name}>
                                                <div>
                                                    <div className="font-medium">{model.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {model.details?.parameter_size} • {model.size}
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <Label className="text-base font-medium">
                                        Temperature: {config.temperature}
                                    </Label>
                                    <Slider
                                        value={[config.temperature]}
                                        onValueChange={([value]) => setConfig(prev => ({ ...prev, temperature: value }))}
                                        max={2}
                                        min={0}
                                        step={0.1}
                                        className="w-full"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Lower values (0.1-0.3) for more focused, deterministic responses
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-base font-medium">
                                        Max Tokens: {config.num_predict}
                                    </Label>
                                    <Slider
                                        value={[config.num_predict]}
                                        onValueChange={([value]) => setConfig(prev => ({ ...prev, num_predict: value }))}
                                        max={2048}
                                        min={50}
                                        step={50}
                                        className="w-full"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Maximum length of generated responses
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Advanced Parameters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <Label className="text-base font-medium">
                                        Top-P: {config.top_p}
                                    </Label>
                                    <Slider
                                        value={[config.top_p]}
                                        onValueChange={([value]) => setConfig(prev => ({ ...prev, top_p: value }))}
                                        max={1}
                                        min={0.1}
                                        step={0.1}
                                        className="w-full"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Nucleus sampling - controls diversity
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-base font-medium">
                                        Top-K: {config.top_k}
                                    </Label>
                                    <Slider
                                        value={[config.top_k]}
                                        onValueChange={([value]) => setConfig(prev => ({ ...prev, top_k: value }))}
                                        max={100}
                                        min={1}
                                        step={1}
                                        className="w-full"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Limits vocabulary to top K tokens
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-base font-medium">
                                        Repeat Penalty: {config.repeat_penalty}
                                    </Label>
                                    <Slider
                                        value={[config.repeat_penalty]}
                                        onValueChange={([value]) => setConfig(prev => ({ ...prev, repeat_penalty: value }))}
                                        max={2}
                                        min={0.5}
                                        step={0.1}
                                        className="w-full"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Reduces repetitive responses
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <Label htmlFor="stop-tokens" className="text-base font-medium">
                                        Stop Tokens
                                    </Label>
                                    <Input
                                        id="stop-tokens"
                                        value={config.stop_tokens}
                                        onChange={(e) => setConfig(prev => ({ ...prev, stop_tokens: e.target.value }))}
                                        placeholder="---,###,END"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Comma-separated tokens that stop generation
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="system" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                System Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {systemInfo && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Memory Usage</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Free: {systemInfo.system?.freeMemoryMb}MB
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Queue Status</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Size: {systemInfo.state?.analysisQueue?.queueSize || 0}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Uptime</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {systemInfo.uptime}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Ollama Requests</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Count: {systemInfo.state?.analysisQueue?.ollamaRequestCount || 0}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="flex justify-between items-center pt-6 border-t">
                <Button onClick={resetToDefaults} variant="outline" className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Reset to Defaults
                </Button>
                <Button onClick={saveConfiguration} disabled={status === 'loading'} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {status === 'loading' ? 'Saving...' : 'Save Configuration'}
                </Button>
            </div>
        </div>
    );
}