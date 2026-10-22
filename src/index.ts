/**
 * dsh-self-improved —— DeepSeek Harness 长期记忆与自进化插件（纯本地）。
 *
 * M1 状态：记忆库（SQLite + FTS5 + sqlite-vec 骨架）+ L0 捕获落盘 + 记忆/对话搜索工具。
 * 设计文档见 docs/（design/ 与 research/）。
 */
import z from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import type { IncomingMessage, ServerResponse } from "node:http";

// 服务类型增强：把各 dsh-* 包的 `declare module '@deepseek-ai/cordis'` 类型增强引入本次编译。
import "@deepseek-ai/dsh-session";
import "@deepseek-ai/dsh-agent";
import "@deepseek-ai/dsh-system-prompt";
import "@deepseek-ai/dsh-llm";
import "@deepseek-ai/dsh-schedule";
import "@deepseek-ai/dsh-session-query";
import "@deepseek-ai/dsh-host-webserver";
import "@deepseek-ai/dsh-settings";
import "@deepseek-ai/cordis-plugin-loader";

import { MemoryStore, defaultMemoryDir } from "./storage.js";
import { installCapture } from "./capture.js";
import { registerMemoryTools } from "./tools.js";
import { Extractor, type ExtractSettings } from "./extract.js";
import { RecallService, createOpenAiEmbedding, type RecallSettings } from "./recall.js";
import { installRecallInjection } from "./inject.js";
import { Consolidator } from "./consolidate.js";
import { applyDecay, synthesizeSkills, deleteSkill } from "./evolve.js";
import { installMemoryCommands, browserSnapshot } from "./commands.js";
import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";

export const name = "self-improved";

/** 需要的宿主服务（Cordis inject 列表；0.2.0：设置页由 Config schema 自动生成，不再依赖 settings 服务） */
/**
 * 需要的宿主服务（静态 inject：loader 在 apply 前解析进同一上下文）。
 * ⚠️ 0.2.0 cordis 强制服务属性访问必须有 inject 声明（"cannot get property X without inject"），
 * 且动态 ctx.inject(["webServer"], cb) 的子 fiber 会解析到错误实例/静默 PENDING——
 * 必须像 dsh-usage 一样走静态声明 + ctx.webServer 直接注册。
 * 代价：headless 装配没有 webServer，本插件将无法在 headless 加载（web 场景专用，可接受）。
 */
export const inject = ["sessions", "tools", "sessionQuery", "llm", "webServer", "settings"] as const;

/** 模块开关（联动规则见 docs/design/dsh-memory-detailed-design.md §2.5） */
export interface ModuleSwitches {
  capture: boolean;
  extract: boolean;
  consolidate: boolean;
  evolve: boolean;
  recall: boolean;
  tools: boolean;
}

export interface ExtractConfig {
  /** 定时轮询间隔（分钟） */
  intervalMinutes: number;
  /** 单次提取输入字符上限 */
  batchMaxChars: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** 去重 */
  dedup: boolean;
  /** 坏 JSON 回退原文摘要（默认关闭，避免产生低价值摘要噪音） */
  fallbackOnBadJson: boolean;
  /** 丢弃重要度低于该值的提取结果（降噪，默认 3） */
  minImportance: number;
  /** headless：flush 时同步排空 */
  flushDrain: boolean;
  /** 提取模型（留空跟随 DSH 默认） */
  model: string;
  provider: string;
}

export interface EmbeddingConfig {
  /** OpenAI 兼容 embedding 端点；留空 = 纯关键词召回 */
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
}

export interface RecallConfig {
  strategy: "keyword" | "hybrid";
  maxResults: number;
  scoreThreshold: number;
  timeoutMs: number;
  /** 注入块字符上限（防单次注入撑爆上下文） */
  maxInjectChars: number;
  embedding: EmbeddingConfig;
}

