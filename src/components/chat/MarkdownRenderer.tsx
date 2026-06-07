"use client";

import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Custom components for markdown rendering
const components: Partial<Components> = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-3 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
  ),

  // Paragraphs
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed wrap-break-word">{children}</p>,

  // Lists
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed wrap-break-word">{children}</li>,

  // Code blocks
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className;

    if (isInline) {
      return (
        <code
          className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code
        className={cn(
          "block bg-muted/50 p-3 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap wrap-break-word",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },

  // Pre for code blocks
  pre: ({ children }) => (
    <pre className="bg-muted/50 rounded-lg overflow-x-auto mb-2">{children}</pre>
  ),

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/50 pl-3 italic text-muted-foreground mb-2">
      {children}
    </blockquote>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline break-all"
    >
      {children}
    </a>
  ),

  // Strong/Bold
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,

  // Emphasis/Italic
  em: ({ children }) => <em className="italic">{children}</em>,

  // Horizontal rule
  hr: () => <hr className="my-4 border-border" />,

  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="min-w-full border border-border rounded-lg">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-sm">{children}</td>,
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Memoized markdown component for better performance during streaming
function MarkdownRendererBase({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none wrap-break-word overflow-hidden", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Memoize to prevent re-renders when content hasn't changed
export const MarkdownRenderer = memo(
  MarkdownRendererBase,
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

// Non-memoized version for when you need real-time updates (streaming)
export function StreamingMarkdown({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Helper to parse markdown blocks for memoization during streaming
export function useMarkdownBlocks(content: string) {
  return useMemo(() => {
    // Split by double newlines to get paragraphs/blocks
    const blocks = content.split(/\n\n+/);
    return blocks.map((block, index) => ({
      id: `block-${index}`,
      content: block,
      // Mark last block as potentially incomplete during streaming
      isComplete: index < blocks.length - 1,
    }));
  }, [content]);
}

// Memoized block component for efficient streaming rendering
const MemoizedBlock = memo(
  ({ content, isComplete }: { content: string; isComplete: boolean }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  ),
  (prevProps, nextProps) =>
    prevProps.content === nextProps.content &&
    prevProps.isComplete === nextProps.isComplete
);

// Streaming markdown with block-level memoization
export function MemoizedStreamingMarkdown({ content, className }: MarkdownRendererProps) {
  const blocks = useMarkdownBlocks(content);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {blocks.map((block) => (
        <MemoizedBlock
          key={block.id}
          content={block.content}
          isComplete={block.isComplete}
        />
      ))}
    </div>
  );
}
