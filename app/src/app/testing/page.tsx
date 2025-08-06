"use client";

import { useState } from "react";

export default function TestingPage() {
    const [webhookUrl, setWebhookUrl] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [webhookStatus, setWebhookStatus] = useState({ message: "", isError: false });
    const [testResult, setTestResult] = useState("");

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

    return (
        <div className="w-full max-w-4xl mx-auto text-gray-200">
            <h1 className="text-3xl font-bold text-cyan-400 mb-6">Testing & Configuration</h1>
            
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                <h2 className="text-xl font-semibold mb-4">Configure Notifications (Optional)</h2>
                <div className="flex gap-4">
                    <input
                        type="text"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="Enter your Discord/Slack Webhook URL"
                        className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    />
                    <button onClick={handleSaveWebhook} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded">Save Webhook</button>
                </div>
                {webhookStatus.message && <p className={`mt-2 text-sm ${webhookStatus.isError ? 'text-red-400' : 'text-green-400'}`}>{webhookStatus.message}</p>}
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                <h2 className="text-xl font-semibold mb-3">Trigger Test Errors</h2>
                <div className="flex flex-col gap-4">
                    <button onClick={handleGenerateErrors} disabled={isGenerating} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-red-800 disabled:cursor-not-allowed">{isGenerating ? "Generating..." : "Generate Realistic Errors (via Fluent Bit)"}</button>
                    <button onClick={handleDirectTest} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded">Test Analyzer Directly (Bypass Fluent Bit)</button>
                    <button onClick={handleMarkdownTest} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Test Markdown Formatting & Copy-to-Clipboard</button>
                </div>
            </div>

            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Test Result</h2>
                <pre className="whitespace-pre-wrap bg-black p-4 rounded text-sm overflow-x-auto min-h-[5rem]">{testResult || "Test results will appear here..."}</pre>
            </div>
        </div>
    );
}