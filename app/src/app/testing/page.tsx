"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ErrorScenario {
    id: string;
    name: string;
    description: string;
    category: string;
    severity: 'CRITICAL' | 'ERROR' | 'WARNING';
}

const ERROR_SCENARIOS: ErrorScenario[] = [
    // Nginx Errors
    {
        id: "nginx-connection-refused",
        name: "Nginx Connection Refused",
        description: "Nginx server refusing connections due to port conflicts or service issues",
        category: "nginx",
        severity: "ERROR"
    },
    {
        id: "nginx-ssl-certificate-expired",
        name: "Nginx SSL Certificate Expired",
        description: "SSL certificate has expired, causing HTTPS connections to fail",
        category: "nginx",
        severity: "CRITICAL"
    },
    {
        id: "nginx-upstream-unavailable",
        name: "Nginx Upstream Unavailable",
        description: "Backend services are down, causing 502 Bad Gateway errors",
        category: "nginx",
        severity: "ERROR"
    },

    // Ubuntu System Errors
    {
        id: "ubuntu-disk-space-full",
        name: "Ubuntu Disk Space Full",
        description: "Root filesystem is 95% full, causing application failures",
        category: "ubuntu",
        severity: "CRITICAL"
    },
    {
        id: "ubuntu-memory-exhausted",
        name: "Ubuntu Memory Exhausted",
        description: "System running out of memory, causing OOM killer to terminate processes",
        category: "ubuntu",
        severity: "CRITICAL"
    },
    {
        id: "ubuntu-cpu-overload",
        name: "Ubuntu CPU Overload",
        description: "CPU usage at 100% for extended periods, causing system slowdown",
        category: "ubuntu",
        severity: "WARNING"
    },

    // Node.js Errors
    {
        id: "nodejs-unhandled-rejection",
        name: "Node.js Unhandled Promise Rejection",
        description: "Unhandled promise rejection causing application crashes",
        category: "nodejs",
        severity: "ERROR"
    },
    {
        id: "nodejs-memory-leak",
        name: "Node.js Memory Leak",
        description: "Memory usage growing continuously without garbage collection",
        category: "nodejs",
        severity: "ERROR"
    },
    {
        id: "nodejs-port-already-in-use",
        name: "Node.js Port Already in Use",
        description: "Application trying to bind to port that's already occupied",
        category: "nodejs",
        severity: "ERROR"
    },

    // Next.js Errors
    {
        id: "nextjs-build-failed",
        name: "Next.js Build Failed",
        description: "Production build failing due to TypeScript errors or missing dependencies",
        category: "nextjs",
        severity: "ERROR"
    },
    {
        id: "nextjs-runtime-error",
        name: "Next.js Runtime Error",
        description: "Client-side JavaScript error causing page crashes",
        category: "nextjs",
        severity: "ERROR"
    },
    {
        id: "nextjs-api-route-error",
        name: "Next.js API Route Error",
        description: "API route returning 500 errors due to database connection issues",
        category: "nextjs",
        severity: "ERROR"
    },

    // PM2 Errors
    {
        id: "pm2-process-crashed",
        name: "PM2 Process Crashed",
        description: "Application process crashed and PM2 restart attempts failing",
        category: "pm2",
        severity: "CRITICAL"
    },
    {
        id: "pm2-memory-limit-exceeded",
        name: "PM2 Memory Limit Exceeded",
        description: "Application exceeding PM2 memory limits, causing restarts",
        category: "pm2",
        severity: "ERROR"
    },
    {
        id: "pm2-cluster-mode-issues",
        name: "PM2 Cluster Mode Issues",
        description: "Worker processes in cluster mode failing to start properly",
        category: "pm2",
        severity: "ERROR"
    },

    // Database Errors
    {
        id: "database-connection-timeout",
        name: "Database Connection Timeout",
        description: "Database connection timing out due to network issues or overload",
        category: "database",
        severity: "ERROR"
    },
    {
        id: "database-deadlock",
        name: "Database Deadlock",
        description: "Database deadlock causing transaction failures",
        category: "database",
        severity: "ERROR"
    },

    // Docker Errors
    {
        id: "docker-container-crashed",
        name: "Docker Container Crashed",
        description: "Docker container exited with non-zero status code",
        category: "docker",
        severity: "ERROR"
    },
    {
        id: "docker-out-of-memory",
        name: "Docker Out of Memory",
        description: "Docker container running out of memory and being killed",
        category: "docker",
        severity: "CRITICAL"
    },

    // Network Errors
    {
        id: "network-dns-resolution-failed",
        name: "DNS Resolution Failed",
        description: "Unable to resolve domain names, causing service failures",
        category: "network",
        severity: "ERROR"
    },
    {
        id: "network-timeout",
        name: "Network Timeout",
        description: "Network requests timing out due to connectivity issues",
        category: "network",
        severity: "WARNING"
    }
];

