# dsh-self-improved → dsh 0.2.0-rc.2 适配交接笔记

> 状态：**已移植完成（0.2.0）**。2026-10-22 完成 0.1.0-rc.6 → 0.2.0-rc.2 的全部适配并构建通过。
> 本文档保留原始断点分析，并在文末补充实际采用的方案与偏差记录。

## 已确认健在的 API（0.1.x → 0.2.0 无变化，逐项对照宿主 d.ts 复核过）

- `defineTool`（@deepseek-ai/dsh-tools）+ `ctx.tools.register`
- `createUserMessage`、`BlockAssembler`、`ctx.llm.stream(options)`（system/maxTokens/signal/sessionId/provider/model）
- `resolveDshHome`（@deepseek-ai/dsh-home-paths）
- 插件形态 `export const name / inject / Config / apply`（严禁 default export）
- 事件 `session/flush`（payload 仍是 Session）、`agent/pre-step`（payload `{agent,messages,turn,step,signal}`）
- `ctx.get("agentDefaultModel").currentSelection()`、`sessionQuery.searchSessions`、`commands.register`
- client 侧 `__ModuleLoader__.load` 形态、`slots.inject("settings.section")`、`locale`

## 断点 1：settingsNamespace 被移除 → 实际方案

- 0.2.0：设置页由**插件导出的 Config schema 自动生成**，命名空间 = profile 条目 id
  （`SettingsForms.describe/update/replace/mutate`）。
- **主配置热开关**：没有像原笔记设想的"放弃热改"——采用 volatile 方案（见下）。
- **记忆浏览器数据通道**：改挂 **webServer HTTP 端点**（原笔记提的 Remote/connection 方案之二）：
  - `GET  /api/dsh-self-improved/browser` → `browserSnapshot(store)` JSON
  - `POST /api/dsh-self-improved/action` → `{op: detail|forget|correct|deleteSkill}`，detail 随响应返回
  - 经 `ctx.inject(["webServer"], …)` 可选挂载（headless 安全跳过）；
    访问栅栏对齐 dsh-usage：loopback 放行 + 可选 remoteWebUiPairing 配对放行。

### volatile 热应用（settings/updated 的替代）

- Config schema 除 `storageRoot` 外全部 `.volatile()`（子树级：modules/extract/recall/… 整对象标记，
  `equalExceptVolatile` 与 `volatileEntries` 对 object schema 的 meta.volatile 均生效，已读 loader 实现确认）。
- `apply(ctx, rawConfig)` 入口 `resolveConfig()` 解引用（`{get()}` → 值）；
  `ctx.on("loader/volatile-update")` → 重解析 → 原地更新 `state/extractSettings/recallSettings`
  （三个服务均调用时读字段）；embedding 端点变化才重建 extractor/consolidator/recall 实例。
- 已知小限制：`searchLimit` 热改在下次工具注册时才生效（工具注册时捕获数值）。

## 断点 2：peerDependencies 版本范围 → 实际方案

- 宽范围（用户确认）：`"@deepseek-ai/dsh-*": ">=0.1.5-rc.2 <0.3.0"`、`cordis: ">=4.0.2 <0.3.0"` 不适用——
  实际写的是 `"@deepseek-ai/cordis": ">=4.0.2 <5.0.0"`、schemastery `>=3.18.1 <4.0.0`。
- 补充（原笔记没写）：
  - `dsh.engines.dsh: ">=0.2.0-rc.2"`（0.2.0 安装器检查）
  - `dsh.client.inject`: client 需要的宿主 client 包列表（locale/slots/configForms 提供包）
  - **devDependencies 钉 `0.2.0-rc.2` 精确版本**：peer 宽范围会被 npm 解析到最低版（0.1.5-rc.3），
    类型检查会失真；devDeps 优先级高于自动 peer，保证 tsc 对着宿主真实版本校验。

## 原笔记没预料到的差异（实际踩到）

1. **`Session.events` 字段移除** → `snapshotEvents(fromSeq?, toSeqExclusive?)`（半开区间、含 fromSeq；
   已标 deprecated 但官方注明"存量可用"）。capture.ts 用 `SessionLogOffset(floor+1)` 替代 `session.events` 过滤。
