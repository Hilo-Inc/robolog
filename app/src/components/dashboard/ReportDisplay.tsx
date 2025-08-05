import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportDisplayProps = {
    report: string;
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
        <div className="space-y-4">
            {sections.map((section, index) => (
                <Card key={index} className={getSectionStyle(section.type)}>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                            {section.content}
                        </pre>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};