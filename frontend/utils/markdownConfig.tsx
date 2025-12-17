import { Copy } from 'lucide-react';

/**
 * Markdown 渲染组件配置
 * 用于 ReactMarkdown 的 components prop
 */
export const createMarkdownComponents = (messageType: 'user' | 'assistant', t: (key: string) => string) => ({
  code({ node: _node, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    const inline = !className;

    return !inline ? (
      <div className="my-3 bg-gray-900 rounded-md overflow-hidden">
        <div className="px-3 py-1 bg-gray-800 text-xs text-gray-400 flex justify-between items-center">
          <span>{match ? match[1] : t('chat.code')}</span>
          <Copy
            size={12}
            className="cursor-pointer hover:text-white"
            onClick={() => navigator.clipboard.writeText(codeContent)}
          />
        </div>
        <pre className="p-3 overflow-x-auto text-xs font-mono">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    ) : (
      <code 
        className={`${className} px-1.5 py-0.5 rounded ${messageType === 'user' ? 'bg-blue-700' : 'bg-gray-100'}`} 
        {...props}
      >
        {children}
      </code>
    );
  },
  
  p({ children }: any) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  
  ul({ children }: any) {
    return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
  },
  
  ol({ children }: any) {
    return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
  },
  
  li({ children }: any) {
    return <li className="ml-2">{children}</li>;
  },
  
  blockquote({ children }: any) {
    return (
      <blockquote 
        className={`border-l-4 pl-4 my-2 italic ${messageType === 'user' ? 'border-blue-400' : 'border-gray-300'}`}
      >
        {children}
      </blockquote>
    );
  },
  
  h1({ children }: any) {
    return <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>;
  },
  
  h2({ children }: any) {
    return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
  },
  
  h3({ children }: any) {
    return <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>;
  },
  
  a({ href, children }: any) {
    return (
      <a 
        href={href} 
        className={`underline ${messageType === 'user' ? 'text-blue-200' : 'text-blue-600'} hover:opacity-80`} 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  
  table({ children }: any) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse border border-gray-300">{children}</table>
      </div>
    );
  },
  
  thead({ children }: any) {
    return <thead className="bg-gray-100">{children}</thead>;
  },
  
  th({ children }: any) {
    return <th className="border border-gray-300 px-3 py-2 text-left font-semibold">{children}</th>;
  },
  
  td({ children }: any) {
    return <td className="border border-gray-300 px-3 py-2">{children}</td>;
  },
});
