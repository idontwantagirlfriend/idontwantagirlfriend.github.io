import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

// ::: code-group 代码组与 ```info/```warning/```error/```success 横幅按出现顺序切分
const SECTION_PATTERN = /::: code-group\s*\n([\s\S]*?)\n:::|```(info|success|warning|error)[^\S\n]*\n([\s\S]*?)```/g;
const CODE_BLOCK_PATTERN = /```([^\s\[]+)?(?:\s+\[([^\]]+)\])?\s*\n([\s\S]*?)```/g;

const BANNERS = {
  info: { icon: Info, label: "提示" },
  success: { icon: CheckCircle, label: "成功" },
  warning: { icon: AlertTriangle, label: "注意" },
  error: { icon: XCircle, label: "错误" },
};

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

const Banner = ({ type, source }) => {
  const banner = BANNERS[type];
  const Icon = banner.icon;
  return (
    <aside className={`md-banner md-banner-${type}`} role="note" aria-label={banner.label}>
      <Icon className="md-banner-icon" aria-hidden="true" />
      <div className="md-banner-body"><MarkdownBlock>{source}</MarkdownBlock></div>
    </aside>
  );
};

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
    const source = content || "";
    const result = [];
    let cursor = 0;
    let match;
    SECTION_PATTERN.lastIndex = 0;
    while ((match = SECTION_PATTERN.exec(source)) !== null) {
      if (match.index > cursor) result.push({ type: "markdown", value: source.slice(cursor, match.index) });
      if (match[1] !== undefined) result.push({ type: "code-group", value: match[1] });
      else result.push({ type: "banner", banner: match[2], value: match[3].replace(/\n$/, "") });
      cursor = match.index + match[0].length;
    }
    if (cursor < source.length) result.push({ type: "markdown", value: source.slice(cursor) });
    return result.length ? result : [{ type: "markdown", value: source }];
  }, [content]);

  return sections.map((section, index) => {
    if (section.type === "code-group") return <CodeGroup key={`group-${index}`} source={section.value} />;
    if (section.type === "banner") return <Banner key={`banner-${index}`} type={section.banner} source={section.value} />;
    return <MarkdownBlock key={`markdown-${index}`}>{section.value}</MarkdownBlock>;
  });
};

export default MarkdownContent;
