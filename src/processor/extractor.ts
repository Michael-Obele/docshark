// src/processor/extractor.ts — HTML content extraction + Markdown conversion
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
});

// Preserve language attribute on code blocks
turndown.addRule('fencedCodeBlock', {
    filter: (node: any) => node.nodeName === 'PRE' && node.querySelector('code'),
    replacement: (_content: string, node: any) => {
        const code = node.querySelector('code');
        const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
        const text = code?.textContent || '';
        return `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n`;
    },
});

// Strip images (noisy for search context)
turndown.addRule('removeImages', {
    filter: 'img',
    replacement: () => '',
});

export function extractAndConvert(
    html: string,
    url: string,
): { markdown: string; title: string; headings: Array<{ level: number; text: string }> } {
    const { document } = parseHTML(html);

    // Set the document URL for Readability to resolve relative links
    if (url) {
        try {
            const baseEl = document.createElement('base');
            baseEl.setAttribute('href', url);
            document.head.appendChild(baseEl);
        } catch {
            // Ignore if head doesn't exist
        }
    }

    // PRE-PROCESS: Rescue code blocks from aggressive Readability stripping
    // Many doc sites wrap <pre> blocks in complex UI (like <figure>) that Readability deletes.
    const pres = Array.from(document.querySelectorAll('pre'));
    for (const pre of pres) {
        const codeText = pre.textContent || '';
        if (!codeText) continue;

        const lang =
            pre.getAttribute('data-language') ||
            pre.className?.match(/language-(\w+)/)?.[1] ||
            pre.querySelector('code')?.getAttribute('data-language') ||
            pre.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] ||
            '';

        let wrapper: any = pre;

        // Walk up to find the container that exclusively holds this code block
        while (
            wrapper.parentElement &&
            !['BODY', 'MAIN', 'ARTICLE', 'SECTION'].includes(wrapper.parentElement.tagName.toUpperCase()) &&
            wrapper.parentElement.textContent?.trim() === pre.textContent?.trim()
        ) {
            wrapper = wrapper.parentElement;
        }

        const cleanPre = document.createElement('pre');
        const cleanCode = document.createElement('code');
        if (lang) cleanCode.className = `language-${lang}`;
        cleanCode.textContent = codeText;
        cleanPre.appendChild(cleanCode);

        wrapper.replaceWith(cleanPre as unknown as Node);
    }

    const reader = new Readability(document as any, { charThreshold: 100 });
    const article = reader.parse();

    const title = article?.title || document.querySelector('title')?.textContent || '';
    const contentHtml = article?.content || document.body?.innerHTML || '';
    const markdown = turndown.turndown(contentHtml).trim();

    // Extract heading hierarchy from the markdown
    const headings: Array<{ level: number; text: string }> = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(markdown)) !== null) {
        headings.push({ level: match[1].length, text: match[2].trim() });
    }

    return { markdown, title, headings };
}