export interface Config {
  /** L1 总开关：随时关闭/开启，热切换，不重启 */
  enabled: boolean;
  /** 探针/调试日志 */
  debug: boolean;
  /** 记忆库根目录；留空 = $DSH_HOME/memory */
  storageRoot: string;
  /** 工具默认返回条数 */
  searchLimit: number;
  /** L2 模块开关 */
  modules: ModuleSwitches;
  /** L1 提取管线参数 */
  extract: ExtractConfig;
  /** M3 召回参数 */
  recall: RecallConfig;
  /** M4 巩固（L2/L3）参数 */
  consolidate: { sceneMaxMemories: number; personaMaxMemories: number; sceneBatchSize: number };
  /** M4 自进化参数 */
  evolve: {
    decay: { enabled: boolean; minAgeDays: number; threshold: number; retentionDays: number; maxActiveMemories: number };
    skillSynthesis: { enabled: boolean; minImportance: number; skillsRoot: string; prefix: string; maxSkills: number };
  };
  /** M6 成长治理：画像版本/场景/对话切片的上限与清理 */
  housekeeping: {
    personaVersions: number;
    maxScenes: number;
    sceneActiveRatio: number;
    conversationRetentionDays: number;
  };
  /** M6 夜间回顾计划：每天固定时刻做一次完整进化（提取排空+巩固+技能+治理） */
  review: { enabled: boolean; time: string };
}

/**
 * 0.2.0 设置模型：本 schema 即设置页（命名空间 = profile 条目 id），除 storageRoot 外
 * 全部标记 volatile()——设置页保存时 Loader 把新值原地提交进运行 fiber 并派发
 * loader/volatile-update（不重挂载本条目），apply() 内监听该事件热应用。
 * storageRoot 保持普通字段：改动走整条目重挂载 = 重建 MemoryStore，语义正确。
 * 注意：volatile 字段解析产物是引用（带 .get()），apply 入口用 resolveConfig 解包。
 */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  debug: z.boolean().default(false).volatile(),
  storageRoot: z.string().default(""),
  searchLimit: z.number().min(1).max(50).default(5).volatile(),
  modules: z.object({
    capture: z.boolean().default(true),
    extract: z.boolean().default(true),
    consolidate: z.boolean().default(true),
    evolve: z.boolean().default(true),
    recall: z.boolean().default(true),
    tools: z.boolean().default(true),
  }).volatile(),
  extract: z.object({
    intervalMinutes: z.number().min(1).default(15),
    batchMaxChars: z.number().min(2000).max(100000).default(12000),
    maxOutputTokens: z.number().min(128).default(2000),
    timeoutMs: z.number().min(5000).default(60000),
    dedup: z.boolean().default(true),
    fallbackOnBadJson: z.boolean().default(false),
    minImportance: z.number().min(1).max(10).default(3),
    flushDrain: z.boolean().default(false),
    model: z.string().default(""),
    provider: z.string().default(""),
  }).volatile(),
  recall: z.object({
    strategy: z.string().default("keyword"),
    maxResults: z.number().min(1).max(20).default(5),
    scoreThreshold: z.number().min(0).default(0),
    timeoutMs: z.number().min(1000).default(5000),
    maxInjectChars: z.number().min(100).default(800),
    embedding: z.object({
      baseUrl: z.string().default(""),
      apiKey: z.string().default(""),
      model: z.string().default(""),
      dimensions: z.number().min(64).default(1024),
      timeoutMs: z.number().min(1000).default(10000),
    }),
  }).volatile(),
  consolidate: z.object({
    sceneMaxMemories: z.number().min(1).default(50),
    personaMaxMemories: z.number().min(1).default(30),
    sceneBatchSize: z.number().min(1).max(20).default(8),
  }).volatile(),
  evolve: z.object({
    decay: z.object({
      enabled: z.boolean().default(true),
      minAgeDays: z.number().min(1).default(7),
      threshold: z.number().min(0).default(2),
      retentionDays: z.number().min(0).default(180),
      maxActiveMemories: z.number().min(0).default(500),
    }),
    skillSynthesis: z.object({
      enabled: z.boolean().default(true),
      minImportance: z.number().min(1).max(10).default(7),
      skillsRoot: z.string().default(""),
      prefix: z.string().default("dsi-"),
      maxSkills: z.number().min(0).default(100),
    }),
  }).volatile(),
  housekeeping: z.object({
    personaVersions: z.number().min(1).default(10),
    maxScenes: z.number().min(1).default(50),
    sceneActiveRatio: z.number().min(0).max(1).default(0.3),
    conversationRetentionDays: z.number().min(0).default(90),
  }).volatile(),
  review: z.object({
    enabled: z.boolean().default(true),
    time: z.string().default("22:00"),
  }).volatile(),
});

