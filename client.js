/**
 * dsh-self-improved — browser half.
 *
 * A "自进化记忆" section inside the Web UI settings page. 0.2.0 model:
 * - Config tab reads/writes the profile entry's config through the plugin's own
 *   HTTP endpoints (GET/POST `api/dsh-self-improved/config` → host-side
 *   SettingsForms). The official configForms forms are hard-unavailable on
 *   non-loopback pages (memory persistence mode), so the plugin ships its own
 *   loopback/pairing-fenced transport; volatile fields hot-apply server-side
 *   via `loader/volatile-update` — no restart needed.
 * - Memory tab talks to the plugin's own HTTP endpoints registered on the
 *   host webServer (`/api/dsh-self-improved/*`) — no session context required.
 *
 * Style aligned with the DSH settings UI (14px base, 34px controls, 12px
 * radius, theme tokens); a "?" help toggle provides a detailed plugin guide.
 *
 * Hand-written ModuleLoader bundle — no build step required.
 * Pattern reference: dsh-usage / dsh-client-ui-settings (0.2.0).
 */
window.__ModuleLoader__.load({
  id: "dsh-self-improved",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    // ── CSS (DSH theme tokens + system sizes) ─────────────────────────────
    var CSS =
      ".__dsi_root{max-width:720px;display:flex;flex-direction:column;gap:10px}" +
      ".__dsi_header{display:flex;align-items:center;gap:8px;margin-bottom:2px}" +
      ".__dsi_intro{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);margin:0}" +
      ".__dsi_helpBtn{flex:none;width:24px;height:24px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}" +
      ".__dsi_helpBtn:hover{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}" +
      ".__dsi_help{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}" +
      ".__dsi_help h4{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}" +
      ".__dsi_help p{margin:0;font-size:13px;line-height:21px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}" +
      ".__dsi_group{font-size:14px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary);border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:4px;margin:10px 0 4px}" +
      ".__dsi_field{display:flex;flex-direction:column;gap:4px}" +
      ".__dsi_label{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}" +
      ".__dsi_override{font-size:11px;color:var(--dsw-alias-state-business-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 4px}" +
      ".__dsi_hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}" +
      ".__dsi_input{box-sizing:border-box;width:100%;height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:12px;padding:6px 12px;font-family:inherit;font-size:14px;line-height:22px}" +
      ".__dsi_input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}" +
      ".__dsi_row{display:flex;align-items:center;gap:8px}" +
      ".__dsi_check{accent-color:var(--dsw-alias-state-business-primary);width:16px;height:16px}" +
      ".__dsi_actions{display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap}" +
      ".__dsi_btn{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:12px;padding:6px 14px;font:inherit;font-size:14px;line-height:22px;cursor:pointer}" +
      ".__dsi_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}" +
      ".__dsi_btn:disabled{opacity:.5;cursor:default}" +
      ".__dsi_btnPrimary{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-on-accent)}" +
      ".__dsi_status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}" +
      ".__dsi_ok{font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary)}" +
      ".__dsi_error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}" +
      ".__dsi_unavailable{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}" +
      ".__dsi_browserRow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:8px 10px;background:var(--dsw-alias-bg-layer-2)}" +
      ".__dsi_browserMain{display:flex;flex-direction:column;gap:2px;min-width:0}" +
      ".__dsi_browserKind{font-size:11px;font-weight:600;color:var(--dsw-alias-state-business-primary)}" +
      ".__dsi_browserContent{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);word-break:break-all}" +
      ".__dsi_browserMeta{font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".__dsi_browserOps{flex:none;display:flex;gap:6px}" +
      ".__dsi_tabs{display:flex;flex-direction:column;gap:10px}" +
      ".__dsi_tabBar{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:8px}" +
      ".__dsi_tab{height:32px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;padding:0 14px;font:inherit;font-size:14px;line-height:32px;cursor:pointer}" +
      ".__dsi_tab:hover{color:var(--dsw-alias-label-primary)}" +
      ".__dsi_tabActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border-color:var(--dsw-alias-border-l2)}" +
      // 滑动开关
      ".__dsi_switch{position:relative;display:inline-block;width:36px;height:20px;flex:none}" +
      ".__dsi_switch input{opacity:0;width:0;height:0;position:absolute}" +
      ".__dsi_switchTrack{position:absolute;inset:0;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;transition:background .15s,border-color .15s}" +
      ".__dsi_switch input:checked + .__dsi_switchTrack{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}" +
      ".__dsi_switchThumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .15s,background .15s}" +
      ".__dsi_switch input:checked ~ .__dsi_switchThumb{transform:translateX(16px);background:var(--dsw-alias-label-on-accent)}" +
      // 折叠面板
      ".__dsi_collapse{display:flex;flex-direction:column;gap:8px}" +
      ".__dsi_collapseHeader{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:8px 12px;background:var(--dsw-alias-bg-layer-2)}" +
      ".__dsi_collapseHeader:hover{border-color:var(--dsw-alias-state-business-primary)}" +
      ".__dsi_collapseTitle{flex:1;font-size:14px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}" +
      ".__dsi_collapseCount{font-size:12px;color:var(--dsw-alias-label-tertiary)}" +
      ".__dsi_collapseChevron{font-size:12px;color:var(--dsw-alias-label-tertiary);transition:transform .15s}" +
      ".__dsi_collapseOpen .__dsi_collapseChevron{transform:rotate(90deg)}" +
      ".__dsi_collapseBody{padding:2px 4px;display:flex;flex-direction:column;gap:8px}" +
      ".__dsi_persona{white-space:pre-wrap;font-size:13px;line-height:21px;color:var(--dsw-alias-label-secondary);max-height:260px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2)}" +
      // 详情弹出框
      ".__dsi_modalBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px}" +
      ".__dsi_modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;max-width:640px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.25)}" +
      ".__dsi_modalHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l2)}" +
      ".__dsi_modalTitle{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
      ".__dsi_modalBody{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}" +
      ".__dsi_modalContent{white-space:pre-wrap;word-break:break-all;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;background:var(--dsw-alias-bg-layer-2)}" +
      ".__dsi_modalMeta{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}" +
      ".__dsi_modalMeta b{font-weight:600;color:var(--dsw-alias-label-primary)}";
    var tagId = "dsh-self-improved/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-self-improved";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── locale ────────────────────────────────────────────────────────────
    var NS = "selfImproved";
    var inject = ["slots", "locale"];
    var zh = {
      nav: "自进化记忆",
      tabConfig: "配置",
      tabMemories: "记忆",
      intro: "长期记忆与自进化插件：自动捕获对话、提炼记忆、回合前召回注入，并随时间巩固、遗忘与进化。",
      helpTitle: "插件说明",
      help: [
        "dsh-self-improved 为 DSH 补充跨会话的长期记忆与自进化能力，所有数据默认保存在本地（$DSH_HOME/memory），不上传。",
        "",
        "【工作流程】",
        "L0 对话捕获：每个会话结束时自动把对话写入本地切片，供提取管线使用。",
        "L1 记忆提取：后台用大模型从对话中提炼「原子记忆」（事实 / 偏好 / 事件 / 指令），带 JSON 校验、去重与敏感信息过滤。",
        "L2 场景归纳 / L3 用户画像：定期把记忆归纳为场景块，并增量合成用户画像（版本化，可回滚）。",
        "自动召回注入：新回合开始前，按当前问题检索相关记忆，以「【相关记忆】」块注入给模型——AI 从此记得你。",
        "自进化：记忆按「重要度 × 新鲜度 × 被引用次数」衰减遗忘；用户可纠正记忆；成功经验可提炼为可复用技能写入 dsh-skill。",
        "调度：每 15 分钟只做「提取 + 免费维护（衰减/清理）」，不耗模型；每天固定时刻（默认 22:00，可改）做一次完整回顾（排空提取 + 场景/画像 + 技能合成 + 治理）；启动后约 60 秒也会补跑一次；也可用 /memory evolve 手动触发。",
        "",
        "【模块开关】",
        "• 记录对话：捕获 L0（关闭后不再产生新记忆素材）",
        "• 提炼记忆：L1 提取（关闭后召回仍可用旧记忆）",
        "• 归纳场景/画像：L2/L3（关闭后画像不更新）",
        "• 自进化：衰减/技能合成（关闭后记忆只增不减）",
        "• 自动召回注入：回合前注入（关闭后仍可用工具主动搜索）",
        "• 记忆工具：memory_search / memory_correct / memory_forget 等模型可见工具",
        "",
        "【怎么用】",
        "• 聊天输入框敲「/」打开命令菜单：/memory status、/memory list、/memory search <词>、/memory forget <id>、/memory correct <id> <新内容>",
        "• 模型会自动使用记忆工具（memory_search 等），无需手动操作",
        "• 本页修改保存后立即生效，无需重启",
        "",
        "【模型与隐私】",
        "• 提取/画像/技能默认使用 DSH 默认模型，可在「提取」分组单独指定",
        "• 敏感凭据（API key / 密码等）会被过滤，不会写入记忆",
        "• 记忆库纯本地；向量召回需配置 embedding 端点，未配置时自动降级为关键词召回",
        "",
        "【注意事项】",
        "• 提取依赖可用的模型且输出稳定；长会话会分批消化（每次一批、一次调用，30 秒节流）",
        "• 画像（persona）与技能会在记忆积累到一定量后逐步生成",
        "• 关闭总开关会停止全部后台定时任务（提取/维护/夜间回顾）；已存记忆保留，重新开启即自动恢复",
        "• 卸载插件不会自动删除本地记忆数据"
      ].join("\n"),
      groupMaster: "总开关",
      groupModules: "模块开关",
      groupStorage: "存储",
      groupExtract: "提取（L1）",
      groupRecall: "召回 / 向量",
      groupConsolidate: "巩固（L2/L3）",
      groupEvolve: "自进化",
      groupHousekeeping: "成长治理（清理策略）",
      groupReview: "夜间回顾（每日完整进化）",
      save: "保存",
      reset: "恢复默认",
      saved: "已保存并立即生效",
      saving: "保存中…",
      error: "保存失败",
      conflict: "配置保存未生效（可能已被其他修改）：已自动刷新最新配置，请重试",
      unavailable: "设置表单不可用（HTTP 通道不可达：插件未启用，或宿主尚未重载到带 /config 端点的版本）",
      overridden: "已覆盖",
      loading: "加载中…",
      fEnabled: "启用插件（总开关）",
      fDebug: "调试日志",
      fCapture: "记录对话（L0 捕获）",
      fExtract: "提炼记忆（L1 提取）",
      fConsolidate: "归纳场景/画像（L2/L3）",
      fEvolve: "自进化（衰减/技能）",
      fRecall: "自动召回注入",
      fTools: "记忆工具（memory_search 等）",
      fStorageRoot: "记忆库目录（留空 = $DSH_HOME/memory）",
      fSearchLimit: "工具默认返回条数",
      fProvider: "提取 Provider（留空用默认模型）",
      fModel: "提取模型（留空用默认模型）",
      fInterval: "定时轮询间隔（分钟）",
      fBatchChars: "单次提取输入字符上限",
      fMaxTokens: "最大输出 Tokens",
      fTimeoutMs: "提取超时（毫秒）",
      fDedup: "去重（token 重叠）",
      fFallback: "坏 JSON 回退原文摘要",
      fFlushDrain: "headless 退出前排空提取",
      fStrategy: "召回策略",
      fStrategyHint: "keyword=纯关键词（默认，不调用向量服务）；hybrid=关键词+向量融合（需先配置下方 Embedding 端点，未配置时自动降级为关键词）。",
      fMaxResults: "召回条数上限",
      fScoreThreshold: "相似度阈值（0=不过滤）",
      fRecallTimeout: "召回超时（毫秒）",
      fEmbBase: "Embedding Base URL（留空=纯关键词）",
      fEmbKey: "Embedding API Key（只写）",
      fEmbModel: "Embedding 模型",
      fEmbDims: "向量维度",
      fEmbTimeout: "Embedding 超时（毫秒）",
      fSceneMax: "参与场景归纳的记忆数",
      fPersonaMax: "参与画像合成的记忆数",
      fSceneBatch: "每个场景最大记忆数",
      fDecay: "遗忘衰减",
      fDecayAge: "最小存在天数（天）",
      fDecayThreshold: "衰减评分阈值",
      fDecayRetention: "遗忘清理保留期（天，0=不清理）",
      fDecayMaxActive: "活跃记忆上限（0=不限，超限自动降级最低分）",
      fSkill: "技能合成（→ dsh-skill）",
      fSkillMin: "技能合成最低重要度",
      fSkillRoot: "技能根目录（留空 = $DSH_HOME/skills）",
      fSkillPrefix: "合成技能名前缀（如 dsi-，留空=不加）",
      fSkillMax: "合成技能数量上限（0=不限）",
      fHkPersona: "画像保留版本数",
      fHkScenes: "场景上限",
      fHkSceneRatio: "场景清理：来源记忆活跃比例阈值（0-1）",
      fHkConvDays: "对话切片保留天数（0=不清理）",
      fRecallInjectChars: "注入块字符上限",
      fReviewEnabled: "启用夜间回顾（每天做一次完整进化）",
      fReviewTime: "回顾时间（HH:MM，24 小时制）",
      secretHint: "留空保持当前密钥。",
      browserNav: "记忆",
      browserHint: "加载中…（数据来自本地记忆库 /api/dsh-self-improved/browser）",
      browserSearch: "筛选（关键词）",
      browserRefresh: "刷新",
      browserSummary: "共 {n} 条活跃记忆 · 待提取 {p} · 场景 {s} · 画像 v{v} · 技能 {k}",
      browserEmpty: "（没有活跃记忆）",
      browserPersona: "人物画像",
      browserPersonaEmpty: "（尚未生成画像——记忆积累后自进化会自动合成）",
      browserMemories: "记忆",
      browserScenes: "场景",
      browserScenesEmpty: "（暂无场景）",
      browserSkills: "已学习到的技能",
      browserSkillsEmpty: "（还没有技能——继续积累记忆，自进化会逐步提炼 SOP）",
      browserSynth: "已合成",
      browserSkillDelete: "删除",
      browserSkillDeleteConfirm: "确认删除这个合成技能？（系统技能不可删）",
      browserSkillDeleted: "已删除",
      browserDetail: "详情",
      browserDetailClose: "关闭",
      browserMetaKind: "类型",
      browserMetaImportance: "重要度",
      browserMetaAccess: "命中次数",
      browserMetaStatus: "状态",
      browserMetaCreated: "创建时间",
      browserMetaUpdated: "更新时间",
      browserMetaId: "ID",
      browserMetaSupersedes: "替代（纠正链）",
      browserCorrect: "纠正",
      browserForget: "遗忘",
      browserCorrectPrompt: "纠正为：",
      browserCorrected: "已纠正",
      browserForgetConfirm: "确认遗忘这条记忆？",
      browserForgotten: "已遗忘"
    };
    var en = {
      nav: "Evolving Memory",
      tabConfig: "Config",
      tabMemories: "Memory",
      intro: "Long-term memory & self-evolution: captures conversations, extracts memories, injects recall before turns, and consolidates/forgets/evolves over time.",
      helpTitle: "About this plugin",
      help: [
        "dsh-self-improved adds cross-session long-term memory and self-evolution to DSH. All data is stored locally by default ($DSH_HOME/memory) — nothing is uploaded.",
        "",
        "[Pipeline]",
        "L0 capture: each session's conversation is saved locally for the extraction pipeline.",
        "L1 extraction: a background LLM distills atomic memories (fact / preference / event / instruction) with JSON validation, dedup and sensitive-info filtering.",
        "L2 scenes / L3 persona: memories are grouped into scene blocks; a versioned user persona is synthesized incrementally.",
        "Auto recall injection: before each turn, relevant memories are retrieved by the current question and injected to the model as a memory block.",
        "Self-evolution: memories decay by importance × recency × access; users can correct memories; successful patterns can become reusable skills in dsh-skill.",
        "Schedule: every 15 min only extraction + free maintenance (decay/cleanup) runs — no LLM cost; a full review (drain extraction + scenes/persona + skills + governance) runs daily at a fixed time (default 22:00, configurable) and ~60s after startup; trigger manually via /memory evolve.",
        "",
        "[Module switches]",
        "• Capture (L0): records conversations (off = no new memory material)",
        "• Extract (L1): distillation (off = recall still uses old memories)",
        "• Consolidate (L2/L3): scenes/persona (off = persona not updated)",
        "• Evolve: decay & skill synthesis (off = memory only grows)",
        "• Recall injection: pre-turn injection (off = tools still allow manual search)",
        "• Tools: memory_search / memory_correct / memory_forget model-visible tools",
        "",
        "[Usage]",
        "• Type \"/\" in the chat input to open the command menu: /memory status, /memory list, /memory search <q>, /memory forget <id>, /memory correct <id> <text>",
        "• The model auto-uses memory tools (memory_search etc.) — no manual action needed",
        "• Changes here apply immediately after saving — no restart",
        "",
        "[Models & privacy]",
        "• Extraction/persona/skills use DSH's default model; you can set a dedicated one under Extraction",
        "• Secrets (API keys / passwords) are filtered out of memories",
        "• Fully local; vector recall needs an embedding endpoint, otherwise keyword-only",
        "",
        "[Notes]",
        "• Extraction needs a working, stable model; long sessions are drained in batches (one LLM call per batch, 30s throttle)",
        "• Persona and skills appear once memories accumulate",
        "• Disabling the master switch stops all background timers (extraction/maintenance/nightly review); stored memories are kept and everything resumes when re-enabled",
        "• Uninstalling the plugin does not delete local memory data"
      ].join("\n"),
      groupMaster: "Master",
      groupModules: "Modules",
      groupStorage: "Storage",
      groupExtract: "Extraction (L1)",
      groupRecall: "Recall / Embedding",
      groupConsolidate: "Consolidation (L2/L3)",
      groupEvolve: "Self-evolution",
      groupHousekeeping: "Growth governance",
      groupReview: "Nightly review (daily full evolution)",
      save: "Save",
      reset: "Reset",
      saved: "Saved — applied immediately",
      saving: "Saving…",
      error: "Save failed",
      conflict: "Save not applied (changed elsewhere): refreshed to the latest config — please retry",
      unavailable: "Settings form unavailable (HTTP channel unreachable: plugin disabled, or host not yet reloaded with the /config endpoints)",
      overridden: "overridden",
      loading: "Loading…",
      fEnabled: "Enable plugin (master switch)",
      fDebug: "Debug logs",
      fCapture: "Capture conversations (L0)",
      fExtract: "Extract memories (L1)",
      fConsolidate: "Consolidate scenes/persona (L2/L3)",
      fEvolve: "Self-evolve (decay/skills)",
      fRecall: "Auto recall injection",
      fTools: "Memory tools (memory_search etc.)",
      fStorageRoot: "Memory dir (blank = $DSH_HOME/memory)",
      fSearchLimit: "Default tool result limit",
      fProvider: "Extraction provider (blank = default model)",
      fModel: "Extraction model (blank = default model)",
      fInterval: "Poll interval (minutes)",
      fBatchChars: "Max input chars per batch",
      fMaxTokens: "Max output tokens",
      fTimeoutMs: "Extraction timeout (ms)",
      fDedup: "Dedup (token overlap)",
      fFallback: "Fallback to summary on bad JSON",
      fFlushDrain: "Drain extraction before headless exit",
      fStrategy: "Recall strategy",
      fStrategyHint: "keyword = pure keyword (default, no embedding calls); hybrid = keyword + vector fusion (requires an Embedding endpoint below; auto-falls back to keyword if unset).",
      fMaxResults: "Max recall results",
      fScoreThreshold: "Score threshold (0 = off)",
      fRecallTimeout: "Recall timeout (ms)",
      fEmbBase: "Embedding Base URL (blank = keyword only)",
      fEmbKey: "Embedding API Key (write-only)",
      fEmbModel: "Embedding model",
      fEmbDims: "Vector dimensions",
      fEmbTimeout: "Embedding timeout (ms)",
      fSceneMax: "Memories for scene grouping",
      fPersonaMax: "Memories for persona",
      fSceneBatch: "Max memories per scene",
      fDecay: "Forgetting decay",
      fDecayAge: "Min age (days)",
      fDecayThreshold: "Decay score threshold",
      fDecayRetention: "Forgotten retention (days, 0=keep)",
      fDecayMaxActive: "Max active memories (0=unlimited; overflow auto-decays lowest)",
      fSkill: "Skill synthesis (→ dsh-skill)",
      fSkillMin: "Skill min importance",
      fSkillRoot: "Skills root (blank = $DSH_HOME/skills)",
      fSkillPrefix: "Synthesized skill name prefix (e.g. dsi-; blank = none)",
      fSkillMax: "Max synthesized skills (0=unlimited)",
      fHkPersona: "Persona versions to keep",
      fHkScenes: "Max scenes",
      fHkSceneRatio: "Scene GC: source-memory active ratio threshold (0-1)",
      fHkConvDays: "Conversation slice retention days (0=keep all)",
      fRecallInjectChars: "Max injected block chars",
      fReviewEnabled: "Enable nightly review (one full evolution per day)",
      fReviewTime: "Review time (HH:MM, 24h)",
      secretHint: "Leave blank to keep the current key.",
      browserNav: "Memory",
      browserHint: "Loading… (data from the local memory store via /api/dsh-self-improved/browser)",
      browserSearch: "Filter",
      browserRefresh: "Refresh",
      browserSummary: "{n} active memories · {p} pending · {s} scenes · persona v{v} · {k} skills",
      browserEmpty: "(no active memories)",
      browserPersona: "Persona",
      browserPersonaEmpty: "(no persona yet — self-evolution synthesizes it as memories accumulate)",
      browserMemories: "Memories",
      browserScenes: "Scenes",
      browserScenesEmpty: "(no scenes yet)",
      browserSkills: "Learned skills",
      browserSkillsEmpty: "(no skills yet — keep accumulating memories, self-evolution will distill SOPs)",
      browserSynth: "synthesized",
      browserSkillDelete: "Delete",
      browserSkillDeleteConfirm: "Delete this synthesized skill? (system skills are protected)",
      browserSkillDeleted: "Deleted",
      browserDetail: "Detail",
      browserDetailClose: "Close",
      browserMetaKind: "Kind",
      browserMetaImportance: "Importance",
      browserMetaAccess: "Access count",
      browserMetaStatus: "Status",
      browserMetaCreated: "Created",
      browserMetaUpdated: "Updated",
      browserMetaId: "ID",
      browserMetaSupersedes: "Supersedes",
      browserCorrect: "Fix",
      browserForget: "Forget",
      browserCorrectPrompt: "Correct to:",
      browserCorrected: "Corrected",
      browserForgetConfirm: "Forget this memory?",
      browserForgotten: "Forgotten"
    };

    // ── field spec: dotted path + type + group ─────────────────────────────
    var FIELDS = [
      { path: ["enabled"], label: "fEnabled", type: "checkbox", group: "groupMaster" },
      { path: ["debug"], label: "fDebug", type: "checkbox", group: "groupMaster" },
      { path: ["modules", "capture"], label: "fCapture", type: "checkbox", group: "groupModules" },
      { path: ["modules", "extract"], label: "fExtract", type: "checkbox", group: "groupModules" },
      { path: ["modules", "consolidate"], label: "fConsolidate", type: "checkbox", group: "groupModules" },
      { path: ["modules", "evolve"], label: "fEvolve", type: "checkbox", group: "groupModules" },
      { path: ["modules", "recall"], label: "fRecall", type: "checkbox", group: "groupModules" },
      { path: ["modules", "tools"], label: "fTools", type: "checkbox", group: "groupModules" },
      { path: ["storageRoot"], label: "fStorageRoot", type: "text", group: "groupStorage" },
      { path: ["searchLimit"], label: "fSearchLimit", type: "number", group: "groupStorage" },
      { path: ["extract", "provider"], label: "fProvider", type: "text", group: "groupExtract" },
      { path: ["extract", "model"], label: "fModel", type: "text", group: "groupExtract" },
      { path: ["extract", "intervalMinutes"], label: "fInterval", type: "number", group: "groupExtract" },
      { path: ["extract", "batchMaxChars"], label: "fBatchChars", type: "number", group: "groupExtract" },
      { path: ["extract", "maxOutputTokens"], label: "fMaxTokens", type: "number", group: "groupExtract" },
      { path: ["extract", "timeoutMs"], label: "fTimeoutMs", type: "number", group: "groupExtract" },
      { path: ["extract", "dedup"], label: "fDedup", type: "checkbox", group: "groupExtract" },
      { path: ["extract", "fallbackOnBadJson"], label: "fFallback", type: "checkbox", group: "groupExtract" },
      { path: ["extract", "flushDrain"], label: "fFlushDrain", type: "checkbox", group: "groupExtract" },
      { path: ["recall", "strategy"], label: "fStrategy", type: "select", options: ["keyword", "hybrid"], hint: "fStrategyHint", group: "groupRecall" },
      { path: ["recall", "maxResults"], label: "fMaxResults", type: "number", group: "groupRecall" },
      { path: ["recall", "scoreThreshold"], label: "fScoreThreshold", type: "number", group: "groupRecall" },
      { path: ["recall", "timeoutMs"], label: "fRecallTimeout", type: "number", group: "groupRecall" },
      { path: ["recall", "embedding", "baseUrl"], label: "fEmbBase", type: "text", group: "groupRecall" },
      { path: ["recall", "embedding", "apiKey"], label: "fEmbKey", type: "password", secret: true, group: "groupRecall" },
      { path: ["recall", "embedding", "model"], label: "fEmbModel", type: "text", group: "groupRecall" },
      { path: ["recall", "embedding", "dimensions"], label: "fEmbDims", type: "number", group: "groupRecall" },
      { path: ["recall", "embedding", "timeoutMs"], label: "fEmbTimeout", type: "number", group: "groupRecall" },
      { path: ["consolidate", "sceneMaxMemories"], label: "fSceneMax", type: "number", group: "groupConsolidate" },
      { path: ["consolidate", "personaMaxMemories"], label: "fPersonaMax", type: "number", group: "groupConsolidate" },
      { path: ["consolidate", "sceneBatchSize"], label: "fSceneBatch", type: "number", group: "groupConsolidate" },
      { path: ["evolve", "decay", "enabled"], label: "fDecay", type: "checkbox", group: "groupEvolve" },
      { path: ["evolve", "decay", "minAgeDays"], label: "fDecayAge", type: "number", group: "groupEvolve" },
      { path: ["evolve", "decay", "threshold"], label: "fDecayThreshold", type: "number", group: "groupEvolve" },
      { path: ["evolve", "decay", "retentionDays"], label: "fDecayRetention", type: "number", group: "groupEvolve" },
      { path: ["evolve", "decay", "maxActiveMemories"], label: "fDecayMaxActive", type: "number", group: "groupEvolve" },
      { path: ["evolve", "skillSynthesis", "enabled"], label: "fSkill", type: "checkbox", group: "groupEvolve" },
      { path: ["evolve", "skillSynthesis", "minImportance"], label: "fSkillMin", type: "number", group: "groupEvolve" },
      { path: ["evolve", "skillSynthesis", "skillsRoot"], label: "fSkillRoot", type: "text", group: "groupEvolve" },
      { path: ["evolve", "skillSynthesis", "prefix"], label: "fSkillPrefix", type: "text", group: "groupEvolve" },
      { path: ["evolve", "skillSynthesis", "maxSkills"], label: "fSkillMax", type: "number", group: "groupEvolve" },
      { path: ["housekeeping", "personaVersions"], label: "fHkPersona", type: "number", group: "groupHousekeeping" },
      { path: ["housekeeping", "maxScenes"], label: "fHkScenes", type: "number", group: "groupHousekeeping" },
      { path: ["housekeeping", "sceneActiveRatio"], label: "fHkSceneRatio", type: "number", group: "groupHousekeeping" },
      { path: ["housekeeping", "conversationRetentionDays"], label: "fHkConvDays", type: "number", group: "groupHousekeeping" },
      { path: ["review", "enabled"], label: "fReviewEnabled", type: "checkbox", group: "groupReview" },
      { path: ["review", "time"], label: "fReviewTime", type: "text", group: "groupReview" }
    ];
    FIELDS.forEach(function (f) { f.key = f.path.join("."); });

    function getPath(obj, path) {
      var cur = obj;
      for (var i = 0; i < path.length; i += 1) {
        if (cur === null || cur === void 0 || typeof cur !== "object") return void 0;
        cur = cur[path[i]];
      }
      return cur;
    }

    // ── 0.2.0 设置表单（HTTP 通道）────────────────────────────────────────
    // 官方 configForms 表单在非 loopback 页面被宿主置为 memory 模式（构造即 unavailable，
    // 镜像也永不加载），Tailscale/配对访问下整个设置面不可用。本表单改走插件自己的
    // HTTP 端点（GET/POST api/dsh-self-improved/config），宿主侧经 SettingsForms.mutate
    // 写入 → loader volatile 热应用；revision 冲突返回 409 → mutate 兑现为 false。
    // 快照契约与 ConfigFormController 一致：{status, value, base, user, revision, writable}。
    var CONFIG_API = "api/dsh-self-improved/config";
    function createHttpConfigForm() {
      var listeners = [];
      var snapshot = { status: "loading", value: void 0, base: void 0, user: void 0, revision: void 0, writable: true };
      function publish() {
        for (var i = 0; i < listeners.length; i += 1) { try { listeners[i](); } catch (e) { /* noop */ } }
      }
      function applyDescriptor(d) {
        snapshot = {
          status: "ready",
          value: d.value !== void 0 ? d.value : {},
          base: d.base !== void 0 ? d.base : {},
          user: d.user !== void 0 ? d.user : {},
          revision: d.revision,
          writable: true
        };
        publish();
      }
      function markUnavailable(message) {
        snapshot = { status: "unavailable", value: void 0, base: void 0, user: void 0, revision: void 0, writable: false, error: message };
        publish();
      }
      function load() {
        return fetch(CONFIG_API).then(function (r) {
          if (r.status === 403) throw new Error("forbidden");
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (res) {
          if (!res || !res.ok || !res.descriptor) throw new Error(res && res.error || "no descriptor");
          applyDescriptor(res.descriptor);
        }).catch(function (e) {
          markUnavailable(String(e && e.message || e));
          throw e;
        });
      }
      load().catch(function () { /* 状态已置 unavailable，由 UI 呈现 */ });
      return {
        getSnapshot: function () { return snapshot; },
        subscribe: function (l) { listeners.push(l); return function () { var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
        load: load,
        mutate: function (ops, expectedRevision) {
          return fetch(CONFIG_API, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ops: ops, expectedRevision: expectedRevision })
          }).then(function (r) {
            return r.json().then(function (body) { return { httpStatus: r.status, body: body }; });
          }).then(function (res) {
            var body = res.body || {};
            if (res.httpStatus === 200 && body.ok) {
              if (body.descriptor) applyDescriptor(body.descriptor);
              return true;
            }
            if (res.httpStatus === 409) {
              // 版本冲突：以服务端最新描述符刷新快照（草稿保留），UI 提示重试
              if (body.descriptor) applyDescriptor(body.descriptor);
              return false;
            }
            throw new Error(body.error || "HTTP " + res.httpStatus);
          });
        }
      };
    }

    function MemorySection(props) {
      var t = props.t;
      var form = props.form;
      var [snapshot, setSnapshot] = react.useState(function () { return form.getSnapshot(); });
      var ready = snapshot.status === "ready" && snapshot.value !== void 0;
      var [draft, setDraft] = react.useState({});
      var [busy, setBusy] = react.useState(false);
      var [notice, setNotice] = react.useState(null);
      var [error, setError] = react.useState(null);
      var [showHelp, setShowHelp] = react.useState(false);

      react.useEffect(function () {
        var alive = true;
        // 0.2.0：configForms 表单由 describe 镜像自动同步，无需手动 load
        var sync = function () { if (alive) setSnapshot(form.getSnapshot()); };
        var un = form.subscribe(sync);
        return function () { alive = false; if (un) un(); };
      }, [form]);
      react.useEffect(function () {
        if (ready) setDraft(Object.assign({}, valueToDraft(snapshot.value)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [ready]);

      if (snapshot.status === "unavailable") {
        return h("p", { className: "__dsi_unavailable" }, t("unavailable"));
      }
      if (!ready) return h("p", { className: "__dsi_status" }, t("loading"));

      var value = snapshot.value;
      var user = snapshot.user || {};

      function fieldDraft(f) {
        if (f.type === "checkbox") return draft[f.key] !== void 0 ? draft[f.key] : Boolean(getPath(value, f.path));
        return draft[f.key] !== void 0 ? draft[f.key] : String(getPath(value, f.path) ?? "");
      }
      function setField(f, v) {
        setDraft(function (prev) { var next = Object.assign({}, prev); next[f.key] = v; return next; });
        setNotice(null);
        setError(null);
      }

      // 0.2.0：form.mutate 返回 Promise<boolean>——false 表示宿主拒绝（版本冲突等），
      // 表单内部已自动 recover 刷新最新配置；提示用户重试即可
      function onSave() {
        setBusy(true); setNotice(null); setError(null);
        var ops = [];
        for (var i = 0; i < FIELDS.length; i += 1) {
          var f = FIELDS[i];
          var d = fieldDraft(f);
          var current = getPath(value, f.path);
          if (f.type === "password") {
            if (!d) continue; // blank keeps the current key
            if (d === String(current ?? "")) continue;
            ops.push({ op: "set", path: f.path, value: d });
            continue;
          }
          if (f.type === "checkbox") {
            if (Boolean(d) === Boolean(current)) continue;
            // 注意：关闭必须 set false——unset 会让解析值回落 schema 默认值（多为 true），开关等于没关
            ops.push({ op: "set", path: f.path, value: Boolean(d) });
            continue;
          }
          if (f.type === "select") {
            if (String(d) === String(current ?? "")) continue;
            ops.push(String(d) ? { op: "set", path: f.path, value: d } : { op: "unset", path: f.path });
            continue;
          }
          if (String(d) === String(current ?? "")) continue;
          if (String(d).trim() === "" && getPath(user, f.path) === void 0) continue;
          ops.push(String(d).trim() === "" ? { op: "unset", path: f.path } : { op: "set", path: f.path, value: f.type === "number" ? Number(d) : d });
        }
        if (ops.length === 0) { setBusy(false); setNotice(t("saved")); return; }
        form.mutate(ops, snapshot.revision).then(function (accepted) {
          setBusy(false);
          if (accepted) {
            setNotice(t("saved"));
            // 不用响应值重建 draft——保留用户界面状态，等待订阅推送的最新快照
          } else {
            setError(t("conflict"));
          }
        }).catch(function (e) {
          setBusy(false); setError(t("error") + ": " + String(e && e.message || e));
        });
      }

      function onReset() {
        setBusy(true); setNotice(null); setError(null);
        form.mutate(FIELDS.map(function (f) { return { op: "unset", path: f.path }; }), snapshot.revision).then(function (accepted) {
          setBusy(false);
          if (accepted) setNotice(t("saved"));
          else setError(t("conflict"));
        }).catch(function (e) {
          setBusy(false); setError(t("error") + ": " + String(e && e.message || e));
        });
      }

      // 模块开关联动折叠：关掉的模块其配置组自动收起，总开关关闭时全部收起
      var GROUP_SWITCH = {
        groupExtract: "modules.extract",
        groupRecall: "modules.recall",
        groupConsolidate: "modules.consolidate",
        groupEvolve: "modules.evolve",
        groupStorage: "enabled"
      };
      function switchValue(key) {
        return Boolean(draft[key] !== void 0 ? draft[key] : getPath(value, key.split(".")));
      }
      var masterOn = switchValue("enabled");
      function groupVisible(g) {
        if (g === "groupMaster" || g === "groupModules") return true;
        var sw = GROUP_SWITCH[g];
        if (!sw) return true;
        if (sw === "enabled") return masterOn;
        return masterOn && switchValue(sw);
      }

      var nodes = [];
      var lastGroup = null;
      FIELDS.forEach(function (f) {
        if (!groupVisible(f.group)) return; // 折叠隐藏的组
        if (f.group !== lastGroup) {
          lastGroup = f.group;
          nodes.push(h("div", { key: "g" + f.group, className: "__dsi_group" }, t(f.group)));
        }
        var overridden = getPath(user, f.path) !== void 0;
        if (f.type === "checkbox") {
          // 滑动开关
          nodes.push(h("label", { key: f.path.join("."), className: "__dsi_field" },
            h("span", { className: "__dsi_row" },
              h("span", { className: "__dsi_switch" },
                h("input", { type: "checkbox", checked: Boolean(fieldDraft(f)), onChange: function (e) { setField(f, e.target.checked); } }),
                h("span", { className: "__dsi_switchTrack" }),
                h("span", { className: "__dsi_switchThumb" })
              ),
              h("span", { className: "__dsi_label" }, t(f.label)),
              overridden ? h("span", { className: "__dsi_override" }, t("overridden")) : null
            )
          ));
          return;
        }
        var input;
        if (f.type === "select") {
          input = h("select", {
            className: "__dsi_input",
            value: fieldDraft(f),
            onChange: function (e) { setField(f, e.target.value); }
          }, f.options.map(function (opt) {
            return h("option", { key: opt, value: opt }, opt);
          }));
        } else {
          input = h("input", {
            className: "__dsi_input",
            type: f.type === "password" ? "password" : f.type === "number" ? "number" : "text",
            value: fieldDraft(f),
            placeholder: f.type === "password" ? (overridden ? "••••••••" : t("secretHint")) : "",
            onChange: function (e) { setField(f, e.target.value); }
          });
        }
        nodes.push(h("label", { key: f.path.join("."), className: "__dsi_field" },
          h("span", { className: "__dsi_label" },
            t(f.label),
            overridden ? h("span", { className: "__dsi_override" }, t("overridden")) : null
          ),
          input,
          f.type === "password" ? h("span", { className: "__dsi_hint" }, t("secretHint")) : null,
          f.hint ? h("span", { className: "__dsi_hint" }, t(f.hint)) : null
        ));
      });

      return h("div", { className: "__dsi_root" },
        h("div", { className: "__dsi_header" },
          h("p", { className: "__dsi_intro" }, t("intro")),
          h("button", {
            type: "button",
            className: "__dsi_helpBtn",
            title: t("helpTitle"),
            onClick: function () { setShowHelp(!showHelp); }
          }, "?")
        ),
        showHelp ? h("div", { className: "__dsi_help" },
          h("h4", null, t("helpTitle")),
          h("p", null, t("help"))
        ) : null,
        nodes,
        h("div", { className: "__dsi_actions" },
          h("button", { type: "button", className: "__dsi_btn __dsi_btnPrimary", onClick: onSave, disabled: busy || !snapshot.writable }, t("save")),
          h("button", { type: "button", className: "__dsi_btn", onClick: onReset, disabled: busy || !snapshot.writable }, t("reset")),
          notice ? h("span", { className: "__dsi_ok" }, notice) : null,
          busy ? h("span", { className: "__dsi_status" }, t("saving")) : null,
          error ? h("span", { className: "__dsi_error" }, error) : null
        )
      );
    }

    function valueToDraft(value) {
      var out = {};
      for (var i = 0; i < FIELDS.length; i += 1) {
        var f = FIELDS[i];
        out[f.key] = f.type === "checkbox" ? Boolean(getPath(value, f.path)) : String(getPath(value, f.path) ?? "");
      }
      return out;
    }

    // ── 记忆浏览器（设置页第二个标签页；0.2.0 起经 webServer HTTP 端点读取，无需 session）─────
    var KIND_LABEL = { fact: "📖事实", preference: "📌偏好", event: "🧭事件", instruction: "📋指令", persona: "👤画像" };
    var BROWSER_API = "api/dsh-self-improved";

    function BrowserSection(props) {
      var t = props.t;
      var [data, setData] = react.useState(null);
      var [detailObj, setDetailObj] = react.useState(null);
      var [busy, setBusy] = react.useState(false);
      var [error, setError] = react.useState(null);
      var [query, setQuery] = react.useState("");
      var [notice, setNotice] = react.useState(null);
      var [closedDetailId, setClosedDetailId] = react.useState(null);

      // 折叠面板开关（hooks 必须全部位于任何条件 return 之前——React #310）
      var [open, setOpen] = react.useState({ persona: false, memories: true, scenes: false, skills: false });
      function toggle(k) {
        setOpen(function (p) { var n = Object.assign({}, p); n[k] = !n[k]; return n; });
      }

      function fetchSnapshot() {
        return fetch(BROWSER_API + "/browser").then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (res) {
          if (res && res.snapshot) setData(res.snapshot);
          return res;
        });
      }
      react.useEffect(function () {
        var alive = true;
        fetchSnapshot().catch(function (e) { if (alive) setError(String(e && e.message || e)); });
        return function () { alive = false; };
      }, []);

      var showDetail = detailObj && detailObj.id !== closedDetailId;

      if (!data) {
        return h("div", { className: "__dsi_root" },
          h("p", { className: "__dsi_status" }, t("browserHint")),
          error ? h("p", { className: "__dsi_error" }, error) : null);
      }

      var memories = (data.memories || []).filter(function (m) { return m.status === "active"; });
      var q = query.trim().toLowerCase();
      var filtered = q ? memories.filter(function (m) { return m.content.toLowerCase().indexOf(q) >= 0 || m.kind.indexOf(q) >= 0; }) : memories;

      // 0.2.0：操作走 POST /api/dsh-self-improved/action，响应直接携带新快照（detail 随响应返回）
      function sendAction(action, done) {
        setBusy(true); setNotice(null); setError(null);
        return fetch(BROWSER_API + "/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action)
        }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (res) {
          if (res && res.snapshot) setData(res.snapshot);
          if (res && res.detail !== void 0) setDetailObj(res.detail);
          setBusy(false);
          if (done) done(res);
          return res;
        }).catch(function (e) {
          setBusy(false); setError(String(e && e.message || e));
          return null;
        });
      }
      function viewDetail(m) {
        setClosedDetailId(null);
        sendAction({ op: "detail", id: m.id });
      }
      function refresh() {
        setBusy(true); setNotice(null); setError(null);
        fetchSnapshot().then(function () { setBusy(false); }).catch(function (e) { setBusy(false); setError(String(e && e.message || e)); });
      }
      function forget(m) {
        if (!window.confirm(t("browserForgetConfirm") + "\n" + m.content.slice(0, 60))) return;
        sendAction({ op: "forget", id: m.id }, function (res) { if (res) setNotice(t("browserForgotten")); });
      }
      function correct(m) {
        var next = window.prompt(t("browserCorrectPrompt"), m.content);
        if (next === null || !next.trim()) return;
        sendAction({ op: "correct", id: m.id, content: next.trim() }, function (res) { if (res) setNotice(t("browserCorrected")); });
      }

      var listNodes = filtered.slice(0, 200).map(function (m) {
        return h("div", { key: m.id, className: "__dsi_browserRow" },
          h("div", { className: "__dsi_browserMain" },
            h("span", { className: "__dsi_browserKind" }, KIND_LABEL[m.kind] || m.kind),
            h("span", { className: "__dsi_browserContent" }, m.content),
            h("span", { className: "__dsi_browserMeta" }, "★" + m.importance + " · 命中" + m.accessCount + " · " + m.id.slice(0, 8))
          ),
          h("span", { className: "__dsi_browserOps" },
            h("button", { type: "button", className: "__dsi_btn", onClick: function () { viewDetail(m); }, disabled: busy }, t("browserDetail")),
            h("button", { type: "button", className: "__dsi_btn", onClick: function () { correct(m); }, disabled: busy }, t("browserCorrect")),
            h("button", { type: "button", className: "__dsi_btn", onClick: function () { forget(m); }, disabled: busy }, t("browserForget"))
          )
        );
      });

      var scenesNodes = (data.scenes || []).slice(0, 20).map(function (s) {
        return h("div", { key: s.id, className: "__dsi_browserRow" },
          h("div", { className: "__dsi_browserMain" },
            h("span", { className: "__dsi_browserKind" }, "🗂️" + s.title)));
      });

      var skills = data.skills || [];
      function deleteSkill(sk) {
        if (!window.confirm(t("browserSkillDeleteConfirm") + "\n" + sk.name)) return;
        sendAction({ op: "deleteSkill", name: sk.name }, function (res) { if (res) setNotice(t("browserSkillDeleted")); });
      }
      var skillsNodes = skills.map(function (sk) {
        return h("div", { key: sk.name, className: "__dsi_browserRow" },
          h("div", { className: "__dsi_browserMain" },
            h("span", { className: "__dsi_browserKind" }, "📘 " + sk.name + (sk.synthesized ? " (" + t("browserSynth") + ")" : "")),
            sk.description ? h("span", { className: "__dsi_browserContent" }, sk.description) : null,
            sk.whenToUse ? h("span", { className: "__dsi_browserMeta" }, sk.whenToUse) : null,
            sk.excerpt ? h("span", { className: "__dsi_browserMeta" }, sk.excerpt) : null
          ),
          sk.synthesized ? h("span", { className: "__dsi_browserOps" },
            h("button", { type: "button", className: "__dsi_btn", onClick: function () { deleteSkill(sk); }, disabled: busy }, t("browserSkillDelete"))
          ) : null);
      });

      function collapse(key, title, count, body) {
        var isOpen = open[key];
        return h("div", { className: "__dsi_collapse" + (isOpen ? " __dsi_collapseOpen" : "") },
          h("div", { className: "__dsi_collapseHeader", onClick: function () { toggle(key); } },
            h("span", { className: "__dsi_collapseChevron" }, "▶"),
            h("span", { className: "__dsi_collapseTitle" }, title),
            h("span", { className: "__dsi_collapseCount" }, count)
          ),
          isOpen ? h("div", { className: "__dsi_collapseBody" }, body) : null
        );
      }

      var persona = data.persona;
      var scenesArr = data.scenes || [];
      var personaBody = persona
        ? h("div", { className: "__dsi_persona" }, persona.content)
        : h("p", { className: "__dsi_status" }, t("browserPersonaEmpty"));

      var memoryBody = h("div", { className: "__dsi_collapse" },
        h("div", { className: "__dsi_row" },
          h("input", { className: "__dsi_input", style: { maxWidth: 260 }, placeholder: t("browserSearch"), value: query, onChange: function (e) { setQuery(e.target.value); } }),
          h("button", { type: "button", className: "__dsi_btn", onClick: refresh, disabled: busy }, t("browserRefresh"))
        ),
        listNodes.length ? listNodes : h("p", { className: "__dsi_status" }, t("browserEmpty"))
      );

      var scenesBody = scenesArr.length
        ? h("div", { className: "__dsi_collapse" }, scenesNodes)
        : h("p", { className: "__dsi_status" }, t("browserScenesEmpty"));

      var skillsBody = skills.length
        ? (skillsNodes.length ? h("div", { className: "__dsi_collapse" }, skillsNodes) : h("p", { className: "__dsi_status" }, t("browserSkillsEmpty")))
        : h("p", { className: "__dsi_status" }, t("browserSkillsEmpty"));

      var STATUS_LABEL = { active: "活跃", decayed: "已衰减", forgotten: "已遗忘", corrected: "已纠正" };
      function fmtTime(ts) {
        try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); }
      }
      var modal = showDetail ? h("div", { className: "__dsi_modalBackdrop", onClick: function () { setClosedDetailId(detailObj.id); } },
        h("div", { className: "__dsi_modal", onClick: function (e) { e.stopPropagation(); } },
          h("div", { className: "__dsi_modalHeader" },
            h("span", { className: "__dsi_modalTitle" }, (KIND_LABEL[detailObj.kind] || detailObj.kind) + " · " + t("browserDetail")),
            h("button", { type: "button", className: "__dsi_btn", onClick: function () { setClosedDetailId(detailObj.id); } }, t("browserDetailClose"))
          ),
          h("div", { className: "__dsi_modalBody" },
            h("div", { className: "__dsi_modalContent" }, detailObj.content),
            h("div", { className: "__dsi_modalMeta" },
              h("b", null, t("browserMetaKind")), h("span", null, detailObj.kind),
              h("b", null, t("browserMetaImportance")), h("span", null, "★ " + detailObj.importance + " / 10"),
              h("b", null, t("browserMetaAccess")), h("span", null, String(detailObj.accessCount)),
              h("b", null, t("browserMetaStatus")), h("span", null, STATUS_LABEL[detailObj.status] || detailObj.status),
              h("b", null, t("browserMetaCreated")), h("span", null, fmtTime(detailObj.createdAt)),
              h("b", null, t("browserMetaUpdated")), h("span", null, fmtTime(detailObj.updatedAt)),
              h("b", null, t("browserMetaId")), h("span", null, detailObj.id),
              detailObj.supersedes ? h("b", null, t("browserMetaSupersedes")) : null,
              detailObj.supersedes ? h("span", null, detailObj.supersedes) : null
            )
          )
        )
      ) : null;

      return h("div", { className: "__dsi_root" },
        h("p", { className: "__dsi_status" },
          t("browserSummary").replace("{n}", String(memories.length)).replace("{p}", String(data.pending || 0)).replace("{s}", String(scenesArr.length)).replace("{v}", String(persona ? persona.ver : "-")).replace("{k}", String(skills.length))
        ),
        notice ? h("p", { className: "__dsi_ok" }, notice) : null,
        error ? h("p", { className: "__dsi_error" }, error) : null,
        collapse("persona", t("browserPersona") + (persona ? " v" + persona.ver : ""), persona ? "" : "", personaBody),
        collapse("memories", t("browserMemories"), String(memories.length), memoryBody),
        collapse("scenes", t("browserScenes"), String(scenesArr.length), scenesBody),
        collapse("skills", t("browserSkills"), String(skills.length), skillsBody),
        modal
      );
    }

    // ── 主设置区：一个 section，内部"配置 / 记忆"两个 Tab ──────────────────
    function MainSection(props) {
      var t = props.t;
      var [tab, setTab] = react.useState("config");
      return h("div", { className: "__dsi_tabs" },
        h("div", { className: "__dsi_tabBar" },
          h("button", { type: "button", className: "__dsi_tab" + (tab === "config" ? " __dsi_tabActive" : ""), onClick: function () { setTab("config"); } }, t("tabConfig")),
          h("button", { type: "button", className: "__dsi_tab" + (tab === "memories" ? " __dsi_tabActive" : ""), onClick: function () { setTab("memories"); } }, t("tabMemories"))
        ),
        tab === "config" ? h(MemorySection, props) : h(BrowserSection, props)
      );
    }

    // ── plugin ────────────────────────────────────────────────────────────
    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-self-improved: dictionaries");
      // 0.2.0：设置表单走插件自有 HTTP 通道（非 loopback 页面的官方 configForms 一律 unavailable）；
      // 记忆浏览器同通道。
      var form = createHttpConfigForm();
      // 单个设置区，内部两个 Tab：配置 / 记忆
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "dsh-self-improved",
          order: 27,
          label: function () { return t("nav"); },
          locale: NS
        }, function (props) {
          return h(MainSection, Object.assign({}, props, { form: form }));
        });
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
