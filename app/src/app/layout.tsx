import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Github } from "lucide-react";
import { ChatProvider } from "@/contexts/ChatContext";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { MobileSidebarNav } from "@/components/layout/MobileSidebarNav";
import { GlobalChatModal } from "@/components/layout/GlobalChatModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Robolog AI Demo",
  description: "Live Log Analysis with AI model",
};


export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
      <ChatProvider>
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-muted/40 md:block">
          <SidebarNav />
        </div>
        <div className="flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col w-[280px] sm:w-[320px]">
                <MobileSidebarNav />
              </SheetContent>
            </Sheet>
            <div className="w-full flex-1" />
            <Button variant="outline" size="icon" asChild>
              <a href="https://github.com/Hilo-Inc/robolog" target="_blank" rel="noopener noreferrer">
                <Github className="h-[1.2rem] w-[1.2rem]" />
              </a>
            </Button>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <GlobalChatModal />
      </ChatProvider>
      </body>
      </html>
  );
}
