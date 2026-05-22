// Lightweight markdown -> HTML renderer for Medhā. Zero deps. Safe-ish for AI replies.
// Handles: paragraphs, bold **x**, italic *x* / _x_, inline `code`, headings #..######,
// unordered lists (- / * / •), ordered lists (1.), blockquotes >, autolinks, mailto autolinks,
// soft line breaks (single newline -> <br/>), and escapes raw HTML.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineFormat(s: string): string {
  // We escape first, then re-introduce safe markup.
  let out = escapeHtml(s);

  // Code spans
  out = out.replace(/`([^`]+?)`/g, '<code>$1</code>');
  // Bold (**x** or __x__)
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  // Italic (*x* or _x_) — require a non-space on the inside
  out = out.replace(/(^|[^*])\*([^\s*][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^\s_][^_]*?)_(?!_)/g, '$1<em>$2</em>');
  // Autolink emails -> mailto
  out = out.replace(
    /([\w.+-]+@[\w-]+\.[\w.-]+)/g,
    '<a href="mailto:$1" class="md-mail">$1</a>',
  );
  // Autolink http(s) urls
  out = out.replace(
    /(^|\s)(https?:\/\/[^\s<]+[^\s<.,)\]])/g,
    '$1<a href="$2" target="_blank" rel="noopener" class="md-link">$2<\/a>',
  );
  return out;
}

export function renderMarkdown(input: string): string {
  if (!input) return '';
  const text = input.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Skip blank lines
    if (!line.trim()) { i++; continue; }
    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(`<h${level} class="md-h md-h${level}">${inlineFormat(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote class="md-quote">${inlineFormat(buf.join(' '))}</blockquote>`);
      continue;
    }
    // Unordered list
    if (/^\s*[-*\u2022]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*\u2022]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*\u2022]\s+/, ''));
        i++;
      }
      blocks.push(
        `<ul class="md-ul">${items.map(it => `<li>${inlineFormat(it)}<\/li>`).join('')}<\/ul>`,
      );
      continue;
    }
    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        `<ol class="md-ol">${items.map(it => `<li>${inlineFormat(it)}<\/li>`).join('')}<\/ol>`,
      );
      continue;
    }
    // Paragraph (consume until blank line)
    const paraBuf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>\s?|\s*[-*\u2022]\s+|\s*\d+\.\s+)/.test(lines[i])) {
      paraBuf.push(lines[i]);
      i++;
    }
    // Single newlines -> <br/>
    const para = paraBuf.map(l => inlineFormat(l)).join('<br/>');
    blocks.push(`<p class="md-p">${para}<\/p>`);
  }
  return blocks.join('');
}

// ---------- Guardrail: redirect taboo topics to Sandhi ----------
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\b(api[\s_-]?key|secret[\s_-]?key|access[\s_-]?key|token|password|passwd|credential|cred(?:s)?)\b/i,
  /\b(source[\s-]?code|codebase|backend|frontend|repo|repository|commit|deploy|deployment|infra(?:structure)?|architecture|tech[\s-]?stack|stack[\s-]?used)\b/i,
  /\b(database|db|mongo(?:db)?|postgres|sql|schema|table|collection|query)\b/i,
  /\b(design|wireframe|flow[\s-]?chart|sitemap|user[\s-]?flow|prd|spec(?:ification)?|figma|mockup|prototype)\b/i,
  /\b(security|exploit|vulnerability|cve|pen[\s-]?test|breach|hack|crack)\b/i,
  /\b(admin|sudo|root|privilege|owner|build|cicd|ci\/cd|pipeline|env(?:ironment)?[\s-]?var(?:iable)?)\b/i,
  /\b(license|patent|trademark|legal[\s-]?owner)\b/i,
];

export function isForbiddenQuery(prompt: string): boolean {
  if (!prompt) return false;
  // Allow general philosophy mentions but block when paired with technical pull-back.
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(prompt)) return true;
  }
  return false;
}

export const SANDHI_REDIRECT_MARKDOWN =
  'That question lives **beyond Medhā’s cognitive surface** — it touches the inner architecture of VYAN.\n\n' +
  'Walk to the **Sandhi** orb (the Communiqué of VYAN) and reach out directly. Real humans, real answers.\n\n' +
  '- **General queries** — reachus@vyan.dev\n' +
  '- **Technical support** — need-support@vyan.dev\n' +
  '- **Administrative governance** — admin@vyan.dev\n\n' +
  '_I will gladly resume conversations on cognition, ideas, philosophy, life, science, language — anything that does not require lifting the veil of VYAN’s internals._';
