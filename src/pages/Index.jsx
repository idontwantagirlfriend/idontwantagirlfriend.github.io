import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Heart,
  Loader2,
  LogOut,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownContent from "@/components/MarkdownContent";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_USERNAME = import.meta.env.VITE_BLOG_ADMIN_USERNAME || "";
const ADMIN_PASSWORD = import.meta.env.VITE_BLOG_ADMIN_PASSWORD || "";
const ADMIN_TOKEN = ADMIN_USERNAME && ADMIN_PASSWORD ? btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`) : "";
const DEFAULT_FOOTER_MARKDOWN = "## 浏览\n- [全部文章](/)\n- [随笔](/?tags=随笔)\n- [设计](/?tags=设计)\n- [阅读](/?tags=阅读)\n\n## 友情链接\n- [郑虎的站点](https://chenzhenghu.mynocode.host/)";

const parseFooterMarkdown = (markdown) => {
  const normalized = String(markdown || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n");
  const columns = [];
  let current = null;
  normalized.split("\n").forEach((line) => {
    const heading = line.trim().match(/^#{1,3}\s+(.+)$/);
    const link = line.trim().match(/^-\s+\[([^\]]+)\]\(([^)]+)\)$/);
    if (heading) {
      current = { title: heading[1].trim(), links: [] };
      columns.push(current);
    } else if (link && current) {
      current.links.push({ label: link[1].trim(), href: link[2].trim() });
    }
  });
  return columns.length ? columns : parseFooterMarkdown(DEFAULT_FOOTER_MARKDOWN);
};

const getReaderId = () => {
  const saved = window.localStorage.getItem("blog-reader-id");
  if (saved) return saved;
  const id = window.crypto?.randomUUID?.() || `reader-${Date.now()}-${Math.random()}`;
  window.localStorage.setItem("blog-reader-id", id);
  return id;
};

const formatDate = (value) => new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value)).replaceAll("/", ".");

const Index = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [readerId] = useState(getReaderId);
  const [theme, setTheme] = useState(() => {
    const saved = window.localStorage.getItem("blog-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [activeTag, setActiveTag] = useState(() => searchParams.get("tags") || searchParams.get("tag") || "全部");
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [authOpen, setAuthOpen] = useState(false);
  const [footerEditorOpen, setFooterEditorOpen] = useState(false);
  const [footerDraft, setFooterDraft] = useState(DEFAULT_FOOTER_MARKDOWN);
  const [isAdmin, setIsAdmin] = useState(() => Boolean(ADMIN_TOKEN) && window.sessionStorage.getItem("blog-basic-auth") === ADMIN_TOKEN);
  const [auth, setAuth] = useState({ username: "", password: "" });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("blog-theme", theme);
  }, [theme]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setActiveTag(searchParams.get("tags") || searchParams.get("tag") || "全部");
      setSearch(searchParams.get("q") || "");
    }
  }, [searchParams, slug]);

  const postsQuery = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("is_published", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["reader-actions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reader_actions").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const footerQuery = useQuery({
    queryKey: ["footer-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("setting_value").eq("setting_key", "footer_markdown").maybeSingle();
      if (error) throw error;
      return data?.setting_value || DEFAULT_FOOTER_MARKDOWN;
    },
  });

  useEffect(() => {
    if (footerQuery.data) setFooterDraft(footerQuery.data);
  }, [footerQuery.data]);

  const posts = postsQuery.data || [];
  const actions = actionsQuery.data || [];
  const featuredPost = posts.find((post) => post.is_featured) || posts[0];
  const articlePost = slug ? posts.find((post) => post.slug === slug) : null;

  const actionInfo = useMemo(() => posts.reduce((result, post) => {
    const postActions = actions.filter((action) => action.post_id === post.id);
    result[post.id] = {
      likes: postActions.filter((action) => action.action_type === "like").length,
      liked: postActions.some((action) => action.action_type === "like" && action.reader_id === readerId),
      bookmarked: postActions.some((action) => action.action_type === "bookmark" && action.reader_id === readerId),
    };
    return result;
  }, {}), [posts, actions, readerId]);

  const tags = useMemo(() => {
    const counts = posts.reduce((result, post) => {
      post.tags.forEach((tag) => { result[tag] = (result[tag] || 0) + 1; });
      return result;
    }, {});
    return [{ name: "全部", count: posts.length }, ...Object.entries(counts).map(([name, count]) => ({ name, count }))];
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesTag = activeTag === "全部" || (activeTag === "已收藏"
        ? actionInfo[post.id]?.bookmarked
        : post.tags.includes(activeTag));
      const matchesSearch = !term || `${post.title} ${post.excerpt} ${post.content} ${post.tags.join(" ")}`.toLowerCase().includes(term);
      return matchesTag && matchesSearch;
    });
  }, [posts, activeTag, search, actionInfo]);

  const toggleAction = useMutation({
    mutationFn: async ({ postId, type, active }) => {
      if (active) {
        const { error } = await supabase.from("reader_actions").delete().eq("post_id", postId).eq("reader_id", readerId).eq("action_type", type);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reader_actions").insert({ post_id: postId, reader_id: readerId, action_type: type });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reader-actions"] });
      toast.success(variables.type === "like" ? (variables.active ? "已取消点赞" : "谢谢你的喜欢") : (variables.active ? "已取消收藏" : "已加入收藏"));
    },
    onError: () => toast.error("操作没有保存", { description: "请检查网络后再试一次" }),
  });

  const saveFooter = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_settings").upsert({ setting_key: "footer_markdown", setting_value: footerDraft, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["footer-settings"] });
      setFooterEditorOpen(false);
      toast.success("页脚已更新");
    },
    onError: () => toast.error("页脚保存失败", { description: "内容已保留，请稍后重试" }),
  });

  const submitAuth = (event) => {
    event.preventDefault();
    if (!ADMIN_TOKEN) {
      toast.error("管理员账号尚未配置");
      return;
    }
    const token = btoa(`${auth.username}:${auth.password}`);
    if (token !== ADMIN_TOKEN) {
      toast.error("用户名或密码错误");
      return;
    }
    window.sessionStorage.setItem("blog-basic-auth", token);
    setIsAdmin(true);
    setAuthOpen(false);
    setAuth({ username: "", password: "" });
    toast.success("管理员身份已验证");
    navigate("/admin");
  };

  const logout = () => {
    window.sessionStorage.removeItem("blog-basic-auth");
    setIsAdmin(false);
    setFooterEditorOpen(false);
    toast.success("已退出管理模式");
  };

  const openEditor = () => {
    if (isAdmin) navigate("/admin");
    else setAuthOpen(true);
  };

  const openTag = (tag) => {
    setActiveTag(tag);
    setSearch("");
    navigate(`/?tags=${encodeURIComponent(tag)}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const renderPostTags = (post, className = "post-tags") => (
    <div className={className} aria-label="文章标签">
      {post.tags.map((tag) => {
        const count = tags.find((item) => item.name === tag)?.count || 0;
        return <button key={tag} type="button" onClick={() => openTag(tag)}>#{tag} ({count})</button>;
      })}
    </div>
  );

  const renderActionButtons = (post, compact = false) => {
    const state = actionInfo[post.id] || { likes: 0, liked: false, bookmarked: false };
    return (
      <div className={compact ? "reader-actions compact" : "reader-actions"}>
        <button
          type="button"
          className={state.liked ? "action-button is-active" : "action-button"}
          onClick={(event) => { event.stopPropagation(); toggleAction.mutate({ postId: post.id, type: "like", active: state.liked }); }}
          disabled={toggleAction.isPending}
          aria-label={state.liked ? "取消点赞" : "点赞"}
          aria-pressed={state.liked}
        >
          <Heart aria-hidden="true" /> <span>{state.likes}</span>
        </button>
        <button
          type="button"
          className={state.bookmarked ? "action-button is-active" : "action-button"}
          onClick={(event) => { event.stopPropagation(); toggleAction.mutate({ postId: post.id, type: "bookmark", active: state.bookmarked }); }}
          disabled={toggleAction.isPending}
          aria-label={state.bookmarked ? "取消收藏" : "收藏"}
          aria-pressed={state.bookmarked}
        >
          <Bookmark aria-hidden="true" /> <span>{state.bookmarked ? "已收藏" : "收藏"}</span>
        </button>
      </div>
    );
  };

  const updateSearch = (value) => {
    setSearch(value);
    if (slug) {
      const params = new URLSearchParams();
      if (activeTag !== "全部") params.set("tags", activeTag);
      if (value) params.set("q", value);
      navigate(`/${params.size ? `?${params.toString()}` : ""}`);
    }
  };

  const footerColumns = parseFooterMarkdown(footerQuery.data || DEFAULT_FOOTER_MARKDOWN);

  const siteHeader = (
    <header className="site-header">
      <nav className="nav-wrap" aria-label="主导航">
        <div className="nav-leading">
          <button className="wordmark wordmark-button" type="button" onClick={() => navigate("/")} aria-label="回到首页"><span className="wordmark-mark">Y</span><span>余白手记</span></button>
          <label className="nav-search">
            <Search aria-hidden="true" />
            <span className="sr-only">搜索文章</span>
            <input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="搜索手记" />
            {search && <button type="button" onClick={() => updateSearch("")} aria-label="清空搜索"><X aria-hidden="true" /></button>}
          </label>
        </div>
        <div className="nav-actions">
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "切换到 One Dark Pro 主题" : "切换到水彩主题"}>
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          {isAdmin ? (
            <>
              <button className="login-link" type="button" onClick={() => navigate("/admin")}>管理投稿</button>
              <button className="icon-link" type="button" onClick={logout} aria-label="退出管理模式"><LogOut aria-hidden="true" /></button>
            </>
          ) : <button className="login-link" type="button" onClick={() => setAuthOpen(true)}>登录</button>}
        </div>
      </nav>
    </header>
  );

  const siteFooter = (
    <footer className="site-footer">
      <div className="footer-wrap">
        <div className="footer-brand"><span className="wordmark-mark">Y</span><div><strong>余白手记</strong><p>写下设计、阅读与缓慢发生的日常。</p><p className="footer-copyright">© 2026 余白手记</p>{isAdmin && <button className="footer-edit" type="button" onClick={() => setFooterEditorOpen(true)}>编辑页脚</button>}</div></div>
        {footerColumns.map((column) => <div className="footer-column" key={column.title}><h2>{column.title}</h2><div className="footer-links">{column.links.map((link) => link.href.startsWith("http") ? <a key={`${link.label}-${link.href}`} href={link.href} target="_blank" rel="noreferrer">{link.label} <ArrowUpRight aria-hidden="true" /></a> : <button key={`${link.label}-${link.href}`} type="button" onClick={() => navigate(link.href.replace("?tag=", "?tags="))}>{link.label}</button>)}</div></div>)}
      </div>
    </footer>
  );

  const authModal = authOpen ? (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
      <section className="form-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" onClick={() => setAuthOpen(false)} aria-label="关闭登录"><X aria-hidden="true" /></button>
        <h2 id="auth-title">管理员登录</h2><p className="form-note">登录后即可进入投稿模式。</p>
        <form onSubmit={submitAuth}>
          <label>用户名<input autoFocus autoComplete="username" value={auth.username} onChange={(event) => setAuth({ ...auth, username: event.target.value })} required /></label>
          <label>密码<input type="password" autoComplete="current-password" value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })} required /></label>
          <button className="primary-action" type="submit">登录</button>
        </form>
      </section>
    </div>
  ) : null;

  const footerEditorModal = footerEditorOpen && isAdmin ? (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFooterEditorOpen(false)}>
      <section className="form-modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="footer-editor-title">
        <button className="modal-close" type="button" onClick={() => setFooterEditorOpen(false)} aria-label="关闭页脚设置"><X aria-hidden="true" /></button>
        <h2 id="footer-editor-title">编辑页脚</h2>
        <p className="form-note">使用 <code>## 栏目名</code> 创建栏目，下一行用 <code>- [项目名](链接)</code> 添加项目。</p>
        <form onSubmit={(event) => { event.preventDefault(); saveFooter.mutate(); }}>
          <label>页脚内容<textarea rows="13" value={footerDraft} onChange={(event) => setFooterDraft(event.target.value)} spellCheck="false" required /></label>
          <button className="primary-action" type="submit" disabled={saveFooter.isPending}>{saveFooter.isPending && <Loader2 className="spin animate-spin" aria-hidden="true" />}{saveFooter.isPending ? "保存中…" : "保存页脚"}</button>
        </form>
      </section>
    </div>
  ) : null;

  if (slug) {
    return (
      <div className="site-shell article-page-shell">
        {siteHeader}
        <main className="article-page-wrap">
          {postsQuery.isLoading ? (
            <div className="article-page-loading"><Skeleton className="h-4 w-40" /><Skeleton className="h-20 w-3/4" /><Skeleton className="h-32 w-full" /></div>
          ) : postsQuery.isError ? (
            <div className="state-panel"><p>文章暂时没有加载出来。</p><button type="button" onClick={() => postsQuery.refetch()}>重新加载</button></div>
          ) : !articlePost ? (
            <div className="state-panel"><p>这篇文章不存在或尚未发布。</p><button type="button" onClick={() => navigate("/")}>返回文章列表</button></div>
          ) : (
            <article className="article-page" aria-labelledby="article-title">
              <button className="back-link" type="button" onClick={() => navigate("/")}><ArrowLeft aria-hidden="true" /> 返回文章列表</button>
              <header className="article-page-header">
                <p className="eyebrow">{formatDate(articlePost.created_at)} · {articlePost.reading_time}</p>
                <h1 id="article-title">{articlePost.title}</h1>
                <p className="article-lead">{articlePost.excerpt}</p>
                <div className="article-header-meta">{renderPostTags(articlePost)}{renderActionButtons(articlePost)}</div>
              </header>
              <div className="article-body markdown-body"><MarkdownContent content={articlePost.content} /></div>
              <footer className="article-bottom"><span>感谢阅读</span>{renderActionButtons(articlePost)}</footer>
            </article>
          )}
        </main>
        {siteFooter}
        {authModal}
        {footerEditorModal}
      </div>
    );
  }

  return (
    <div className="site-shell">
      {siteHeader}

      <main id="top" className="content-wrap">
        {postsQuery.isLoading ? (
          <section className="intro intro-skeleton" aria-label="正在加载置顶文章"><Skeleton className="h-4 w-40" /><Skeleton className="h-20 w-3/5" /><Skeleton className="h-24 w-full" /></section>
        ) : featuredPost ? (
          <article className="intro featured-post" aria-labelledby="page-title">
            <p className="eyebrow">FEATURED · {formatDate(featuredPost.created_at)}</p>
            <h1 id="page-title">{featuredPost.title}</h1>
            <div className="featured-side">
              <p className="intro-copy">{featuredPost.excerpt}</p>
              <button className="read-featured" type="button" onClick={() => navigate(`/post/${featuredPost.slug}`)}>阅读全文 <ArrowUpRight aria-hidden="true" /></button>
              {renderActionButtons(featuredPost, true)}
            </div>
          </article>
        ) : null}

        <section className="archive" aria-label="文章列表">
          <div className="tag-toolbar">
            <div className="tag-list" aria-label="按标签筛选文章">
              {[...tags, { name: "已收藏", count: actions.filter((action) => action.reader_id === readerId && action.action_type === "bookmark").length }].map((tag) => (
                <button key={tag.name} type="button" className={activeTag === tag.name ? "tag-button is-active" : "tag-button"} onClick={() => openTag(tag.name)} aria-pressed={activeTag === tag.name}>
                  {tag.name} <span>({tag.count})</span>
                </button>
              ))}
            </div>
            <span className="post-total">{visiblePosts.length.toString().padStart(2, "0")} POSTS</span>
          </div>

          {postsQuery.isLoading || actionsQuery.isLoading ? (
            <div className="post-list loading-list">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" />)}</div>
          ) : postsQuery.isError || actionsQuery.isError ? (
            <div className="state-panel"><p>文章暂时没有加载出来。</p><button type="button" onClick={() => { postsQuery.refetch(); actionsQuery.refetch(); }}>重新加载</button></div>
          ) : visiblePosts.length === 0 ? (
            <div className="state-panel"><p>没有找到符合条件的文章。</p><button type="button" onClick={() => { setSearch(""); setActiveTag("全部"); }}>查看全部文章</button></div>
          ) : (
            <div className="post-list" aria-live="polite">
              {visiblePosts.map((post) => (
                <article className="post-row" key={post.id}>
                  <div className="post-meta"><time dateTime={post.created_at}>{formatDate(post.created_at)}</time><span>{post.reading_time}</span></div>
                  <div className="post-main">
                    <button className="post-link" type="button" onClick={() => navigate(`/post/${post.slug}`)}>
                      <div className="post-copy"><h3>{post.title}</h3><p>{post.excerpt}</p></div>
                      <ArrowUpRight className="post-arrow" aria-hidden="true" />
                    </button>
                    <div className="post-row-footer">{renderPostTags(post)}{renderActionButtons(post)}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {siteFooter}
      {authModal}
      {footerEditorModal}
    </div>
  );
};

export default Index;
