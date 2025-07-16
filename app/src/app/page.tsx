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

        const socket: Socket = io(analyzerWsUrl);

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
            // This POST request is handled by the Next.js API route below
            await fetch("/api/generate-realistic-errors", { method: "POST" });
        } catch (error) {
            console.error("Failed to trigger error generation:", error);
            setSummary("Error: Could not trigger error generation.");
            setIsGenerating(false);
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
                    <button
                        onClick={handleGenerateErrors}
                        disabled={isGenerating}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-red-800 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? "Analyzing..." : "Generate Realistic Errors"}
                    </button>
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