2. **MessageSource 改为 merge-extensible sum type**：公共 `"plugin"` kind 没了，每个生产者在自己的模块
   `declare module '@deepseek-ai/dsh-llm'` 里声明自有 kind（参考 dsh-skill 的 `skill-invocation`）。
   - inject.ts 声明 `"memory-recall": { kind: "memory-recall"; form: "recall" }`（语义对齐 ContextForm recall）；
     `lastUserText()` 跳过该 kind。
   - index.ts 一次性合成 LLM 调用改用 `source: { kind: "user" }`。
3. **client 端 `settingsScope` 服务移除** → `configForms`：
   - `ctx.configForms.get(entryId)` → form：`getSnapshot()`（`{status,value,base,user,revision,writable}`）、
     `subscribe`、`mutate(ops, expectedRevision) → Promise<boolean>`（失败自动 recover，**不抛错**）。
   - client.js 用 describe() 镜像解析候选 entry id（仿 dsh-usage createServedEntryForm，简化版）。
4. **`GenerateOptions.purpose` 类型收窄**为 `'compaction' | 'session-title'`；自定义 purpose 走 any 传递，
   运行时宽容（adapter 仅 map 已知 purpose），保留。
5. **设置页重复问题**：宿主会按 Config schema 自动生成设置页，与本插件 client.js 自定义 UI 重复。
   按用户决定：`settings.configure({ auto: false })` 抑制自动页，保留自定义 UI。
   ⚠️ 坑：`configure(presentation, owner)` 的 owner **必须显式传调用方插件自己的 `ctx.fiber`**——
   缺省值是 SettingsForms 服务所有者的 fiber（宿主根），policy 永远匹配不到任何条目（autoGenerate 不生效）。
6. **热加载后设置页 unavailable**：client 的 configForms describe 镜像只在收到
   `settings/document-updated` 或 `connection/reset` 时刷新；bundle 热加载时若无人调用 describe
   则不广播，安装前就打开的页面会一直 unavailable。刷新页面即可恢复（宿主侧其实一直在正常服务）。
7. **非 loopback 页面 configForms 整体不可用（最终根因，代码级确认）**：`dsh-client-ui-settings`
   按 `ctx.remote.$host.isLoopback` 选择持久化模式——非 loopback 主机名（Tailscale IP/域名）→
   `persistence="memory"` → describe 镜像 `load()` 直接 return（永不加载），所有 configForms
   表单构造即 `unavailable`。这是宿主故意的设计（非 loopback 页面禁走官方设置表单通道）。
   **解法**：设置 UI 改走插件自有 HTTP 通道（`GET/POST /api/dsh-self-improved/config`，
   宿主侧经 SettingsForms.describe/mutate 读写，同记忆浏览器的 loopback/配对栅栏）；
   Tailscale 访问经 socat 转发到宿主 loopback，栅栏自然通过。临时代偿：用
   `http://127.0.0.1:3080` 打开 GUI。

## 参考实现（兼容 0.2.0 的现成范本，本次实际比对过）

- `@linxin666/dsh-usage@0.4.6`：volatile + `loader/volatile-update` 热应用、webServer exact 路由 +
  前端相对路径 fetch、configForms 绑定、loopback/pairing 访问栅栏、`dsh.engines.dsh` + `dsh.client.inject`
  manifest 写法——本插件 volatile/HTTP/configForms 三块均以它为范本。
- 官方 `dsh-client-ui-settings`：ConfigFormController 的快照/订阅/mutate 契约。
- 官方 `dsh-skill`：自有 MessageSource kind 的模块增强写法。

## 构建与安装

```shell
npm install          # devDeps 钉 0.2.0-rc.2（cordis 4.0.5——4.0.4 与 cordis-plugin-include 的 ~4.0.5 peer 冲突）
npm run build        # tsc 对着宿主真实版本校验，0 错误
dsh plugin --profile web add /vol2/1000/Works/github/dsh-self-improved
```

注意：安装写入 `~/.dsh/profiles/web/`，在本会话沙箱外，需提权执行。
