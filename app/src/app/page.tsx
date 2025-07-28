"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportDisplay } from '@/components/dashboard/ReportDisplay';
import { FollowUp } from "@/components/dashboard/FollowUp";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from 'recharts';

interface ParsedReport {
    id: string;
    time: string;
    topSeverity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'UNKNOWN';
    snippet: string;
    fullReport: string;
}


function getLast12HoursBuckets() {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMinutes(0, 0, 0); // round to hour
        d.setHours(d.getHours() - i);
        buckets.push({
            hour: d.getHours().toString().padStart(2, "0") + ":00",
            iso: d.toISOString().slice(0, 13) // for matching
        });
    }
    return buckets;
}

function parseTimeToHourISO(timeStr: string) {
    // Handles "14:23:05", "N/A", etc.
    // Assume reports have real times
    if (!timeStr || timeStr === "N/A") return null;
    const now = new Date();
    const [h, m, s] = timeStr.split(":").map(Number);
    if ([h, m, s].some(isNaN)) return null;
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    return d.toISOString().slice(0, 13); // match to bucket
}

function parseReportForTable(report: string, index: number): ParsedReport {
    const id = `${Date.now()}-${index}`;

    let time = "N/A";
    const timeMatch = report.match(/\[(\d{2}:\d{2}:\d{2})\]/);
    if (timeMatch) {
        time = timeMatch[1];
    }

    let topSeverity: ParsedReport['topSeverity'] = 'UNKNOWN';
    if (report.includes('CRITICAL')) topSeverity = 'CRITICAL';
    else if (report.includes('ERROR')) topSeverity = 'ERROR';
    else if (report.includes('WARNING')) topSeverity = 'WARNING';

    let snippet = "Could not generate summary snippet.";
    const summaryMatch = report.match(/🤖 \*\*AI Log Analysis.*?\*\*:\n([\s\S]*)/);
    if (summaryMatch && summaryMatch[1]) {
        snippet = summaryMatch[1].trim().split('\n')[0];
    }

    return { id, time, topSeverity, snippet, fullReport: report };
}


