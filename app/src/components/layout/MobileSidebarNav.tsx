"use client";

import Link from "next/link";
import Image from "next/image";
import { Home, FlaskConical, Settings } from "lucide-react";
import { AskQuestionButton } from "@/components/dashboard/AskQuestionButton";
import { useChatContext } from "@/contexts/ChatContext";
import { SheetClose } from "@/components/ui/sheet";

const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/testing', label: 'Testing Tools', icon: FlaskConical },
    { href: '/config', label: 'Ollama Config', icon: Settings },
];

export function MobileSidebarNav() {
    const { openGlobalChat } = useChatContext();

    const handleAskQuestion = () => {
        openGlobalChat();
    };

    return (
        <>
            <nav className="grid gap-2 text-lg font-medium flex-1">
                <SheetClose asChild>
                    <Link href="/" className="flex items-center gap-2 text-lg font-semibold mb-4">
                        <Image
                            src="/images/robolog-logo.png"
                            alt="Robolog Logo"
                            width={48}
                            height={48}
                            className="h-6 w-6"
                        />
                        <span>Robolog AI</span>
                    </Link>
                </SheetClose>
                {navItems.map(item => (
                    <SheetClose key={item.href} asChild>
                        <Link 
                            href={item.href} 
                            className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    </SheetClose>
                ))}
            </nav>
            
            {/* Ask Question Button in Mobile Sidebar */}
            <div className="mt-auto p-4 border-t">
                <AskQuestionButton 
                    variant="sidebar"
                    onClick={handleAskQuestion}
                />
            </div>
        </>
    );
}