import React from 'react';

/**
 * Minimal, dependency-free markdown renderer for the app's short legal/agreement
 * bodies (self-employment acknowledgment, cleaner agreement). It parses a trusted
 * markdown STRING into React elements — it never uses dangerouslySetInnerHTML, so
 * there is no HTML-injection surface. Supported grammar (all that our docs use):
 *
 *   #, ##, ###        headings
 *   1. / 2. / …       ordered list items
 *   - / *             unordered list items
 *   **bold**          inline bold
 *   blank line        paragraph break
 *
 * Anything else renders as plain paragraph text. Not a general markdown engine.
 */

// Parse inline **bold** into <strong> spans. Plain text otherwise.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-ink">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

const ORDERED_RE = /^(\d+)\.\s+(.*)$/;
const UNORDERED_RE = /^[-*]\s+(.*)$/;

export default function SimpleMarkdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push(
      <p key={`p${key++}`} className="font-jost text-[14px] font-light leading-relaxed text-ink-2">
        {renderInline(text, `p${key}`)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, idx) => (
      <li key={`li${idx}`} className="font-jost text-[14px] font-light leading-relaxed text-ink-2">
        {renderInline(item, `l${key}-${idx}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`ol${key++}`} className="list-decimal space-y-2 pl-5 marker:text-ink-3">
          {items}
        </ol>
      ) : (
        <ul key={`ul${key++}`} className="list-disc space-y-2 pl-5 marker:text-ink-3">
          {items}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      // A blank line ends a paragraph but NOT a list — our docs use "loose"
      // lists with blank lines between numbered items. The list is closed when
      // real non-list content (heading / plain text) or EOF arrives.
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const content = renderInline(heading[2], `h${key}`);
      const cls =
        level === 1
          ? 'font-newsreader text-lg font-semibold text-ink'
          : level === 2
            ? 'font-newsreader text-base font-semibold text-ink'
            : 'font-jost text-sm font-semibold text-ink';
      blocks.push(
        level === 1 ? (
          <h3 key={`h${key++}`} className={cls}>
            {content}
          </h3>
        ) : level === 2 ? (
          <h4 key={`h${key++}`} className={cls}>
            {content}
          </h4>
        ) : (
          <h5 key={`h${key++}`} className={cls}>
            {content}
          </h5>
        )
      );
      continue;
    }

    const ordered = line.match(ORDERED_RE);
    if (ordered) {
      flushParagraph();
      if (list && !list.ordered) flushList();
      if (!list) list = { ordered: true, items: [] };
      list.items.push(ordered[2]);
      continue;
    }

    const unordered = line.match(UNORDERED_RE);
    if (unordered) {
      flushParagraph();
      if (list && list.ordered) flushList();
      if (!list) list = { ordered: false, items: [] };
      list.items.push(unordered[1]);
      continue;
    }

    // Plain text line — accumulate into the current paragraph.
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return <div className={className ?? 'space-y-4'}>{blocks}</div>;
}

/** Drop a leading H1 line (the doc's own title) when it's rendered separately. */
export function stripLeadingH1(source: string): string {
  return source.replace(/^\s*#\s+.*(?:\n+|$)/, '');
}
