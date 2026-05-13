/**
 * Output sanitization to prevent prompt injection attacks
 * Removes suspicious patterns that could escape agent context
 */

export function sanitizeOutput(text: string): string {
  return text
    // Remove template directives
    .replace(/\{[#%].*?[#%]\}/g, '')
    // Remove system prompt markers
    .replace(/\[SYSTEM[\]:].*?\[\/SYSTEM\]/gi, '')
    .replace(/\[ADMIN[\]:].*?\[\/ADMIN\]/gi, '')
    // Remove potential prompt injection patterns
    .replace(/ignore\s+above.*?instructions/gi, '')
    .replace(/forget\s+previous.*?context/gi, '')
    .trim();
}

/**
 * Sanitize a single chunk of documentation content
 * Removes malicious content while preserving code blocks and formatting
 */
export function sanitizeDocContent(content: string): string {
  // First sanitize for injection patterns
  let sanitized = sanitizeOutput(content);

  // Escape potential dangerous markdown constructs
  // but preserve code blocks (between triple backticks)
  const codeBlockPattern = /```[\s\S]*?```/g;
  const codeBlocks = sanitized.match(codeBlockPattern) || [];
  
  // Temporarily replace code blocks
  let temp = sanitized;
  codeBlocks.forEach((block, i) => {
    temp = temp.replace(block, `__CODE_BLOCK_${i}__`);
  });

  // Sanitize outside code blocks
  temp = sanitizeOutput(temp);

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    temp = temp.replace(`__CODE_BLOCK_${i}__`, block);
  });

  return temp;
}
