import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CODE_GROUP_PATTERN = /::: code-group\s*\n([\s\S]*?)\n:::/g;
const CODE_BLOCK_PATTERN = /```([^\s\[]+)?(?:\s+\[([^\]]+)\])?\s*\n([\s\S]*?)```/g;

const MarkdownBlock = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      img: ({ node: _node, ...props }) => <img className="mx-auto object-cover" loading="lazy" {...props} />,
      a: ({ node: _node, ...props }) => <a {...props} rel="noreferrer" />,
    }}
  >
    {children}
  </ReactMarkdown>
);

const CodeGroup = ({ source }) => {
  const tabs = useMemo(() => {
    const result = [];
    let match;
    while ((match = CODE_BLOCK_PATTERN.exec(source)) !== null) {
      result.push({ language: match[1] || "text", label: match[2] || match[1] || "Code", code: match[3].replace(/\n$/, "") });
    }
    CODE_BLOCK_PATTERN.lastIndex = 0;
    return result;
  }, [source]);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!tabs.length) return <MarkdownBlock>{source}</MarkdownBlock>;
  const activeTab = tabs[Math.min(activeIndex, tabs.length - 1)];

  return (
    <section className="code-group" aria-label="代码示例">
      <div className="code-group-tabs" role="tablist" aria-label="切换代码语言">
        {tabs.map((tab, index) => (
          <button key={`${tab.language}-${tab.label}`} type="button" role="tab" aria-selected={index === activeIndex} className={index === activeIndex ? "is-active" : ""} onClick={() => setActiveIndex(index)}>
            {tab.label}
          </button>
        ))}
      </div>
      <pre role="tabpanel"><code className={`language-${activeTab.language}`}>{activeTab.code}</code></pre>
    </section>
  );
};

const MarkdownContent = ({ content }) => {
  const sections = useMemo(() => {
    const result = [];
    let cursor = 0;
    let match;
    CODE_GROUP_PATTERN.lastIndex = 0;
    while ((match = CODE_GROUP_PATTERN.exec(content || "")) !== null) {
      if (match.index > cursor) result.push({ type: "markdown", value: content.slice(cursor, match.index) });
      result.push({ type: "code-group", value: match[1] });
      cursor = match.index + match[0].length;
    }
    if (cursor < (content || "").length) result.push({ type: "markdown", value: content.slice(cursor) });
    return result.length ? result : [{ type: "markdown", value: content || "" }];
  }, [content]);

  return sections.map((section, index) => section.type === "code-group"
    ? <CodeGroup key={`group-${index}`} source={section.value} />
    : <MarkdownBlock key={`markdown-${index}`}>{section.value}</MarkdownBlock>);
};

export default MarkdownContent;
