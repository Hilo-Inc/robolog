import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportDisplayProps = {
    report: string;
};

const parseReport = (report: string) => {
    if (!report) return [];

    const sections: { title: string, content: string }[] = [];
    // Split by the section headers (emojis), keeping the headers
    const reportParts = report.split(/(?=📄|🤖|🚨|⚠️|📊|🔧)/g);

    reportParts.forEach(part => {
        if (!part.trim()) return;

        const firstLineEnd = part.indexOf('\n');
        const title = firstLineEnd !== -1 ? part.substring(0, firstLineEnd).trim() : part.trim();
        const content = firstLineEnd !== -1 ? part.substring(firstLineEnd + 1).trim() : '';
        
        sections.push({ title, content });
    });

    return sections;
};

export const ReportDisplay = ({ report }: ReportDisplayProps) => {
    const sections = parseReport(report);

    return (
        <div className="space-y-4">
            {sections.map((section, index) => (
                <Card key={index}>
                    <CardHeader>
                        <CardTitle>{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="whitespace-pre-wrap font-mono text-sm">{section.content}</pre>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};