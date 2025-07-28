"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FollowUpProps = {
    report: string;
    onNewDetails: (details: string) => void;
};

export const FollowUp = ({ report, onNewDetails }: FollowUpProps) => {
    const [question, setQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || !report) return;

        setIsLoading(true);
        onNewDetails('Asking AI for more details...');
        try {
            const response = await fetch('/api/ask-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report, question }),
            });
            const data = await response.json();
            if (response.ok) {
                onNewDetails(data.details);
            } else {
                throw new Error(data.message || 'Failed to get details');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            onNewDetails(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setQuestion('');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ask a follow-up question</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit}>
                    <Textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g., 'Explain the Nginx upstream error in more detail.' or 'Give me a shell command to check for the memory leak.'"
                        rows={3}
                        disabled={!report || isLoading}
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !question.trim() || !report}
                        className="mt-2 w-full"
                    >
                        {isLoading ? 'Thinking...' : 'Ask AI'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};
