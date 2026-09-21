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

## 管理员登录

采用 Supabase Auth（邮箱 + 密码）：密码由 Supabase 服务端校验并签发会话
（保存在 localStorage），前端只做 UI 门禁，写操作由数据库层 RLS 强制。

- 在 Supabase 控制台 Authentication → Users 手动创建唯一管理员账号（勾选
  Auto Confirm），并关闭 "Allow new users to sign up"，防止他人注册。
- 重置密码：控制台 Users 页对该用户执行 Send password reset / 直接改密码。
- RLS 策略见 `supabase/migrations/`，通过 Supabase CLI 应用（见下节）。

## 数据库迁移

Supabase CLI 作为 devDependency 安装。迁移 SQL 放在 `supabase/migrations/`，
用 `.env` 里的数据库密码推送到远端：

```bash
yarn supabase db push --db-url "postgresql://postgres.otwxeenalvhwgyeumqcy:$(grep '^SUPABASE_SECRET=' .env | cut -d= -f2)@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

已应用的迁移记录在远端的 `supabase_migrations.schema_migrations` 表里，
后续 schema 变更新增迁移文件后重跑同一命令即可。

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

三张表均已启用 RLS（策略见 `supabase/migrations/20260921000000_admin_auth_rls.sql`）：

- `posts`：匿名只读已发布文章；登录管理员可读写全部（含草稿）。
- `site_settings`：匿名只读；upsert 仅管理员。
- `reader_actions`：匿名可读写（读者的点赞 / 收藏，无需登录）。

管理员写权限由 `authenticated` 会话在数据库层强制，绕过前端门禁无法写入。

## 部署（GitHub Pages）

源码在 `master` 分支，构建产物推送到 `gh-pages` 分支并同步一份到 `master` 的 `docs/` 目录：

```bash
yarn build
rm -rf docs && cp -r build docs   # docs/ 随 master 提交
git push -f origin $(git subtree split --prefix=docs):gh-pages
```