export function apply(ctx: Context, rawConfig: Config): void {
  // ⓪ 0.2.0 volatile 配置解包：volatile 字段以引用（{ get(): value }）形式提交进运行 fiber，
  //    这里统一解成普通值；loader/volatile-update 时重新解析并热应用（见下方 ⑦）。
  const readLeaf = <T>(field: unknown): T => {
    if (field !== null && typeof field === "object" && typeof (field as { get?: unknown }).get === "function") {
      return (field as { get: () => T }).get();
    }
    return field as T;
  };
  const VOLATILE_KEYS = ["enabled", "debug", "searchLimit", "modules", "extract", "recall", "consolidate", "evolve", "housekeeping", "review"] as const;
  const resolveConfig = (raw: unknown): Config => {
    const src = (raw ?? {}) as Record<string, unknown>;
    const out = { ...src };
    for (const key of VOLATILE_KEYS) out[key] = readLeaf(out[key]);
    return out as unknown as Config;
  };
  let config = resolveConfig(rawConfig);

  const log = (...args: unknown[]): void => {
    if (config.debug) console.log("[dsh-self-improved]", ...args);
  };

  // ⓪' 可选：抑制宿主按 Config schema 自动生成的设置页（本插件 client.js 提供自定义设置 UI，
  //    避免设置导航出现重复两项）。注意 owner 必须显式传本插件自己的 fiber——
  //    缺省值是 SettingsForms 服务所有者的 fiber（宿主根），policy 永远匹配不到任何条目。
  //    settings 服务缺席（极端裁剪装配）时静默跳过。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try { (ctx as any).settings?.configure?.({ auto: false }, (ctx as any).fiber); } catch { /* 尽力而为 */ }

  // 运行时可变状态（M5：总开关/模块开关随时切换，无需重启；0.2.0 经 volatile-update 热应用）
  const state = { enabled: config.enabled, modules: { ...config.modules } };
  const readModule = (m: keyof ModuleSwitches): boolean => state.enabled && state.modules[m];

  // ② 记忆库（M1）：SQLite + FTS5 + sqlite-vec 骨架
  const dir = config.storageRoot.trim() || defaultMemoryDir();
  const store = new MemoryStore(dir);
  log("memory store ready:", dir);

  // ③ L0 捕获 + L1 提取：session/flush 屏障内落盘切片并标记队列；
  //    headless（flushDrain）时同步排空提取，防止 5s 关停超时杀掉管线。
  const extractSettings: ExtractSettings = {
    enabled: readModule("extract"),
    intervalMinutes: config.extract.intervalMinutes,
    batchMaxChars: config.extract.batchMaxChars,
    maxOutputTokens: config.extract.maxOutputTokens,
    timeoutMs: config.extract.timeoutMs,
    dedup: config.extract.dedup,
    fallbackOnBadJson: config.extract.fallbackOnBadJson,
    minImportance: config.extract.minImportance,
    flushDrain: config.extract.flushDrain,
  };
  let embeddingProvider = createOpenAiEmbedding(config.recall.embedding);
  /** embedding 端点指纹：变化时才重建管线实例（见 ⑦ rewirePipeline） */
  const embeddingKey = (e: typeof config.recall.embedding): string =>
    `${(e.baseUrl ?? "").trim()}|${(e.model ?? "").trim()}|${e.apiKey ? "set" : "unset"}|${e.dimensions}|${e.timeoutMs}`;
  let lastEmbeddingKey = embeddingKey(config.recall.embedding);

  // 通用 LLM 调用器（提取/巩固/技能合成共用；复用 DSH 模型栈）
  const makeLlmCall = (purpose: string, maxTokens: number) =>
    async (input: { system: string; user: string; sessionId?: string; signal: AbortSignal }): Promise<string> => {
      const assembler = new BlockAssembler();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = {
        messages: [
          createUserMessage({
            content: [{ type: "text", text: input.user }],
            // 0.2.0：MessageSource 无公共 "plugin" kind；一次性合成调用即普通 user 输入
            source: { kind: "user" },
          }),
        ],
        system: input.system,
        maxTokens,
        purpose,
        signal: input.signal,
      };
      if (input.sessionId) options.sessionId = input.sessionId;
      // 提取/巩固/技能模型：优先显式配置，其次回退到 DSH 默认模型（agentDefaultModel）
      let provider = config.extract.provider;
      let model = config.extract.model;
      if (!provider || !model) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dm = (ctx as any).get?.("agentDefaultModel");
          const sel = dm?.currentSelection?.();
          if (sel && typeof sel.provider === "string" && typeof sel.model === "string") {
            provider = provider || sel.provider;
            model = model || sel.model;
          }
        } catch {
          /* 无默认模型则保持未配置 */
        }
      }
      if (provider) options.provider = provider;
      if (model) options.model = model;
      for await (const chunk of ctx.llm.stream(options)) {
        input.signal.throwIfAborted();
        assembler.push(chunk);
      }
      return assembler
        .blocks()
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    };
  const extractLlm = makeLlmCall("memory-extract", extractSettings.maxOutputTokens);

  let extractor = new Extractor(store, extractSettings, async ({ system, user, sessionId, signal }) => {
    if (config.debug) {
      console.log("[dsh-self-improved] extract llm input:", typeof user, "len:", String(user).length, "session:", sessionId);
    }
    return extractLlm({ system, user, sessionId, signal });
  }, embeddingProvider);
  installCapture(ctx, store, { enabled: () => readModule("capture") }, () => {
    if (!extractSettings.enabled) return;
    const result = extractor.pump();
    if (extractSettings.flushDrain) return result;
    result.catch((error) => console.warn("[dsh-self-improved] extract pump error:", String(error)));
  });
  log("capture + extract installed");

  // 定时进化管线（dsh-schedule 不在 headless base 装配中，用进程内定时器）
  const consolidateLlm = makeLlmCall("memory-consolidate", 2000);
  let consolidator = new Consolidator(
    store,
    {
      sceneMaxMemories: config.consolidate.sceneMaxMemories,
      personaMaxMemories: config.consolidate.personaMaxMemories,
      sceneBatchSize: config.consolidate.sceneBatchSize,
    },
    async ({ system, user, signal }) => consolidateLlm({ system, user, signal }),
    embeddingProvider,
  );
  const skillLlm = makeLlmCall("memory-skill", 3000);
  let lastEvolveTs = 0;
  /**
   * 进化一轮。
   * heavy=true：执行巩固+技能（LLM 重活）——夜间回顾 / 手动 / 启动补跑用；
   * heavy=false：只做免费维护（衰减+治理）——15 分钟定时轮用。
   * force=true：忽略"无新记忆"跳过条件（手动/夜间/启动）。
   */
  const runEvolution = async (force: boolean, heavy = true): Promise<Record<string, unknown>> => {
    const summary: Record<string, unknown> = { forced: force, heavy };
    const jobs: Array<Promise<unknown>> = [];
    const newest = store.newestMemoryTs();
    const hasNew = newest > lastEvolveTs;
    const doHeavy = heavy && (force || hasNew) && (readModule("consolidate") || readModule("evolve"));
    if (doHeavy && readModule("consolidate")) {
      jobs.push(
        consolidator.consolidate().then((r) => { summary.consolidate = r; }).catch((e) => console.warn("[dsh-self-improved] consolidate error:", String(e))),
      );
    }
    if (doHeavy && readModule("evolve")) {
      jobs.push(
        synthesizeSkills(
          store,
          async ({ system, user, signal }) => skillLlm({ system, user, signal }),
          {
            enabled: config.evolve.skillSynthesis.enabled,
            minImportance: config.evolve.skillSynthesis.minImportance,
            skillsRoot: config.evolve.skillSynthesis.skillsRoot,
            prefix: config.evolve.skillSynthesis.prefix,
            maxSkills: config.evolve.skillSynthesis.maxSkills,
          },
          config.evolve.skillSynthesis.skillsRoot,
        )
          .then((n) => { summary.skills = n; if (n > 0) log("skills synthesized:", n); })
          .catch((e) => console.warn("[dsh-self-improved] skill synthesis error:", String(e))),
      );
    }
    if (heavy && !doHeavy) summary.skipped = "no new memories";
    // 免费维护：衰减 + 成长治理（无 LLM，每轮都做）
    jobs.push(
      Promise.resolve()
        .then(() =>
          applyDecay(store, {
            enabled: config.evolve.decay.enabled,
            minAgeDays: config.evolve.decay.minAgeDays,
            threshold: config.evolve.decay.threshold,
            retentionDays: config.evolve.decay.retentionDays,
            maxActiveMemories: config.evolve.decay.maxActiveMemories,
          }),
        )
        .then((r) => { summary.decay = r; if (r.decayed > 0 || r.deleted > 0) log("decay applied:", JSON.stringify(r)); })
        .catch((e) => console.warn("[dsh-self-improved] decay error:", String(e))),
    );
    jobs.push(
      Promise.resolve()
        .then(() => {
          const g = {
            personaVersions: store.prunePersonaVersions(config.housekeeping.personaVersions),
            scenes: store.pruneScenes(config.housekeeping.maxScenes, config.housekeeping.sceneActiveRatio),
            slices: store.pruneConversationSlices(Date.now() - config.housekeeping.conversationRetentionDays * 86_400_000),
          };
          if (g.personaVersions > 0 || g.scenes > 0 || g.slices > 0) log("housekeeping:", JSON.stringify(g));
          return g;
        })
        .then((g) => { summary.housekeeping = g; })
        .catch((e) => console.warn("[dsh-self-improved] housekeeping error:", String(e))),
    );
    await Promise.allSettled(jobs);
    if (newest > 0) lastEvolveTs = newest;
    return summary;
  };
  // 完整回顾：排空待提取 + 完整进化（巩固/技能/衰减/治理）
  const fullReview = async (reason: string): Promise<Record<string, unknown>> => {
    const pumped = await extractor.pump().catch((e) => {
      console.warn("[dsh-self-improved] review pump error:", String(e));
      return { sessions: 0, memories: 0, skipped: 0, errors: 1 };
    });
    const summary = await runEvolution(true, true);
    log(`review(${reason}) done:`, JSON.stringify({ pumped, ...summary }));
    return { pumped, ...summary };
  };

  // 定时器统一管理：跟随总开关——关闭立即全部停止，重新打开自动恢复武装
  let timer: NodeJS.Timeout | undefined;
  let reviewTimer: NodeJS.Timeout | undefined;
  let startupTimer: NodeJS.Timeout | undefined;
  let startupReviewDone = false;

  const parseHHMM = (s: string): number => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return 22 * 3_600_000; // 非法配置回退 22:00
    return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000;
  };

  // 15 分钟轮：只做"提取 + 免费维护"，不碰 LLM 重活（进化交给夜间回顾/手动/启动补跑）
  const armMaintenanceTimer = (): void => {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (!state.enabled) return;
    timer = setInterval(() => {
      void extractor
        .pump()
        .then(() => runEvolution(false, false))
        .then((s) => {
          if (s.skipped) log("maintenance round (no heavy work)");
        })
        .catch((e) => console.warn("[dsh-self-improved] extract pump error:", String(e)));
    }, config.extract.intervalMinutes * 60_000);
    timer.unref?.();
  };

  // 夜间回顾：每天 config.review.time（默认 22:00）做一次；完成后重新武装下一天
  const armNightlyReview = (): void => {
    if (reviewTimer) clearTimeout(reviewTimer);
    reviewTimer = undefined;
    if (!state.enabled || !config.review.enabled) return;
    const hhmm = parseHHMM(config.review.time);
    const now = new Date();
    const target = new Date(now);
    target.setHours(0, 0, 0, 0);
    target.setTime(target.getTime() + hhmm);
    let diff = target.getTime() - now.getTime();
    if (diff <= 0) diff += 24 * 3_600_000;
    reviewTimer = setTimeout(() => {
      void fullReview("nightly")
        .catch((e) => console.warn("[dsh-self-improved] nightly review error:", String(e)))
        .finally(() => armNightlyReview());
    }, diff);
    reviewTimer.unref?.();
    log("nightly review armed at", config.review.time, "(in", Math.round(diff / 60_000), "min)");
  };

  // 启动补跑：~60s 后若有活跃记忆，做一次完整回顾（重启不丢数据、不用等夜间）；只补跑一次
  const armStartupReview = (): void => {
    if (startupTimer) clearTimeout(startupTimer);
    startupTimer = undefined;
    if (startupReviewDone || !state.enabled) return;
    if (store.newestMemoryTs() <= 0) return;
    startupTimer = setTimeout(() => {
      startupReviewDone = true;
      void fullReview("startup").catch((e) => console.warn("[dsh-self-improved] startup review error:", String(e)));
    }, 60_000);
    startupTimer.unref?.();
  };

  const syncSchedulers = (): void => {
    armMaintenanceTimer();
    armNightlyReview();
    armStartupReview();
  };
  syncSchedulers();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx as any).on("dispose", () => {
    if (timer) clearInterval(timer);
    if (startupTimer) clearTimeout(startupTimer);
    if (reviewTimer) clearTimeout(reviewTimer);
    if (commandsDispose) commandsDispose();
    store.close();
  });
  log("schedulers armed (15min maintenance, nightly review, 60s startup backfill); disabling master switch stops all timers");

  // ④ 记忆工具（M1/M4）：可运行时开关（tools 模块）
  let toolsDispose: (() => void) | null = null;
  const syncTools = (): void => {
    const want = readModule("tools");
    if (want && !toolsDispose) {
      toolsDispose = registerMemoryTools(ctx, store, config.searchLimit);
      log("tools enabled");
    } else if (!want && toolsDispose) {
      toolsDispose();
      toolsDispose = null;
      log("tools disabled");
    }
  };
  syncTools();

  // ⑤ 召回注入（M3）：agent/pre-step 自动注入相关记忆。
  //    recallSettings 原地更新即生效（RecallService 每次检索读字段）；
  //    embedding 端点变化时整个 recall 实例由 ⑦ 重建，注入器持稳定代理不受影响。
  const recallSettings: RecallSettings = {
    strategy: config.recall.strategy === "hybrid" ? "hybrid" : "keyword",
    maxResults: config.recall.maxResults,
    scoreThreshold: config.recall.scoreThreshold,
    timeoutMs: config.recall.timeoutMs,
  };
  let recall = new RecallService(store, recallSettings, embeddingProvider);
  installRecallInjection(ctx, { search: (q, o) => recall.search(q, o) }, {
    enabled: () => readModule("recall"),
    maxHits: config.recall.maxResults,
    maxChars: config.recall.maxInjectChars,
    debug: config.debug,
  });
  log("recall injection installed (strategy:", recallSettings.strategy, ")");

  // ⑥ CLI 命令（M5）：/memory（宿主提供 commands 服务时生效）；跟随总开关热切换注册/注销
  let commandsDispose: (() => void) | null = null;
  const syncCommands = (): void => {
    if (!state.enabled) {
      if (commandsDispose) {
        commandsDispose();
        commandsDispose = null;
        log("/memory command disabled");
      }
      return;
    }
    if (commandsDispose) return;
    commandsDispose = installMemoryCommands(ctx, store, { evolve: () => fullReview("manual"), isEnabled: () => state.enabled });
    if (commandsDispose) {
      log("memory command installed (/memory)");
    } else {
      log("commands service unavailable in this host — skip /memory command");
    }
  };
  syncCommands();

  // ⑦ 热应用（0.2.0）：设置页保存 volatile 字段 → Loader 原地提交进运行 fiber →
  //    loader/volatile-update（只发给本 fiber）→ 重新解析 config 并热应用，无需重启。
  ctx.on("loader/volatile-update", () => {
    config = resolveConfig(rawConfig);
    state.enabled = config.enabled;
    state.modules = { ...config.modules };
    Object.assign(extractSettings, {
      enabled: readModule("extract"),
      intervalMinutes: config.extract.intervalMinutes,
      batchMaxChars: config.extract.batchMaxChars,
      maxOutputTokens: config.extract.maxOutputTokens,
      timeoutMs: config.extract.timeoutMs,
      dedup: config.extract.dedup,
      fallbackOnBadJson: config.extract.fallbackOnBadJson,
      minImportance: config.extract.minImportance,
      flushDrain: config.extract.flushDrain,
    });
    recallSettings.strategy = config.recall.strategy === "hybrid" ? "hybrid" : "keyword";
    recallSettings.maxResults = config.recall.maxResults;
    recallSettings.scoreThreshold = config.recall.scoreThreshold;
    recallSettings.timeoutMs = config.recall.timeoutMs;
    // embedding 端点配置变化 → 重建管线实例（extractor/consolidator/recall 构造时捕获 provider）
    const key = embeddingKey(config.recall.embedding);
    if (key !== lastEmbeddingKey) {
      lastEmbeddingKey = key;
      embeddingProvider = createOpenAiEmbedding(config.recall.embedding);
      extractor = new Extractor(store, extractSettings, async ({ system, user, sessionId, signal }) => {
        if (config.debug) console.log("[dsh-self-improved] extract llm input:", typeof user, "len:", String(user).length, "session:", sessionId);
        return extractLlm({ system, user, sessionId, signal });
      }, embeddingProvider);
      consolidator = new Consolidator(
        store,
        {
          sceneMaxMemories: config.consolidate.sceneMaxMemories,
          personaMaxMemories: config.consolidate.personaMaxMemories,
          sceneBatchSize: config.consolidate.sceneBatchSize,
        },
        async ({ system, user, signal }) => consolidateLlm({ system, user, signal }),
        embeddingProvider,
      );
      recall = new RecallService(store, recallSettings, embeddingProvider);
      log("embedding endpoint changed — pipeline rewired");
    }
    syncTools();
    syncCommands(); // 总开关关闭 → 注销 /memory 命令；打开 → 重新注册
    // 任何运行时配置变化 → 统一重挂功能定时器（关闭总开关=全部定时器立即停止）
    syncSchedulers();
    log("runtime config applied (volatile-update): enabled=", config.enabled, "modules=", JSON.stringify(config.modules));
  });

  // ⑧ 数据通道（0.2.0）：settingsNamespace 已移除，改挂 webServer HTTP 端点。
  //    GET  /api/dsh-self-improved/browser → 记忆快照 JSON
  //    POST /api/dsh-self-improved/action  → {op:...} 操作，响应 {ok, snapshot, detail?}
  //    GET  /api/dsh-self-improved/config  → 设置描述符（value/base/user/revision，apiKey 置空）
  //    POST /api/dsh-self-improved/config  → {ops, expectedRevision} 设置变更（走 SettingsForms.mutate
  //                                          → loader volatile 热应用；revision 冲突返回 409）
  //    官方 configForms 表单在非 loopback 页面被宿主置为 memory 模式（一律 unavailable），
  //    本通道让设置 UI 在 Tailscale/配对访问下照常工作。
  //    路由经静态 inject 的 ctx.webServer 直接注册（webServer 已加入插件 inject 列表；
  //    动态 ctx.inject 子 fiber 冷启动会解析到错误实例/静默 PENDING，勿改回）。
  //    访问栅栏对齐 dsh-usage：loopback 放行，非 loopback 需 remote-web-ui 配对设备。
  {
    // 实例诊断（静态 inject 后 ctx.webServer 即监听实例，不再有双实例问题）
    const isLoopbackRequest = (req: IncomingMessage): boolean => {
      const addr = req.socket.remoteAddress ?? "";
      return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
    };
    const isAllowed = (req: IncomingMessage): boolean => {
      if (isLoopbackRequest(req)) return true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pairing = (ctx as any).get?.("remoteWebUiPairing");
        return typeof pairing?.isPairedDevice === "function" ? pairing.isPairedDevice(req) === true : false;
      } catch {
        return false;
      }
    };
    const writeJson = (res: ServerResponse, status: number, body: unknown): void => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
    };
    const readBody = async (req: IncomingMessage): Promise<string> => {
      let body = "";
      req.setEncoding("utf8");
      for await (const chunk of req) body += chunk;
      return body;
    };
    // 设置表单 HTTP 通道（非 loopback 页面官方 configForms 持久化为 memory、一律 unavailable；
    // 本通道经宿主侧 SettingsForms 读写，配合上方栅栏在 Tailscale/配对访问下可用）。
    // apiKey 以空串下发（留空=保持现值），避免明文回传浏览器。
    const NS = "dsh-self-improved";
    const blankApiKey = (section: unknown): void => {
      if (section !== null && typeof section === "object") {
        const embedding = (section as { recall?: { embedding?: { apiKey?: unknown } } }).recall?.embedding;
        if (embedding && typeof embedding.apiKey === "string") embedding.apiKey = "";
      }
    };
    const describeConfig = (): Record<string, unknown> | null => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings = ctx.settings;
      if (!settings?.describe) return null;
      const row = settings.describe().find((d: { ns: string }) => d.ns === NS);
      if (!row) return null;
      const value = structuredClone(row.value ?? {});
      const base = structuredClone(row.base ?? {});
      const user = structuredClone(row.user ?? {});
      blankApiKey(value);
      blankApiKey(base);
      blankApiKey(user);
      return { ns: row.ns, revision: row.revision, value, base, user, autoGenerate: row.autoGenerate };
    };
    const disposers = [
      ctx.webServer.register({
        kind: "exact",
        path: "/api/dsh-self-improved/config",
        handler: async (req, res) => {
          console.log("[dsh-self-improved] CONFIG handler hit:", req.method);
          if (!isAllowed(req)) return writeJson(res, 403, { ok: false, error: "forbidden" });
          if (req.method === "GET") {
            const descriptor = describeConfig();
            if (!descriptor) return writeJson(res, 404, { ok: false, error: "entry not active" });
            return writeJson(res, 200, { ok: true, descriptor });
          }
          if (req.method !== "POST") return writeJson(res, 405, { ok: false, error: "method not allowed" });
          const settings = ctx.settings;
          if (!settings?.mutate) return writeJson(res, 503, { ok: false, error: "settings service unavailable" });
          try {
            const body = JSON.parse(await readBody(req)) as { ops?: unknown; expectedRevision?: number };
            if (!Array.isArray(body.ops)) return writeJson(res, 400, { ok: false, error: "ops must be an array" });
            await settings.mutate(NS, body.ops, body.expectedRevision);
            const descriptor = describeConfig();
            writeJson(res, 200, { ok: true, descriptor });
          } catch (error) {
            const name = (error as { name?: string }).name ?? "";
            const code = (error as { code?: string }).code ?? "";
            if (name === "SettingsConflictError" || code === "SETTINGS_CONFLICT") {
              return writeJson(res, 409, { ok: false, code: "conflict", error: String((error as Error).message ?? "conflict") });
            }
            writeJson(res, 400, { ok: false, error: String(error) });
          }
        },
      }),
      ctx.webServer.register({
        kind: "exact",
        path: "/api/dsh-self-improved/action",
        handler: async (req, res) => {
          if (!isAllowed(req)) return writeJson(res, 403, { ok: false, error: "forbidden" });
          if (req.method !== "POST") return writeJson(res, 405, { ok: false, error: "method not allowed" });
          let detail: unknown;
          try {
            const action = JSON.parse(await readBody(req)) as Record<string, unknown>;
            // 详情：按需返回完整记忆（快照里内容是截断的）
            if (action.op === "detail" && typeof action.id === "string") {
              detail = store.getMemory(action.id) ?? null;
              return writeJson(res, 200, { ok: true, detail, snapshot: browserSnapshot(store) });
            }
            if (action.op === "forget" && typeof action.id === "string") {
              store.forgetMemory(action.id);
              log("browser action: forget", action.id.slice(0, 8));
            } else if (action.op === "correct" && typeof action.id === "string" && typeof action.content === "string") {
              const old = store.getMemory(action.id);
              if (old) {
                store.insertMemory({ kind: old.kind, content: action.content, importance: old.importance, supersedes: old.id });
                store.setMemoryStatus(old.id, "corrected");
                log("browser action: correct", action.id.slice(0, 8));
              }
            } else if (action.op === "deleteSkill" && typeof action.name === "string") {
              if (deleteSkill(action.name, config.evolve.skillSynthesis.skillsRoot)) {
                log("browser action: deleteSkill", action.name);
              }
            }
          } catch (error) {
            return writeJson(res, 400, { ok: false, error: String(error) });
          }
          writeJson(res, 200, { ok: true, snapshot: browserSnapshot(store) });
        },
      }),
      ctx.webServer.register({
        kind: "exact",
        path: "/api/dsh-self-improved/browser",
        handler: (req, res) => {
          if (!isAllowed(req)) return writeJson(res, 403, { ok: false, error: "forbidden" });
          try {
            writeJson(res, 200, { ok: true, snapshot: browserSnapshot(store) });
          } catch (error) {
            writeJson(res, 500, { ok: false, error: String(error) });
          }
        },
      }),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).on("dispose", () => { for (const d of disposers) { try { d(); } catch { /* noop */ } } });
    log("memory browser HTTP channel ready (/api/dsh-self-improved/*)");
  }

  log("dsh-self-improved 已加载（0.2.0 移植版）");
}
