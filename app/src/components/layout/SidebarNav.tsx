"use client";

import Link from "next/link";
import Image from "next/image";
import { Home, FlaskConical, Settings } from "lucide-react";
import { AskQuestionButton } from "@/components/dashboard/AskQuestionButton";
import { useChatContext } from "@/contexts/ChatContext";

const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/testing', label: 'Testing Tools', icon: FlaskConical },
    { href: '/config', label: 'Ollama Config', icon: Settings },
];

export function SidebarNav() {
    const { openGlobalChat } = useChatContext();

    const handleAskQuestion = () => {
        openGlobalChat();
    };

    return (
        <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Image
                        src="/images/robolog-logo.png"
                        alt="Robolog Logo"
                        width={48}
                        height={48}
                        className="h-6 w-6"
                    />
                    <span className="">Robolog AI</span>
                </Link>
            </div>
            <div className="flex-1 flex flex-col">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    {navItems.map(item => (
                        <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
                
                {/* Ask Question Button in Sidebar */}
                <div className="mt-auto p-2 lg:p-4">
                    <AskQuestionButton 
                        variant="sidebar"
                        onClick={handleAskQuestion}
                    />
                </div>
            </div>
        </div>
    );
}