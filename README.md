# 暖宠

面向老年宠、生病宠和术后宠物家庭的连续照护协作平台。仓库包含微信小程序、医院 Web 工作台、NestJS API，以及 PostgreSQL RLS 隔离策略。

## 工程结构

- `apps/miniapp`：Taro 微信小程序，构建产物位于 `apps/miniapp/dist`。
- `apps/hospital-web`：React + Ant Design 医院工作台。
- `apps/api`：NestJS + Prisma API。
- `packages/contracts`：前后端共享 Zod 契约和错误码。
- `infra/compose.yml`：PostgreSQL、Redis、MinIO 本地依赖。

## 本地启动

```powershell
Copy-Item .env.example .env
docker compose -f infra/compose.yml up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

医院种子账号密码为 `WarmPet2026!`。`pnpm db:seed` 会输出医院甲 ID；医院登录时需要填写该 ID。小程序开发账号使用 `owner.a@example.com`。

医院 Web 默认运行在 `http://localhost:5173`，API 默认运行在 `http://localhost:3000/api`。微信开发者工具应导入 `apps/miniapp`，开发阶段已关闭域名校验；生产环境必须将 API 地址改为已备案 HTTPS 域名。

## 隔离模型

每个业务请求在单独数据库事务中使用 `set_config(..., true)` 写入用户、医院和应急访问上下文。运行时角色 `nuanchong_app` 无超级用户及 `BYPASSRLS` 权限。宠物内容必须满足有效家庭成员关系，或“医院成员 + 当前医院 + 有效授权范围”三项条件。

```powershell
$env:RUN_DATABASE_TESTS='true'
$env:DATABASE_URL='postgresql://nuanchong_app:nuanchong_app@localhost:5432/nuanchong'
pnpm test:integration
```

## AI 配置

默认 `.env.example` 使用 Fake Provider，便于离线开发。真实验收时设置 `AI_USE_FAKE=false`，并配置 OpenAI-compatible 的聊天和 ASR 地址、模型及密钥。AI 结果只生成候选记录，用户确认后才进入正式观察记录和时间线。

## 验证命令

```powershell
pnpm typecheck
pnpm test
pnpm build
```