export default function DashboardPage() {
    // ✨ NEW: Initialize state from localStorage on the client side.
    const [reports, setReports] = useState<string[]>(() => {
        // This function only runs on the initial render.
        // It's important to check for `window` to avoid errors during server-side rendering.
        if (typeof window === 'undefined') {
            return [];
        }
        try {
            const savedReports = window.localStorage.getItem('robolog-reports');
            // If reports are found in localStorage, parse and return them.
            return savedReports ? JSON.parse(savedReports) : [];
        } catch (error) {
            // If parsing fails, log the error and return an empty array.
            console.error("Failed to parse reports from localStorage", error);
            return [];
        }
    });
    const [status, setStatus] = useState("Not connected");
    const [detailedReport, setDetailedReport] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<ParsedReport | null>(null);
    const [processingStatus, setProcessingStatus] = useState<string | null>(null);
    const [modelName, setModelName] = useState<string>("...");
    const [errorLogs, setErrorLogs] = useState<any[]>([]);

    // ✨ NEW: Persist reports to localStorage whenever they change.
    useEffect(() => {
        try {
            // This effect runs every time the `reports` state is updated.
            window.localStorage.setItem('robolog-reports', JSON.stringify(reports));
        } catch (error) {
            console.error("Failed to save reports to localStorage", error);
        }
    }, [reports]);

    useEffect(() => {
        fetch('/analyzer/errors?hours=12')
            .then(r => r.json())
            .then(setErrorLogs)
            .catch(() => setErrorLogs([]));
    }, [reports]);

    // Fetch Ollama model name from analyzer
    useEffect(() => {
        fetch('/analyzer/status')
            .then(r => r.json())
            .then(data => setModelName(data?.configuration?.model || 'unknown'))
            .catch(() => setModelName('unknown'));
    }, []);

    // ✅ MODIFIED: Fetch initial reports only if localStorage is empty.
    useEffect(() => {
        // This check ensures we don't overwrite reports loaded from localStorage.
        if (reports.length === 0) {
            const fetchReports = async () => {
                setStatus("Fetching reports...");
                try {
                    const response = await fetch('/api/reports');
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setReports(data);
                    }
                    setStatus("Connected to Analyzer");
                } catch (error) {
                    console.error("Failed to fetch initial reports:", error);
                    setStatus("Failed to connect");
                }
            };
            fetchReports();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // This effect should only run once on mount.

    // Setup WebSocket
    useEffect(() => {
        const socket = io({
            path: "/analyzer/socket.io",
            transports: ["websocket"],
        });

        socket.on("connect", () => setStatus("Connected to Analyzer"));
        socket.on("disconnect", () => setStatus("Disconnected from Analyzer"));
        socket.on("connect_error", (err) => {
            console.error("WebSocket connection error:", err.message);
            setStatus(`Connection Error: Is the analyzer running?`);
        });

        socket.on('processing-started', (data: { count: number, logs: { message: string, container: string }[] }) => {
            const logSnippets = data.logs.map(log => `- [${log.container}] ${log.message.substring(0, 80)}...`).join('\n');
            setProcessingStatus(`🤖 Analyzer has received ${data.count} new error(s) and is generating a report. This may take a moment...\n\nLogs received:\n${logSnippets}`);
        });

        socket.on("new-summary", (newReport: string) => {
            // ✅ This update will trigger the localStorage persistence effect.
            setReports(prev => [newReport, ...prev]);
            setProcessingStatus(null);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const parsedReports = reports.map(parseReportForTable);

    const buckets = getLast12HoursBuckets();

    const chartData = buckets.map(b => ({
        hour: b.hour,
        logs: []
    }));

    for (const err of errorLogs) {
        // err.time should be ISO. Use first 13 chars ("YYYY-MM-DDTHH")
        const hourIso = err.time.slice(0, 13);
        const idx = buckets.findIndex(b => b.iso === hourIso);
        if (idx !== -1) {
            // @ts-ignore
            chartData[idx].logs.push(err);
        }
    }

    const errorPoints = chartData.map(b => ({
        hour: b.hour,
        count: b.logs.length,
        reports: b.logs
    }));


    return (
        <>
            {processingStatus && (
                <Card className="mb-4 bg-blue-900/50 border-blue-500">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-300">Analysis in Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="whitespace-pre-wrap font-mono text-sm text-blue-200">
                            {processingStatus}
                        </pre>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>AI Generated Reports</CardTitle>
                        <Badge variant={status === "Connected to Analyzer" ? "default" : "destructive"}>{status}</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Time</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Summary</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {parsedReports.length > 0 ? parsedReports.map((report) => (
                                <TableRow key={report.id}>
                                    <TableCell className="font-mono">{report.time}</TableCell>
                                    <TableCell>
                                        <Badge variant={report.topSeverity === 'CRITICAL' || report.topSeverity === 'ERROR' ? 'destructive' : 'default'}>
                                            {report.topSeverity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-sm truncate">{report.snippet || report.fullReport?.slice(0, 80)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                                            View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No reports yet. Go to the Testing Tools page to generate some errors.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedReport} onOpenChange={(open) => {
                if (!open) {
                    setSelectedReport(null);
                    setDetailedReport(null);
                }
            }}>
                <DialogContent className="sm:max-w-[80vw] h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>AI Report Details</DialogTitle>
                        <DialogDescription>
                            Full AI analysis and follow-up prompt for report generated at {selectedReport?.time}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <ReportDisplay report={selectedReport?.fullReport ?? ''} />
                        </ScrollArea>
                        <div className="flex flex-col gap-4">
                            <FollowUp report={selectedReport?.fullReport ?? ''} onNewDetails={setDetailedReport} />
                            {detailedReport && (
                                <Card className="flex-1">
                                    <CardHeader><CardTitle>Follow-up Details</CardTitle></CardHeader>
                                    <CardContent className="h-full">
                                        <ScrollArea className="h-[calc(100%-4rem)]">
                                            <pre className="whitespace-pre-wrap font-mono text-sm">
                                                {detailedReport}
                                            </pre>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Errors in Last 12 Hours</CardTitle>
                </CardHeader>
                <CardContent>
                    <div style={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                            <LineChart data={errorPoints}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const reports = payload[0].payload.reports;
                                            return (
                                                <div className="bg-gray-800 text-white p-2 rounded">
                                                    <div><b>{label}</b></div>
                                                    <div>Errors: {reports.length}</div>
                                                    {/*@ts-ignore*/}
                                                    {reports.slice(0,3).map((rep, i) => (
                                                        <div key={i} className="mt-1">
                                                            <div className="font-mono text-xs">{rep.time} — {rep.snippet}</div>
                                                        </div>
                                                    ))}
                                                    {reports.length > 3 && <div className="text-xs text-gray-400">+{reports.length-3} more</div>}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 7 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
            <div className="mt-8 text-center text-sm text-muted-foreground opacity-75">
                Powered by <span className="font-semibold">{modelName}</span>
            </div>
        </>
    );
}
