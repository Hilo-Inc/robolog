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
import { ChatModal } from "@/components/dashboard/ChatModal";
import { AskQuestionButton } from "@/components/dashboard/AskQuestionButton";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from 'recharts';
import { ChevronDown, ChevronUp, Calendar, Clock, AlertTriangle, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface ParsedReport {
    id: string;
    time: string;
    date: string;
    topSeverity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'UNKNOWN';
    snippet: string;
    fullReport: string;
    timestamp: number;
}

interface ProcessingStatus {
    stage: string;
    message: string;
    timestamp: number;
    logsCount?: number;
    instance?: string;
    processingTime?: number;
    summaryLength?: number;
    queueSize?: number;
    priority?: string;
    retries?: number;
    totalTime?: number;
    error?: string;
}

interface ProcessingState {
    isActive: boolean;
    currentStage: string;
    message: string;
    startTime: number;
    logsCount: number;
    queueSize: number;
    processingTime: number;
    stages: ProcessingStatus[];
}

// Mobile-friendly report card component
const MobileReportCard = ({ report, onViewDetails }: { 
    report: ParsedReport; 
    onViewDetails: (report: ParsedReport) => void;
}) => (
    <Card className="mb-3">
        <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{report.date}</span>
                    <Clock className="h-4 w-4 ml-2" />
                    <span>{report.time}</span>
                </div>
                <Badge variant={report.topSeverity === 'CRITICAL' || report.topSeverity === 'ERROR' ? 'destructive' : 'default'}>
                    {report.topSeverity}
                </Badge>
            </div>
            <div className="mb-3">
                <p className="text-sm line-clamp-2">{report.snippet}</p>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onViewDetails(report)}
                className="w-full"
            >
                View Details
            </Button>
        </CardContent>
    </Card>
);

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

function getStageIcon(stage: string) {
    switch (stage) {
        case 'queue_added':
        case 'queue_processing':
        case 'queue_updated':
            return <Loader2 className="h-4 w-4 animate-spin" />;
        case 'ollama_started':
        case 'ollama_completed':
            return <Loader2 className="h-4 w-4 animate-spin" />;
        case 'webhook_sending':
            return <Loader2 className="h-4 w-4 animate-spin" />;
        case 'completed':
        case 'queue_completed':
            return <CheckCircle className="h-4 w-4 text-green-400" />;
        case 'ollama_failed':
        case 'error':
            return <XCircle className="h-4 w-4 text-red-400" />;
        default:
            return <AlertCircle className="h-4 w-4" />;
    }
}

function getStageColor(stage: string) {
    if (stage.includes('error') || stage.includes('failed')) return 'text-red-400';
    if (stage.includes('completed')) return 'text-green-400';
    if (stage.includes('queue') || stage.includes('ollama') || stage.includes('webhook')) return 'text-blue-400';
    return 'text-blue-300';
}

