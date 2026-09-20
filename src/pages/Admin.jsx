import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Loader2, Plus, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminAuth } from "@/lib/admin-auth";

const EMPTY_DRAFT = { title: "", excerpt: "", content: "", tags: "", readingTime: "5 分钟", featured: false };

const Admin = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isNew = id === "new";
  const isEditor = Boolean(id);
  const [authed, setAuthed] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let active = true;
    adminAuth.ready.then(() => {
      if (!active) return;
      if (!adminAuth.isLoggedIn()) navigate("/", { replace: true });
      else setAuthed(true);
    });
    // If the session dies while sitting on /admin (sign-out in another tab,
    // refresh token expired), leave the admin page immediately.
    const unsubscribe = adminAuth.subscribe(() => {
      if (active && !adminAuth.isLoggedIn()) navigate("/", { replace: true });
    });
    return () => { active = false; unsubscribe(); };
  }, [navigate]);

  const postsQuery = useQuery({
    queryKey: ["admin-posts"],
    enabled: authed,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const editingPost = !isNew ? postsQuery.data?.find((post) => String(post.id) === id) : null;

  useEffect(() => {
    if (editingPost) {
      setDraft({
        title: editingPost.title,
        excerpt: editingPost.excerpt,
        content: editingPost.content,
        tags: editingPost.tags.join(", "),
        readingTime: editingPost.reading_time,
        featured: editingPost.is_featured,
      });
    } else if (isNew) setDraft(EMPTY_DRAFT);
  }, [editingPost, isNew]);

  const savePost = useMutation({
    mutationFn: async () => {
      const payload = {
        title: draft.title.trim(),
        excerpt: draft.excerpt.trim(),
        content: draft.content.trim(),
        tags: draft.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        reading_time: draft.readingTime.trim() || "5 分钟",
        is_featured: draft.featured,
      };
      if (draft.featured) {
        const { error: resetError } = await supabase.from("posts").update({ is_featured: false }).eq("is_featured", true);
        if (resetError) throw resetError;
      }
      if (isNew) {
        const { error } = await supabase.from("posts").insert({ ...payload, slug: `${Date.now()}-${draft.title.trim().slice(0, 12)}` });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").update(payload).eq("id", Number(id));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      toast.success(isNew ? "文章已发布" : "文章已更新");
      navigate("/admin");
    },
    onError: () => toast.error("保存失败", { description: "内容已保留，请稍后重试" }),
  });

  const deletePost = useMutation({
    mutationFn: async (post) => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      setDeleteTarget(null);
      toast.success("文章已删除");
    },
    onError: () => toast.error("删除失败", { description: "请稍后重试" }),
  });

  const submit = (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.excerpt.trim() || !draft.tags.trim() || !draft.content.trim()) {
      toast.error("请填写标题、预览文本、标签与正文");
      return;
    }
    savePost.mutate();
  };

  if (!authed) return null;

  return (
    <div className="site-shell admin-shell">
      <header className="site-header"><nav className="nav-wrap admin-nav" aria-label="后台导航"><button className="wordmark wordmark-button" type="button" onClick={() => navigate("/")}><span className="wordmark-mark">Y</span><span>余白手记</span></button><span>内容管理</span><button className="back-link" type="button" onClick={() => navigate("/")}><ArrowLeft aria-hidden="true" /> 返回博客</button></nav></header>
      <main className="admin-page-wrap">
        {isEditor ? (
          <section className="admin-editor" aria-labelledby="editor-title">
            <div className="admin-page-heading"><div><p className="eyebrow">{isNew ? "NEW POST" : "EDIT POST"}</p><h1 id="editor-title">{isNew ? "添加投稿" : "编辑投稿"}</h1></div><button className="secondary-action" type="button" onClick={() => navigate("/admin")}><X aria-hidden="true" /> 取消</button></div>
            {!isNew && postsQuery.isLoading ? <p className="admin-status">正在读取文章…</p> : !isNew && !editingPost ? <div className="state-panel"><p>没有找到这篇文章。</p><button type="button" onClick={() => navigate("/admin")}>返回投稿管理</button></div> : (
              <form className="admin-form" onSubmit={submit}>
                <label>标题<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="文章标题" required /></label>
                <label>预览文本<textarea rows="3" value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} placeholder="展示在文章列表中的简短介绍" required /></label>
                <div className="form-grid"><label>标签<input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="随笔, 创作" required /></label><label>阅读时间<input value={draft.readingTime} onChange={(event) => setDraft({ ...draft, readingTime: event.target.value })} /></label></div>
                <label>正文（Markdown）<textarea className="markdown-editor" rows="22" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="支持标准 Markdown 与 ::: code-group 代码组语法" spellCheck="false" required /></label>
                <label className="check-field"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /> 使用置顶展示样式</label>
                <div className="admin-form-actions"><button className="secondary-action" type="button" onClick={() => navigate("/admin")}>取消</button><button className="primary-action" type="submit" disabled={savePost.isPending}>{savePost.isPending && <Loader2 className="spin animate-spin" aria-hidden="true" />}{savePost.isPending ? "保存中…" : isNew ? "发布文章" : "保存修改"}</button></div>
              </form>
            )}
          </section>
        ) : (
          <section className="admin-list" aria-labelledby="admin-title">
            <div className="admin-page-heading"><div><p className="eyebrow">CMS</p><h1 id="admin-title">投稿管理</h1></div><button className="primary-action" type="button" onClick={() => navigate("/admin/new")}><Plus aria-hidden="true" /> 添加投稿</button></div>
            {postsQuery.isLoading ? <p className="admin-status">正在读取文章…</p> : postsQuery.isError ? <div className="state-panel"><p>投稿列表加载失败。</p><button type="button" onClick={() => postsQuery.refetch()}>重新加载</button></div> : (
              <div className="admin-post-list">{postsQuery.data.map((post) => <article className="admin-post-row" key={post.id}><div><div className="admin-post-meta"><time>{new Intl.DateTimeFormat("zh-CN").format(new Date(post.created_at))}</time>{post.is_featured && <span>置顶</span>}</div><h2>{post.title}</h2><p>{post.excerpt}</p></div><div className="admin-row-actions"><button type="button" onClick={() => navigate(`/admin/${post.id}`)}><Edit3 aria-hidden="true" /> 编辑</button><button className="danger-action" type="button" onClick={() => setDeleteTarget(post)}><Trash2 aria-hidden="true" /> 删除</button></div></article>)}</div>
            )}
          </section>
        )}
      </main>
      {deleteTarget && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeleteTarget(null)}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">删除这篇文章？</h2><p>“{deleteTarget.title}”删除后无法恢复。</p><div><button className="secondary-action" type="button" onClick={() => setDeleteTarget(null)}>取消</button><button className="danger-confirm" type="button" disabled={deletePost.isPending} onClick={() => deletePost.mutate(deleteTarget)}>{deletePost.isPending ? "删除中…" : "确认删除"}</button></div></section></div>}
    </div>
  );
};

export default Admin;
