# 余白手记

一个基于 React + Vite + Tailwind (shadcn/ui) 的个人博客，数据存储在 Supabase（Postgres）中。

## 技术栈

- **前端**: React 18 + Vite 5 + Tailwind CSS + shadcn/ui + TanStack Query + react-router (HashRouter)
- **后端**: Supabase（`posts` / `reader_actions` / `site_settings` 三张表，supabase-js v2）
- **部署**: 静态构建，产物输出到 `build/`

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

| 变量 | 说明 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon（publishable）key |
| `VITE_SHA256_PASSWORD` | `sha256("<用户名>:<密码>")`，后台登录凭据的摘要 |

管理员登录采用 SHA-256 摘要比对：打包产物中只包含摘要，不包含明文密码；
sessionStorage 中保存的是二次哈希的会话令牌。重置密码：

```bash
node scripts/hash-password.mjs <username> <password>
# 输出写入 .env 的 VITE_SHA256_PASSWORD，重新 yarn build
```

## 开发

```bash
yarn install
yarn dev        # http://localhost:8080
```

## 构建

```bash
yarn build      # 输出到 build/
yarn preview
```

## Supabase 数据结构

- `posts` — 文章（`slug`、`title`、`excerpt`、`content`、`tags[]`、`reading_time`、`is_featured`、`is_published`、`created_at`）
- `reader_actions` — 读者的点赞 / 收藏（`post_id`、`reader_id`、`action_type`）
- `site_settings` — 站点设置（`footer_markdown` 等，key/value）

三张表均已启用 RLS。当前应用为纯前端架构（后台由客户端 SHA-256 摘要门禁保护），
因此策略对所有匿名请求开放；如需收紧，建议将写操作迁移到 Edge Function 之后再调整策略。

## 部署（GitHub Pages）

源码在 `master` 分支，构建产物推送到 `gh-pages` 分支并同步一份到 `master` 的 `docs/` 目录：

```bash
yarn build
rm -rf docs && cp -r build docs   # docs/ 随 master 提交
git push -f origin $(git subtree split --prefix=docs):gh-pages
```
