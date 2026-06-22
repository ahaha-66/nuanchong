# 暖宠

面向老年宠、生病宠和术后宠物家庭的连续照护协作平台。当前仓库是可供本地演示和继续开发的 MVP 初版，包含微信小程序、医院 Web 工作台、NestJS API，以及基于 PostgreSQL RLS 的数据隔离。

## 当前能力

- 宠物档案与家庭照护成员
- 今日照护任务及任务完成记录
- 照护计划创建、发布和宠主确认
- 状态记录、AI 候选提取及确认后写入时间线
- 宠主对医院的数据授权和撤销
- 医院登录、授权患者列表与照护数据查看
- PostgreSQL RLS、审计基础能力和应急访问数据模型

当前版本适合本地演示，不代表已达到生产上线标准。真实微信登录、真实 AI/ASR、对象存储和完整端到端业务流程仍需在目标环境验收。

## 工程结构

- `apps/miniapp`：Taro 微信小程序，构建产物位于 `apps/miniapp/dist`。
- `apps/hospital-web`：React + Ant Design 医院工作台。
- `apps/api`：NestJS + Prisma API。
- `packages/contracts`：前后端共享 Zod 契约和错误码。
- `infra/compose.yml`：PostgreSQL、Redis、MinIO 本地依赖。

## 环境要求

- Node.js 22 或更高版本
- pnpm 10（仓库声明版本为 `10.34.4`）
- Docker 与 Docker Compose
- 运行微信小程序时需要微信开发者工具

## 本地启动

先创建本地环境文件。

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

然后在仓库根目录执行：

```bash
docker compose -f infra/compose.yml up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm dev` 会自动加载根目录 `.env`，并在启动 API 前构建共享契约包。数据库脚本使用两个连接：

- `MIGRATION_DATABASE_URL`：执行迁移和种子初始化，可绕过业务 RLS。
- `DATABASE_URL`：API 运行时连接，使用受 RLS 限制的 `nuanchong_app` 账号。

种子脚本可重复执行，不会重复创建同名演示医院、宠物及有效授权。

## 本地地址与账号

- 医院 Web：`http://localhost:5173`
- API：`http://localhost:3000/api`
- PostgreSQL：`localhost:5432`
- MinIO API：`http://localhost:9000`
- MinIO Console：`http://localhost:9001`

医院演示账号：

| 账号 | 角色 | 密码 |
| --- | --- | --- |
| `vet@hospital-a.example.com` | 医院甲兽医 | `WarmPet2026!` |
| `readonly@hospital-a.example.com` | 医院甲只读 | `WarmPet2026!` |
| `vet@hospital-b.example.com` | 医院乙兽医 | `WarmPet2026!` |

`pnpm db:seed` 会输出医院甲、医院乙、用户和宠物 ID。医院 Web 登录时需要填写对应的医院 ID。

小程序本地开发登录账号为 `owner.a@example.com`。微信开发者工具应导入 `apps/miniapp`；开发配置已关闭域名校验。生产环境必须改用已备案的 HTTPS API 地址。

## 数据隔离

每个业务请求在独立数据库事务中使用事务级 `set_config(..., true)` 写入用户、医院和应急访问上下文。运行时角色 `nuanchong_app` 无超级用户及 `BYPASSRLS` 权限。宠物数据必须满足有效家庭成员关系，或同时满足“医院成员 + 当前医院 + 有效授权范围”。

运行数据库隔离集成测试：

```bash
RUN_DATABASE_TESTS=true pnpm test:integration
```

PowerShell：

```powershell
$env:RUN_DATABASE_TESTS='true'
pnpm test:integration
```

该命令自动从根目录 `.env` 读取运行时和迁移数据库连接。迁移账号仅用于读取测试夹具，隔离断言使用运行时低权限账号执行。

## AI 配置

`.env.example` 默认设置 `AI_USE_FAKE=true`，可离线演示文本状态整理。真实验收时设置 `AI_USE_FAKE=false`，并配置 OpenAI-compatible 的聊天和 ASR 地址、模型及密钥。

AI 输出只会生成候选记录；用户确认后才会写入正式观察记录和时间线。AI 结果不得替代兽医诊断或紧急医疗建议。

## 验证命令

```bash
pnpm typecheck
pnpm test
RUN_DATABASE_TESTS=true pnpm test:integration
pnpm build
```

微信小程序开发模式下，Taro 可能提示依赖预编译失败并自动跳过；以随后出现的 `Compiled successfully` 为实际编译结果。

## 停止服务

按 `Ctrl+C` 停止开发进程，再关闭本地基础服务：

```bash
docker compose -f infra/compose.yml down
```
