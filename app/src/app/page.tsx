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

interface ParsedReport {
    id: string;
    time: string;
    topSeverity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'UNKNOWN';
    snippet: string;
    fullReport: string;
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
    // The 's' (dotAll) flag in the original regex is an ES2018 feature.
    // The build environment seems to target an older ECMAScript version, causing a type error.
    // Replacing `.` with `[\s\S]` is a compatible way to match any character, including newlines.
    const summaryMatch = report.match(/🤖 \*\*AI Log Analysis.*?\*\*:\n([\s\S]*)/);
    if (summaryMatch && summaryMatch[1]) {
        snippet = summaryMatch[1].trim().split('\n')[0];
    }

    return { id, time, topSeverity, snippet, fullReport: report };
}


export default function DashboardPage() {
    const [reports, setReports] = useState<string[]>([]);
    const [status, setStatus] = useState("Not connected");
    const [detailedReport, setDetailedReport] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<ParsedReport | null>(null);

    // Fetch initial reports
    useEffect(() => {
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
    }, []);

    // Setup WebSocket
    useEffect(() => {
        const socket = io({
            path: "/analyzer/socket.io",
            transports: ["websocket"],
        });

        socket.on("connect", () => setStatus("Connected to Analyzer"));
        socket.on("disconnect", () => setStatus("Disconnected from Analyzer"));
        socket.on("new-summary", (newReport: string) => {
            setReports(prev => [newReport, ...prev]);
        });
        return () => {
            socket.disconnect();
        };
    }, []);

    const parsedReports = reports.map(parseReportForTable);

    return (
        <>
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
        </>
    );
}
