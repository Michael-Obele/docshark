// src/processor/chunker.ts — Heading-based semantic chunking

export interface Chunk {
    content: string;
    headingContext: string;
    tokenCount: number;
    hasCodeBlock: boolean;
}

const MAX_TOKENS = 1200;
const MIN_TOKENS = 50;

export function chunkMarkdown(
    markdown: string,
    _headings: Array<{ level: number; text: string }>,
): Chunk[] {
    const sections = splitByHeadings(markdown);
    const chunks: Chunk[] = [];

    for (const section of sections) {
        const tokens = estimateTokens(section.content);

        if (tokens < MIN_TOKENS) continue;

        if (tokens <= MAX_TOKENS) {
            chunks.push({
                content: section.content,
                headingContext: section.headingPath,
                tokenCount: tokens,
                hasCodeBlock: section.content.includes('```'),
            });
        } else {
            // Split large sections by paragraphs
            const paras = splitByParagraphs(section.content);
            let buffer = '';
            for (const para of paras) {
                if (estimateTokens(buffer + para) > MAX_TOKENS && buffer) {
                    chunks.push({
                        content: buffer.trim(),
                        headingContext: section.headingPath,
                        tokenCount: estimateTokens(buffer),
                        hasCodeBlock: buffer.includes('```'),
                    });
                    buffer = '';
                }
                buffer += para + '\n\n';
            }
            if (buffer.trim() && estimateTokens(buffer) >= MIN_TOKENS) {
                chunks.push({
                    content: buffer.trim(),
                    headingContext: section.headingPath,
                    tokenCount: estimateTokens(buffer),
                    hasCodeBlock: buffer.includes('```'),
                });
            }
        }
    }

    return chunks;
}

function splitByHeadings(md: string) {
    const lines = md.split('\n');
    const sections: Array<{ content: string; headingPath: string }> = [];
    const headingStack: string[] = [];
    let currentContent = '';

    for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            if (currentContent.trim()) {
                sections.push({ content: currentContent.trim(), headingPath: headingStack.join(' > ') });
            }
            const level = headingMatch[1].length;
            const text = headingMatch[2];
            while (headingStack.length >= level) headingStack.pop();
            headingStack.push(text);
            currentContent = line + '\n';
        } else {
            currentContent += line + '\n';
        }
    }

    if (currentContent.trim()) {
        sections.push({ content: currentContent.trim(), headingPath: headingStack.join(' > ') });
    }

    return sections;
}

function splitByParagraphs(text: string): string[] {
    return text.split(/\n{2,}/).filter(Boolean);
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
