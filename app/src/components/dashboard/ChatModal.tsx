"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, MessageCircle, Bot, User } from "lucide-react";
import Image from "next/image";

interface ChatEntry {
    id: string;
    question: string;
    answer: string;
    timestamp: string;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: string;
    reportId: string;
}

export const ChatModal = ({ isOpen, onClose, report, reportId }: ChatModalProps) => {
    const [question, setQuestion] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chats, setChats] = useState<ChatEntry[]>([]);
    const [loadingChats, setLoadingChats] = useState(true);

    // Load existing chats when modal opens
    useEffect(() => {
        if (isOpen && reportId) {
            loadChats();
        }
    }, [isOpen, reportId]);

    const loadChats = async () => {
        try {
            setLoadingChats(true);
            const response = await fetch(`/api/chat?reportId=${encodeURIComponent(reportId)}`);
            const data = await response.json();
            if (response.ok) {
                setChats(data.chats || []);
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
        } finally {
            setLoadingChats(false);
        }
    };

    const handleSubmit = async () => {
        if (!question.trim() || !report) return;

        setIsLoading(true);
        try {
            // Send question to analyzer
            const response = await fetch('/api/ask-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report, question })
            });

            if (response.ok) {
                const data = await response.json();
                const answer = data.details || "Sorry, I couldn't generate a response.";

                // Save the chat
                const saveResponse = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportId,
                        question: question.trim(),
                        answer,
                        timestamp: new Date().toISOString()
                    })
                });

                if (saveResponse.ok) {
                    const savedChat = await saveResponse.json();
                    setChats(prev => [...prev, savedChat.chat]);
                    setQuestion("");
                } else {
                    console.error('Failed to save chat');
                }
            } else {
                console.error('Failed to get response from analyzer');
            }
        } catch (error) {
            console.error('Error asking follow-up question:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-3">
                        <Image
                            src="/images/robolog-logo.png"
                            alt="Robolog"
                            width={32}
                            height={32}
                            className="rounded"
                        />
                        <MessageCircle className="h-5 w-5" />
                        Chat with Robolog AI
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    {/* Chat History */}
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-4">
                            {loadingChats ? (
                                <div className="text-center text-muted-foreground py-8">
                                    Loading chat history...
                                </div>
                            ) : chats.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No previous conversations about this report.</p>
                                    <p className="text-sm">Ask a question to get started!</p>
                                </div>
                            ) : (
                                chats.map((chat) => (
                                    <div key={chat.id} className="space-y-3">
                                        {/* User Question */}
                                        <Card className="bg-blue-950/30 border-blue-500/30">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    You asked:
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <p className="text-sm">{chat.question}</p>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {new Date(chat.timestamp).toLocaleString()}
                                                </p>
                                            </CardContent>
                                        </Card>

                                        {/* AI Answer */}
                                        <Card className="bg-green-950/30 border-green-500/30 ml-4">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Bot className="h-4 w-4" />
                                                    Robolog AI answered:
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                                                    {chat.answer}
                                                </pre>
                                            </CardContent>
                                        </Card>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="flex-shrink-0 space-y-3 border-t pt-4">
                        <Textarea
                            placeholder="Ask a follow-up question about this report... (Ctrl+Enter to send)"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={handleKeyPress}
                            className="min-h-[80px] resize-none"
                            disabled={isLoading}
                        />
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                                Tip: Press Ctrl+Enter to send your question
                            </p>
                            <Button 
                                onClick={handleSubmit} 
                                disabled={!question.trim() || isLoading}
                                className="flex items-center gap-2"
                            >
                                <Send className="h-4 w-4" />
                                {isLoading ? 'Thinking...' : 'Send'}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};