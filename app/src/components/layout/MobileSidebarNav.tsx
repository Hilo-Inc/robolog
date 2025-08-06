"use client";

import Link from "next/link";
import Image from "next/image";
import { Home, FlaskConical, Settings } from "lucide-react";
import { AskQuestionButton } from "@/components/dashboard/AskQuestionButton";

const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/testing', label: 'Testing Tools', icon: FlaskConical },
    { href: '/config', label: 'Ollama Config', icon: Settings },
];

export function MobileSidebarNav() {
    const handleAskQuestion = () => {
        // For now, just log - we'll enhance this later
        console.log('Open global chat from mobile sidebar');
    };

    return (
        <>
            <nav className="grid gap-2 text-lg font-medium flex-1">
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
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                        <item.icon className="h-5 w-5" />
                        {item.label}
                    </Link>
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