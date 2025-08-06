"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ChatContextType {
    isGlobalChatOpen: boolean;
    setIsGlobalChatOpen: (open: boolean) => void;
    globalChatReport: string;
    setGlobalChatReport: (report: string) => void;
    globalChatReportId: string;
    setGlobalChatReportId: (id: string) => void;
    openGlobalChat: (report?: string, reportId?: string) => void;
    closeGlobalChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
    const [globalChatReport, setGlobalChatReport] = useState("");
    const [globalChatReportId, setGlobalChatReportId] = useState("");

    const openGlobalChat = (report?: string, reportId?: string) => {
        setGlobalChatReport(report || "");
        setGlobalChatReportId(reportId || `general-chat-${Date.now()}`);
        setIsGlobalChatOpen(true);
    };

    const closeGlobalChat = () => {
        setIsGlobalChatOpen(false);
        // Keep the report and reportId for potential reopening
    };

    return (
        <ChatContext.Provider value={{
            isGlobalChatOpen,
            setIsGlobalChatOpen,
            globalChatReport,
            setGlobalChatReport,
            globalChatReportId,
            setGlobalChatReportId,
            openGlobalChat,
            closeGlobalChat
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChatContext must be used within a ChatProvider');
    }
    return context;
}