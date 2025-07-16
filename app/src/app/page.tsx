"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export default function Home() {
    const [webhookUrl, setWebhookUrl] = useState("");
    const [status, setStatus] = useState("Not connected");
    const [summary, setSummary] = useState("AI summary will appear here...");
    const [isGenerating, setIsGenerating] = useState(false);
    const [webhookStatus, setWebhookStatus] = useState({ message: "", isError: false });

    useEffect(() => {
        // ✅ BEST PRACTICE: Use an environment variable for the WebSocket URL
        // to make the component more portable and configurable.
        const analyzerWsUrl = process.env.NEXT_PUBLIC_ANALYZER_WS_URL || "http://localhost:9881";
        console.log(`Connecting to WebSocket at: ${analyzerWsUrl}`);

        const socket = io(process.env.NEXT_PUBLIC_ANALYZER_WS_URL, {
            path: "/analyzer/socket.io",
            transports: ["websocket"],
        });


        socket.on("connect", () => {
            setStatus("Connected to Analyzer");
        });

        socket.on("disconnect", () => {
            setStatus("Disconnected from Analyzer");
        });

        socket.on("new-summary", (data: string) => {
            setSummary(data);
            setIsGenerating(false); // Re-enable button
        });

        // Cleanup on component unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    const handleGenerateErrors = async () => {
        setIsGenerating(true);
        setSummary("Generating errors... Awaiting log analysis from Gemma...");
        try {
            const response = await fetch("/api/generate-realistic-errors", { method: "POST" });
            // ✅ BEST PRACTICE: Check if the API call was successful.
            // This provides immediate feedback if the backend endpoint has an issue.
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API call failed with status ${response.status}: ${errorText}`);
            }
            console.log("Successfully requested error generation from the backend.");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to trigger error generation:", errorMessage);
            setSummary(`Error: Could not trigger error generation.\n\n${errorMessage}`);
            setIsGenerating(false);
        }
    };

    const handleDirectTest = async () => {
        setSummary("Sending direct test log to analyzer...");
        try {
            const response = await fetch("/api/test-analyzer", { method: "POST" });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(`API call failed: ${result.message || response.statusText}`);
            }
            
            setSummary(`Direct test log sent. Check for an AI Analysis in ~15 seconds.\n\nBackend response: ${result.message}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to trigger direct test:", errorMessage);
            setSummary(`Error: Could not trigger direct test.\n\n${errorMessage}`);
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
                // ✅ BEST PRACTICE: Clear the status message after a few seconds for better UX.
                setTimeout(() => {
                    setWebhookStatus({ message: "", isError: false });
                }, 3000);
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
        <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-gray-200 font-sans">
            <div className="w-full max-w-4xl">
                <h1 className="text-4xl font-bold text-center mb-2 text-cyan-400">Robolog AI Demo</h1>
                <p className="text-center text-gray-400 mb-8">Live Log Analysis with Ollama Gemma</p>

                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-xl font-semibold mb-4">1. Configure Notifications (Optional)</h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="Enter your Discord/Slack Webhook URL"
                            className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                        />
                        <button
                            onClick={handleSaveWebhook}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Save Webhook
                        </button>
                    </div>
                    {/* ✅ BEST PRACTICE: Display inline status messages instead of alert() popups */}
                    {webhookStatus.message && (
                        <p className={`mt-2 text-sm ${webhookStatus.isError ? 'text-red-400' : 'text-green-400'}`}>
                            {webhookStatus.message}
                        </p>
                    )}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-xl font-semibold mb-3">2. Trigger Test Errors</h2>
                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleGenerateErrors}
                            disabled={isGenerating}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-red-800 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? "Analyzing..." : "Generate Realistic Errors (via Fluent Bit)"}
                        </button>
                        <button
                            onClick={handleDirectTest}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Test Analyzer Directly (Bypass Fluent Bit)
                        </button>
                    </div>
                </div>

                <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 flex justify-between items-center">
                        <span>3. View AI Analysis</span>
                        <span className="text-sm font-mono bg-gray-700 text-cyan-400 px-2 py-1 rounded">{status}</span>
                    </h2>
                    <pre className="whitespace-pre-wrap bg-black p-4 rounded text-sm overflow-x-auto h-96">
                        {summary}
                    </pre>
                </div>
            </div>
        </main>
    );
}
