import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createMarkdownComponents } from '../../utils/markdownConfig';

interface MarkdownContentProps {
  content: string;
  messageType: 'user' | 'assistant';
  t: (key: string, params?: Record<string, string | number>) => string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, messageType, t }) => {
  const needsHighlight = /```|~~~/.test(content);
  const [highlightPlugin, setHighlightPlugin] = React.useState<any | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!needsHighlight) {
      setHighlightPlugin(null);
      return () => {
        cancelled = true;
      };
    }

    import('rehype-highlight').then((mod) => {
      if (!cancelled) {
        setHighlightPlugin(() => mod.default);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [needsHighlight]);

  const rehypePlugins = React.useMemo(() => {
    return highlightPlugin ? [highlightPlugin] : [];
  }, [highlightPlugin]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={rehypePlugins}
      components={createMarkdownComponents(messageType, t)}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownContent;