export default function TestingPage() {
    const [webhookUrl, setWebhookUrl] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [webhookStatus, setWebhookStatus] = useState({ message: "", isError: false });
    const [testResult, setTestResult] = useState("");
    const [selectedError, setSelectedError] = useState<string>("");

    const handleGenerateErrors = async () => {
        setIsGenerating(true);
        setTestResult("Generating errors... Check the Dashboard for an AI analysis in ~15 seconds.");
        try {
            const response = await fetch("/api/generate-realistic-errors", { method: "POST" });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API call failed with status ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            console.log("Successfully requested error generation from the backend.");
            setTestResult(`Successfully started error generation. Backend says: "${result.message}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to trigger error generation:", errorMessage);
            setTestResult(`Error: Could not trigger error generation.\n\n${errorMessage}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDirectTest = async () => {
        setTestResult("Sending direct test log to analyzer...");
        try {
            const response = await fetch("/api/test-analyzer", { method: "POST" });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(`API call failed: ${result.message || response.statusText}`);
            }
            
            setTestResult(`Direct test log sent. Check the Dashboard for an AI Analysis in ~15 seconds.\n\nBackend response: ${result.message}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to trigger direct test:", errorMessage);
            setTestResult(`Error: Could not trigger direct test.\n\n${errorMessage}`);
        }
    };

    const handleSpecificErrorTest = async () => {
        if (!selectedError) {
            setTestResult("Please select an error scenario first.");
            return;
        }

        const selectedScenario = ERROR_SCENARIOS.find(scenario => scenario.id === selectedError);
        if (!selectedScenario) {
            setTestResult("Invalid error scenario selected.");
            return;
        }

        setTestResult(`Generating ${selectedScenario.name} error... Check the Dashboard for an AI analysis in ~15 seconds.`);
        try {
            const response = await fetch("/api/generate-specific-error", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    errorType: selectedError,
                    scenario: selectedScenario 
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API call failed with status ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            setTestResult(`Successfully triggered ${selectedScenario.name} error. Backend says: "${result.message}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to trigger specific error:", errorMessage);
            setTestResult(`Error: Could not trigger ${selectedScenario?.name} error.\n\n${errorMessage}`);
        }
    };

    const handleMarkdownTest = async () => {
        setTestResult("Generating markdown-formatted test report...");
        try {
            const response = await fetch("/analyzer/generate-realistic-errors", { method: "POST" });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }
            
            // Simulate receiving this as a websocket message
            if (window.dispatchEvent) {
                const event = new CustomEvent('test-markdown-report', {
                    detail: { report: result.message }
                });
                window.dispatchEvent(event);
            }
            
            setTestResult(`Markdown test report generated! Check the Dashboard - a new report with enhanced formatting and copyable code blocks should appear.\n\nReport length: ${result.message.length} characters`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to generate markdown test:", errorMessage);
            setTestResult(`Error: Could not generate markdown test.\n\n${errorMessage}`);
        }
    };

    const handleSaveWebhook = async () => {
        setWebhookStatus({ message: "Saving...", isError: false });
        try {
            const res = await fetch("/api/set-webhook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: webhookUrl }),
            });
            if (res.ok) {
                setWebhookStatus({ message: "Webhook URL saved successfully!", isError: false });
                setTimeout(() => setWebhookStatus({ message: "", isError: false }), 3000);
            } else {
                const errorText = await res.text();
                setWebhookStatus({ message: `Failed to save: ${errorText || "Server error"}`, isError: true });
            }
        } catch (error) {
            console.error("Failed to save webhook:", error);
            setWebhookStatus({ message: "A network error occurred while saving.", isError: true });
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'text-red-500';
            case 'ERROR': return 'text-orange-500';
            case 'WARNING': return 'text-yellow-500';
            default: return 'text-gray-500';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'nginx': return '🌐';
            case 'ubuntu': return '🐧';
            case 'nodejs': return '🟢';
            case 'nextjs': return '⚡';
            case 'pm2': return '⚙️';
            case 'database': return '🗄️';
            case 'docker': return '🐳';
            case 'network': return '🌐';
            default: return '❓';
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto text-gray-200 p-4">
            <h1 className="text-2xl md:text-3xl font-bold text-cyan-400 mb-6">Testing & Configuration</h1>
            
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg mb-6 md:mb-8">
                <h2 className="text-lg md:text-xl font-semibold mb-4">Configure Notifications (Optional)</h2>
                <div className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="Enter your Discord/Slack Webhook URL"
                        className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    />
                    <button 
                        onClick={handleSaveWebhook} 
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded whitespace-nowrap"
                    >
                        Save Webhook
                    </button>
                </div>
                {webhookStatus.message && (
                    <p className={`mt-2 text-sm ${webhookStatus.isError ? 'text-red-400' : 'text-green-400'}`}>
                        {webhookStatus.message}
                    </p>
                )}
            </div>

            <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg mb-6 md:mb-8">
                <h2 className="text-lg md:text-xl font-semibold mb-4">Trigger Specific Error Scenarios</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Select Error Scenario</label>
                        <Select value={selectedError} onValueChange={setSelectedError}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose an error scenario to test..." />
                            </SelectTrigger>
                            <SelectContent>
                                {ERROR_SCENARIOS.map((scenario) => (
                                    <SelectItem key={scenario.id} value={scenario.id}>
                                        <div className="flex items-center gap-2">
                                            <span>{getCategoryIcon(scenario.category)}</span>
                                            <div className="flex-1">
                                                <div className="font-medium">{scenario.name}</div>
                                                <div className="text-xs text-muted-foreground">{scenario.description}</div>
                                            </div>
                                            <span className={`text-xs font-medium ${getSeverityColor(scenario.severity)}`}>
                                                {scenario.severity}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <button 
                        onClick={handleSpecificErrorTest}
                        disabled={!selectedError || isGenerating}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded disabled:bg-purple-800 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? "Generating..." : "Generate Selected Error"}
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg mb-6 md:mb-8">
                <h2 className="text-lg md:text-xl font-semibold mb-3">Trigger Generic Test Errors</h2>
                <div className="flex flex-col gap-3 md:gap-4">
                    <button 
                        onClick={handleGenerateErrors} 
                        disabled={isGenerating} 
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-red-800 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? "Generating..." : "Generate Realistic Errors (via Fluent Bit)"}
                    </button>
                    <button 
                        onClick={handleDirectTest} 
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded"
                    >
                        Test Analyzer Directly (Bypass Fluent Bit)
                    </button>
                </div>
            </div>

            <div className="bg-gray-950 p-4 md:p-6 rounded-lg shadow-lg border border-gray-700">
                <h2 className="text-lg md:text-xl font-semibold mb-4">Test Result</h2>
                <pre className="whitespace-pre-wrap bg-black p-4 rounded text-sm overflow-x-auto min-h-[5rem]">
                    {testResult || "Test results will appear here..."}
                </pre>
            </div>
        </div>
    );
}