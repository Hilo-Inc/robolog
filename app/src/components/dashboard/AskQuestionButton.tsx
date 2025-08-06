"use client";

import Image from "next/image";
import { MessageCircle } from "lucide-react";

interface AskQuestionButtonProps {
    onClick: () => void;
    variant?: 'default' | 'sidebar';
    className?: string;
}

export const AskQuestionButton = ({ 
    onClick, 
    variant = 'default',
    className = '' 
}: AskQuestionButtonProps) => {
    if (variant === 'sidebar') {
        return (
            <button
                onClick={onClick}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm mx-2 lg:mx-4 ${className}`}
                title="Ask Robolog AI a question"
            >
                <Image
                    src="/images/robolog-logo.png"
                    alt="Robolog AI"
                    width={16}
                    height={16}
                    className="rounded"
                />
                <span className="text-sm font-medium">Ask a question</span>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-all group shadow-lg ${className}`}
            title="Chat with Robolog AI"
        >
            <Image
                src="/images/robolog-logo.png"
                alt="Robolog AI"
                width={24}
                height={24}
                className="rounded group-hover:scale-110 transition-transform"
            />
            <span className="text-sm font-medium">Ask a question</span>
        </button>
    );
};