function parseReportForTable(report: string, index: number): ParsedReport {
    const id = `${Date.now()}-${index}`;

    let time = "N/A";
    let date = "N/A";
    let timestamp = Date.now();
    
    // Try to extract time from the log entries
    const timeMatch = report.match(/\[(\d{2}:\d{2}:\d{2})\]/);
    if (timeMatch) {
        time = timeMatch[1];
        
        // Create a proper date/timestamp for this report
        const now = new Date();
        const [h, m, s] = timeMatch[1].split(':').map(Number);
        const reportDate = new Date(now);
        reportDate.setHours(h, m, s, 0);
        
        // If the time is in the future, assume it's from yesterday
        if (reportDate > now) {
            reportDate.setDate(reportDate.getDate() - 1);
        }
        
        timestamp = reportDate.getTime();
        date = reportDate.toLocaleDateString();
        time = reportDate.toLocaleTimeString();
    }

    // Improved severity detection based on actual AI report structure
    let topSeverity: ParsedReport['topSeverity'] = 'UNKNOWN';
    
    // Check for section headers with emojis (highest priority first)
    if (report.includes('🚨') || report.match(/\*\*CRITICAL\s+ISSUES?\*\*/i)) {
        topSeverity = 'CRITICAL';
    } else if (report.includes('❌') || report.match(/\*\*ERROR\s+ISSUES?\*\*/i)) {
        topSeverity = 'ERROR';
    } else if (report.includes('⚠️') || report.match(/\*\*WARNINGS?\*\*/i)) {
        topSeverity = 'WARNING';
    } else if (report.includes('📊') || report.includes('🤖') || report.includes('🔧')) {
        // If we only have summary/analysis/actions sections, default to warning
        topSeverity = 'WARNING';
    }

    // Improved snippet extraction - get meaningful content instead of just titles
    let snippet = "Could not generate summary snippet.";
    
    // Try to find the AI analysis section
    const summaryMatch = report.match(/🤖 \*\*AI Log Analysis.*?\*\*:\s*([\s\S]*)/);
    if (summaryMatch && summaryMatch[1]) {
        const analysisContent = summaryMatch[1].trim();
        
        // Look for the first meaningful line after section headers
        const lines = analysisContent.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Skip empty lines, section headers, and bullet point headers
            if (trimmedLine && 
                !trimmedLine.startsWith('🚨') && 
                !trimmedLine.startsWith('⚠️') && 
                !trimmedLine.startsWith('📊') && 
                !trimmedLine.startsWith('🔧') &&
                !trimmedLine.match(/^\*\*[A-Z\s]+\*\*$/)) {
                
                // If it's a bullet point, extract the content after the dash and formatting
                if (trimmedLine.startsWith('- ')) {
                    snippet = trimmedLine.substring(2).replace(/\*\*([^*]+)\*\*/g, '$1').trim();
                } else {
                    snippet = trimmedLine.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
                }
                
                // Limit snippet length
                if (snippet.length > 100) {
                    snippet = snippet.substring(0, 100) + '...';
                }
                break;
            }
        }
    }

    return { id, time, date, topSeverity, snippet, fullReport: report, timestamp };
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
    const [selectedReport, setSelectedReport] = useState<ParsedReport | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingState>({
        isActive: false,
        currentStage: '',
        message: '',
        startTime: 0,
        logsCount: 0,
        queueSize: 0,
        processingTime: 0,
        stages: []
    });
    const [modelName, setModelName] = useState<string>("...");
    const [showOldIssues, setShowOldIssues] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);

    // ✨ NEW: Persist reports to localStorage whenever they change.
    useEffect(() => {
        try {
            // This effect runs every time the `reports` state is updated.
            window.localStorage.setItem('robolog-reports', JSON.stringify(reports));
        } catch (error) {
            console.error("Failed to save reports to localStorage", error);
        }
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
            console.log('Processing started event received:', data);
            const logSnippets = data.logs.map(log => `- [${log.container}] ${log.message.substring(0, 80)}...`).join('\n');
            
            setProcessingState({
                isActive: true,
                currentStage: 'started',
                message: `🤖 Analyzer has received ${data.count} new error(s) and is generating a report. This may take a moment...\n\nLogs received:\n${logSnippets}`,
                startTime: Date.now(),
                logsCount: data.count,
                queueSize: 0,
                processingTime: 0,
                stages: []
            });
            
            // Fallback: Clear processing status after 2 minutes if no report is received
            const timeoutId = setTimeout(() => {
                console.log('Processing timeout reached, clearing status');
                setProcessingState(prev => ({ ...prev, isActive: false }));
            }, 120000); // 2 minutes
            
            // Store timeout ID to clear it if we receive a report
            (window as any).processingTimeout = timeoutId;
        });

        socket.on('processing-status', (status: ProcessingStatus) => {
            console.log('Processing status update received:', status);
            
            setProcessingState(prev => {
                const newStages = [...prev.stages, status];
                // Keep only last 10 stages to prevent memory issues
                const recentStages = newStages.slice(-10);
                
                return {
                    ...prev,
                    isActive: true,
                    currentStage: status.stage,
                    message: status.message,
                    logsCount: status.logsCount || prev.logsCount,
                    queueSize: status.queueSize || prev.queueSize,
                    processingTime: status.processingTime || prev.processingTime,
                    stages: recentStages
                };
            });
        });

        socket.on("new-summary", (newReport: string) => {
            console.log('New summary received, clearing processing status');
            
            // Clear the timeout if we receive a report
            if ((window as any).processingTimeout) {
                clearTimeout((window as any).processingTimeout);
                (window as any).processingTimeout = null;
            }
            
            // ✅ This update will trigger the localStorage persistence effect.
            setReports(prev => [newReport, ...prev]);
            setProcessingState(prev => ({ ...prev, isActive: false }));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Listen for test markdown reports
    useEffect(() => {
        const handleTestMarkdownReport = (event: any) => {
            const { report } = event.detail;
            console.log('Test markdown report received:', report);
            setReports(prev => [report, ...prev]);
        };

        window.addEventListener('test-markdown-report', handleTestMarkdownReport);
        return () => {
            window.removeEventListener('test-markdown-report', handleTestMarkdownReport);
        };
    }, []);

    // ✨ NEW: Periodic status check for processing state
    useEffect(() => {
        const checkProcessingStatus = async () => {
            try {
                const response = await fetch('/analyzer/processing-status');
                if (response.ok) {
                    const data = await response.json();
                    
                    // Update processing state if there's active processing
                    if (data.isProcessing && !processingState.isActive) {
                        setProcessingState(prev => ({
                            ...prev,
                            isActive: true,
                            currentStage: 'checking',
                            message: '🔄 Checking processing status...',
                            startTime: Date.now(),
                            queueSize: data.queueSize || 0
                        }));
                    } else if (!data.isProcessing && processingState.isActive) {
                        // Clear processing state if no longer processing
                        setProcessingState(prev => ({ ...prev, isActive: false }));
                    }
                }
            } catch (error) {
                console.error('Failed to check processing status:', error);
            }
        };

        // Check status every 5 seconds
        const intervalId = setInterval(checkProcessingStatus, 5000);
        
        return () => clearInterval(intervalId);
    }, [processingState.isActive]);

    const parsedReports = reports.map(parseReportForTable);

    // Separate recent and old reports (12 hours = 12 * 60 * 60 * 1000 ms)
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    const recentReports = parsedReports.filter(report => report.timestamp > twelveHoursAgo);
    const oldReports = parsedReports.filter(report => report.timestamp <= twelveHoursAgo);

    const buckets = getLast12HoursBuckets();

    const chartData = buckets.map(b => ({
        hour: b.hour,
        reports: []
    }));

    // Use the same report data as the table instead of separate errorLogs
    for (const report of parsedReports) {
        if (report.timestamp > 0) {
            const reportDate = new Date(report.timestamp);
            const hourIso = reportDate.toISOString().slice(0, 13);
            const idx = buckets.findIndex(b => b.iso === hourIso);
            if (idx !== -1) {
                // @ts-ignore
                chartData[idx].reports.push(report);
            }
        }
    }

    const errorPoints = chartData.map(b => ({
        hour: b.hour,
        count: b.reports.length,
        reports: b.reports
    }));

    return (
        <>
            {processingState.isActive && (
                <Card className="mb-4 bg-blue-900/50 border-blue-500">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-300 flex items-center gap-2 animate-pulse">
                            <div className="w-4 h-4 bg-blue-400 rounded-full animate-bounce"></div>
                            Analysis in Progress
                            {processingState.currentStage && (
                                <Badge 
                                    variant={processingState.currentStage.includes('error') || processingState.currentStage.includes('failed') ? 'destructive' : 'outline'} 
                                    className="ml-2 text-xs"
                                >
                                    {processingState.currentStage.replace(/_/g, ' ')}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-blue-200">
                                {processingState.message}
                            </pre>
                            
                            {/* Processing details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-300">
                                {processingState.logsCount > 0 && (
                                    <div>📊 Logs: {processingState.logsCount}</div>
                                )}
                                {processingState.queueSize > 0 && (
                                    <div>📋 Queue: {processingState.queueSize}</div>
                                )}
                                {processingState.processingTime > 0 && (
                                    <div>⏱️ Time: {processingState.processingTime}ms</div>
                                )}
                                <div>🕐 Duration: {Math.round((Date.now() - processingState.startTime) / 1000)}s</div>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="mt-2">
                                <div className="w-full bg-blue-900/50 rounded-full h-2">
                                    <div 
                                        className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                                        style={{ 
                                            width: `${Math.min(100, (Date.now() - processingState.startTime) / 1000 / 60 * 100)}%` 
                                        }}
                                    ></div>
                                </div>
                                <div className="text-xs text-blue-400 mt-1">
                                    Progress: {Math.round((Date.now() - processingState.startTime) / 1000)}s elapsed
                                </div>
                            </div>
                            
                            {/* Recent stages */}
                            {processingState.stages.length > 0 && (
                                <div className="mt-3">
                                    <div className="text-xs text-blue-400 mb-2">Recent stages:</div>
                                    <div className="space-y-1">
                                        {processingState.stages.slice(-3).map((stage, index) => (
                                            <div key={index} className={`text-xs flex items-center gap-2 ${getStageColor(stage.stage)}`}>
                                                {getStageIcon(stage.stage)}
                                                <span>{stage.message}</span>
                                                {stage.processingTime && (
                                                    <span className="text-blue-400">({stage.processingTime}ms)</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
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
                    {/* Mobile view - Card layout */}
                    <div className="md:hidden">
                        {recentReports.length > 0 ? (
                            <div className="space-y-3">
                                {recentReports.map((report) => (
                                    <MobileReportCard
                                        key={report.id}
                                        report={report}
                                        onViewDetails={setSelectedReport}
                                    />
                                ))}
                                
                                {oldReports.length > 0 && (
                                    <div className="mt-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowOldIssues(!showOldIssues)}
                                            className="w-full flex items-center justify-center gap-2"
                                        >
                                            {showOldIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            {showOldIssues ? 'Hide' : 'Show'} older issues ({oldReports.length} items older than 12 hours)
                                            {showOldIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        
                                        {showOldIssues && (
                                            <div className="space-y-3 mt-3">
                                                {oldReports.map((report) => (
                                                    <MobileReportCard
                                                        key={report.id}
                                                        report={report}
                                                        onViewDetails={setSelectedReport}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-24 text-center flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <p>No recent reports. Go to the Testing Tools page to generate some errors.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop view - Table layout */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[140px]">Date & Time</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Summary</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentReports.length > 0 ? recentReports.map((report) => (
                                    <TableRow key={report.id}>
                                        <TableCell className="font-mono">
                                            <div className="text-xs">{report.date}</div>
                                            <div>{report.time}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={report.topSeverity === 'CRITICAL' || report.topSeverity === 'ERROR' ? 'destructive' : 'default'}>
                                                {report.topSeverity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-sm truncate">{report.snippet}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                                                View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No recent reports. Go to the Testing Tools page to generate some errors.
                                        </TableCell>
                                    </TableRow>
                                )}
                                
                                {oldReports.length > 0 && (
                                    <>
                                        <TableRow className="bg-muted/50">
                                            <TableCell colSpan={4}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowOldIssues(!showOldIssues)}
                                                    className="w-full flex items-center justify-center gap-2"
                                                >
                                                    {showOldIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    {showOldIssues ? 'Hide' : 'Show'} older issues ({oldReports.length} items older than 12 hours)
                                                    {showOldIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                        {showOldIssues && oldReports.map((report) => (
                                            <TableRow key={report.id} className="opacity-60">
                                                <TableCell className="font-mono">
                                                    <div className="text-xs">{report.date}</div>
                                                    <div>{report.time}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={report.topSeverity === 'CRITICAL' || report.topSeverity === 'ERROR' ? 'destructive' : 'default'}>
                                                        {report.topSeverity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-sm truncate">{report.snippet}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                                                        View Details
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedReport} onOpenChange={(open) => {
                if (!open) {
                    setSelectedReport(null);
                }
            }}>
                <DialogContent className="sm:max-w-[95vw] h-[90vh] flex flex-col p-0 sm:p-6">
                    <DialogHeader className="relative px-4 sm:px-0">
                        <DialogTitle>AI Report Details</DialogTitle>
                        <DialogDescription>
                            Full AI analysis and follow-up prompt for report generated at {selectedReport?.time}.
                        </DialogDescription>
                        {/* Ask Question Button - moved to next line on mobile */}
                        <div className="mt-4 sm:absolute sm:bottom-0 sm:right-0 sm:mt-0">
                            <AskQuestionButton
                                onClick={() => setShowChatModal(true)}
                            />
                        </div>
                    </DialogHeader>
                    
                    {/* Full-width report display with horizontal scroll */}
                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="px-4 sm:px-0">
                                <ReportDisplay report={selectedReport?.fullReport ?? ''} />
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Chat Modal */}
            <ChatModal
                isOpen={showChatModal}
                onClose={() => setShowChatModal(false)}
                report={selectedReport?.fullReport ?? ''}
                reportId={selectedReport?.id ?? ''}
            />
            
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
                                                    <div>Reports: {reports.length}</div>
                                                    {reports.slice(0,3).map((report: ParsedReport, i: number) => (
                                                        <div key={i} className="mt-1">
                                                            <div className="font-mono text-xs">
                                                                <span className="text-yellow-400">{report.topSeverity}</span> — {report.snippet}
                                                            </div>
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
