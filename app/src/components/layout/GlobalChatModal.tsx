"use client";

import { useChatContext } from "@/contexts/ChatContext";
import { ChatModal } from "@/components/dashboard/ChatModal";

export function GlobalChatModal() {
    const {
        isGlobalChatOpen,
        closeGlobalChat,
        globalChatReport,
        globalChatReportId
    } = useChatContext();

    return (
        <ChatModal
            isOpen={isGlobalChatOpen}
            onClose={closeGlobalChat}
            report={globalChatReport}
            reportId={globalChatReportId}
        />
    );
}