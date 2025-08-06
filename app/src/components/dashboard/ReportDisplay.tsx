import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

type ReportDisplayProps = {
    report: string;
};

// Component for copyable code blocks
const CopyableCodeBlock = ({ code, language = "" }: { code: string; language?: string }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="relative group my-2">
            <div className="flex items-center justify-between bg-gray-800 text-gray-200 px-3 py-2 rounded-t-md border">
                <span className="text-xs font-medium text-gray-400">
                    {language || 'Code'}
                </span>
                <Button
                    onClick={copyToClipboard}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                    {copied ? (
                        <Check className="h-3 w-3" />
                    ) : (
                        <Copy className="h-3 w-3" />
                    )}
                </Button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-3 rounded-b-md overflow-x-auto text-xs sm:text-sm font-mono border border-t-0 whitespace-pre">
                <code>{code}</code>
            </pre>
        </div>
    );
};

// Component for inline code
const InlineCode = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <span
            onClick={copyToClipboard}
            className="inline-flex items-center gap-1 bg-gray-800 text-gray-200 px-2 py-1 rounded text-xs sm:text-sm font-mono cursor-pointer hover:bg-gray-700 transition-colors"
            style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
            title="Click to copy"
        >
            {code}
            {copied ? (
                <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
            ) : (
                <Copy className="h-3 w-3 opacity-50 flex-shrink-0" />
            )}
        </span>
    );
};

// Enhanced markdown-like content renderer
const MarkdownContent = ({ content }: { content: string }) => {
    const renderContent = () => {
        const parts = [];
        let currentIndex = 0;

        // Regular expressions for different markdown elements
        const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
        const inlineCodeRegex = /`([^`]+)`/g;
        const boldRegex = /\*\*(.*?)\*\*/g;
        const listItemRegex = /^- (.+)$/gm;

        // First, handle code blocks
        let match;
        const codeBlocks: { start: number; end: number; language: string; code: string }[] = [];
        
        while ((match = codeBlockRegex.exec(content)) !== null) {
            codeBlocks.push({
                start: match.index,
                end: match.index + match[0].length,
                language: match[1] || 'bash',
                code: match[2].trim()
            });
        }

        // Process the content, replacing markdown elements
        codeBlocks.forEach((block, blockIndex) => {
            // Add text before this code block
            if (currentIndex < block.start) {
                const textBeforeBlock = content.slice(currentIndex, block.start);
                parts.push(
                    <span key={`text-${blockIndex}`}>
                        {renderInlineMarkdown(textBeforeBlock)}
                    </span>
                );
            }

            // Add the code block
            parts.push(
                <CopyableCodeBlock
                    key={`block-${blockIndex}`}
                    code={block.code}
                    language={block.language}
                />
            );

            currentIndex = block.end;
        });

        // Add remaining text after last code block
        if (currentIndex < content.length) {
            const remainingText = content.slice(currentIndex);
            parts.push(
                <span key="remaining">
                    {renderInlineMarkdown(remainingText)}
                </span>
            );
        }

        return parts.length > 0 ? parts : [renderInlineMarkdown(content)];
    };

    const renderInlineMarkdown = (text: string) => {
        const parts = [];
        let currentIndex = 0;

        // Handle inline code first - using more compatible approach
        const inlineCodeRegex = /`([^`]+)`/g;
        const inlineCodeMatches: Array<{ match: RegExpExecArray; index: number }> = [];
        let match;
        
        while ((match = inlineCodeRegex.exec(text)) !== null) {
            inlineCodeMatches.push({ match, index: inlineCodeMatches.length });
        }
        
        inlineCodeMatches.forEach(({ match, index }) => {
            if (match.index !== undefined) {
                // Add text before inline code
                if (currentIndex < match.index) {
                    const textBefore = text.slice(currentIndex, match.index);
                    parts.push(
                        <span key={`text-${index}`}>
                            {renderOtherMarkdown(textBefore)}
                        </span>
                    );
                }

                // Add inline code
                parts.push(
                    <InlineCode key={`code-${index}`} code={match[1]} />
                );

                currentIndex = match.index + match[0].length;
            }
        });

        // Add remaining text
        if (currentIndex < text.length) {
            const remainingText = text.slice(currentIndex);
            parts.push(
                <span key="remaining">
                    {renderOtherMarkdown(remainingText)}
                </span>
            );
        }

        return parts.length > 0 ? parts : [renderOtherMarkdown(text)];
    };

    const renderOtherMarkdown = (text: string) => {
        // Handle bold text and list items
        return text
            .split('\n')
            .map((line, lineIndex) => {
                // Handle list items
                if (line.match(/^- /)) {
                    const listContent = line.replace(/^- /, '');
                    return (
                        <div key={lineIndex} className="flex items-start gap-2 my-1">
                            <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                            <span className="text-sm" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {renderBoldText(listContent)}
                            </span>
                        </div>
                    );
                }
                
                // Regular line with potential bold text
                return (
                    <div key={lineIndex} className="text-sm" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {renderBoldText(line)}
                        {lineIndex < text.split('\n').length - 1 && <br />}
                    </div>
                );
            });
    };

    const renderBoldText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} className="font-semibold text-white" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return <span key={index} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{part}</span>;
        });
    };

    return <div className="space-y-1" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{renderContent()}</div>;
};

const parseReport = (report: string) => {
    if (!report) return [];

    const sections: { title: string, content: string, type: string }[] = [];
    // Split by the section headers (emojis), keeping the headers
    const reportParts = report.split(/(?=📄|🤖|🚨|⚠️|📊|🔧)/g);

    reportParts.forEach(part => {
        if (!part.trim()) return;

        const firstLineEnd = part.indexOf('\n');
        const title = firstLineEnd !== -1 ? part.substring(0, firstLineEnd).trim() : part.trim();
        const content = firstLineEnd !== -1 ? part.substring(firstLineEnd + 1).trim() : '';
        
        // Determine the type of section based on emoji
        let type = 'default';
        if (title.includes('🚨')) type = 'critical';
        else if (title.includes('⚠️')) type = 'warning';
        else if (title.includes('📊')) type = 'summary';
        else if (title.includes('🔧')) type = 'actions';
        else if (title.includes('📄')) type = 'logs';
        else if (title.includes('🤖')) type = 'analysis';
        
        sections.push({ title, content, type });
    });

    return sections;
};

const getSectionStyle = (type: string) => {
    switch (type) {
        case 'critical':
            return 'border-red-500 bg-red-950/20';
        case 'warning':
            return 'border-yellow-500 bg-yellow-950/20';
        case 'summary':
            return 'border-blue-500 bg-blue-950/20';
        case 'actions':
            return 'border-green-500 bg-green-950/20';
        case 'logs':
            return 'border-gray-500 bg-gray-950/20';
        case 'analysis':
            return 'border-purple-500 bg-purple-950/20';
        default:
            return '';
    }
};

export const ReportDisplay = ({ report }: ReportDisplayProps) => {
    const sections = parseReport(report);

    return (
        <div className="w-full">
            <div className="space-y-4">
                {sections.map((section, index) => (
                    <Card key={index} className={`${getSectionStyle(section.type)} mx-0`}>
                        <CardHeader className="pb-3 px-4 sm:px-6">
                            <CardTitle className="text-sm font-medium" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {section.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 px-4 sm:px-6">
                            <div className="text-sm leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                <MarkdownContent content={section.content} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};