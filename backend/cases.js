import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { userFromRequest } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const scenariosDir = path.join(__dirname, "scenarios");
const casesFile = path.join(dataDir, "cases.json");
const overridesFile = path.join(dataDir, "overrides.json");
const attemptsFile = path.join(dataDir, "attempts.json");
const sessionsFile = path.join(dataDir, "sessions.json");
const resultsFile = path.join(dataDir, "sessions-results.json");

const METRICS = ["integrity", "trust", "effectiveness"];
const BASE_SCORE = 100;

let chain = Promise.resolve();

function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(dataDir, { recursive: true });
  const temp = `${file}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2));
  await fs.rename(temp, file);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function text(value, max) {
  return String(value || "").trim().slice(0, max);
}

function normalizeCaseDeltas(value) {
  let changed = false;
  if (Array.isArray(value)) {
    value.forEach((item) => {
      changed = normalizeCaseDeltas(item) || changed;
    });
    return changed;
  }
  if (!value || typeof value !== "object") return false;
  if (value.deltas && typeof value.deltas === "object" && !Array.isArray(value.deltas)) {
    METRICS.forEach((key) => {
      const score = Number(value.deltas[key]);
      if (Number.isFinite(score) && score > 0) {
        value.deltas[key] = 0;
        changed = true;
      }
    });
  }
  Object.values(value).forEach((item) => {
    changed = normalizeCaseDeltas(item) || changed;
  });
  return changed;
}

export async function migrateCaseDeltas() {
  const files = [];
  try {
    const scenarioFiles = await fs.readdir(scenariosDir);
    files.push(...scenarioFiles.filter((file) => file.endsWith(".json")).map((file) => path.join(scenariosDir, file)));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  files.push(casesFile, overridesFile);
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (normalizeCaseDeltas(data)) await writeJson(file, data);
  }
}

export function validateCase(body) {
  const title = text(body?.title, 160);
  const field = text(body?.field, 80);
  const summary = text(body?.summary, 600);
  const visibility = body?.visibility === "public" ? "public" : "local";
  if (title.length < 3) throw fail(400, "Назва кейса має містити щонайменше 3 символи.");
  if (field.length < 2) throw fail(400, "Вкажіть галузь або тему кейса.");
  const norms = normalizeNorms(body);
  const timeMode = body?.timeMode === "case" || body?.timeMode === "step" ? body.timeMode : "none";
  const timeLimitSeconds = timeMode === "none" ? 0 : limitSeconds(body?.timeLimitSeconds);
  if (timeMode === "case" && timeLimitSeconds < 60) throw fail(400, "Для всього тесту вкажіть щонайменше одну хвилину.");
  if (timeMode === "step" && timeLimitSeconds < 1) throw fail(400, "Вкажіть час на кожне завдання.");
  if (body?.tree) {
    const tree = validateNode(body.tree, "1", 1);
    return {
      title,
      field,
      summary,
      visibility,
      norms,
      timeMode,
      timeLimitSeconds,
      branching: true,
      depth: Number(body.depth) || treeDepth(tree),
      optionCount: Number(body.optionCount) || (tree.options || []).length,
      tree,
      steps: flattenTree(tree)
    };
  }
  const rawSteps = Array.isArray(body?.steps) ? body.steps.slice(0, 200) : [];
  if (rawSteps.length < 1) throw fail(400, "Додайте хоча б один крок.");
  const steps = rawSteps.map((step, stepIndex) => validateLinearStep(step, stepIndex));
  const stepIds = new Set();
  steps.forEach((step, stepIndex) => {
    if (stepIds.has(step.id)) throw fail(400, `Крок ${stepIndex + 1}: ідентифікатор питання має бути унікальним.`);
    stepIds.add(step.id);
  });
  steps.forEach((step, stepIndex) => {
    step.options.forEach((option, optionIndex) => {
      if (option.nextStepId && !stepIds.has(option.nextStepId)) {
        throw fail(400, `Крок ${stepIndex + 1}: перехід варіанта ${optionIndex + 1} веде до невідомого питання.`);
      }
    });
  });
  return { title, field, summary, visibility, norms, timeMode, timeLimitSeconds, branching: false, steps };
}

function normalizeDraftCase(body) {
  const timeMode = body?.timeMode === "case" || body?.timeMode === "step" ? body.timeMode : "none";
  const timeLimitSeconds = timeMode === "none" ? 0 : limitSeconds(body?.timeLimitSeconds);
  const shared = {
    title: text(body?.title, 160),
    field: text(body?.field, 80),
    summary: text(body?.summary, 600),
    visibility: "local",
    norms: normalizeNorms(body),
    timeMode,
    timeLimitSeconds
  };
  if (body?.tree) {
    const tree = normalizeDraftNode(body.tree, "1", 1) || {
      id: "draft-1",
      label: "1",
      prompt: "",
      options: []
    };
    return {
      ...shared,
      branching: true,
      depth: treeDepth(tree),
      optionCount: tree.options.length,
      tree,
      steps: flattenTree(tree)
    };
  }
  const steps = (Array.isArray(body?.steps) ? body.steps : []).slice(0, 200).map((step, index) => {
    const source = step && typeof step === "object" ? step : {};
    return {
      id: text(source.id, 40) || `step-${index + 1}`,
      prompt: text(source.prompt, 2000),
      options: (Array.isArray(source.options) ? source.options : []).slice(0, 100)
        .map(normalizeDraftOption)
    };
  });
  return { ...shared, branching: false, steps };
}

function normalizeDraftNode(node, label, level) {
  if (!node || typeof node !== "object" || level > 100) return null;
  const rawOptions = (Array.isArray(node.options) ? node.options : []).slice(0, 100);
  return {
    id: text(node.id, 40) || `draft-${label}`,
    label: text(node.label, 64) || label,
    prompt: text(node.prompt, 2000),
    options: rawOptions.map((option, index) => {
      return {
        ...normalizeDraftOption(option),
        next: option?.next ? normalizeDraftNode(option.next, `${label}-${index + 1}`, level + 1) : null
      };
    })
  };
}

function normalizeDraftOption(option, index = 0) {
  const source = option && typeof option === "object" ? option : {};
  const numericDelta = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(-40, Math.min(0, Math.round(number))) : 0;
  };
  const deltaSource = source.deltas && typeof source.deltas === "object" ? source.deltas : {};
  const badges = Array.isArray(source.badges) ? source.badges : String(source.badges || "").split(",");
  const legalRefs = Array.isArray(source.legalRefs) ? source.legalRefs : [];
  const legalTitle = text(source.legalTitle || legalRefs[0]?.title, 160);
  const legalHref = text(source.legalHref || legalRefs[0]?.href, 300);
  return {
    id: text(source.id, 32) || `option-${index + 1}`,
    title: text(source.title, 160),
    text: text(source.text, 800),
    badges: badges.map((badge) => text(badge, 40)).filter(Boolean).slice(0, 4),
    deltas: {
      integrity: numericDelta(deltaSource.integrity ?? source.integrity),
      trust: numericDelta(deltaSource.trust ?? source.trust),
      effectiveness: numericDelta(deltaSource.effectiveness ?? source.effectiveness)
    },
    analysis: text(source.analysis, 2000),
    deferred: text(source.deferred, 2000),
    legal: text(source.legal, 2000),
    legalRefs: legalTitle ? [{ title: legalTitle, href: legalHref }] : [],
    nextStepId: text(source.nextStepId, 40),
    end: source.end === true
  };
}

export function scenarioTimer(scenario) {
  const requested = scenario?.timeMode;
  const mode = requested === "case" || requested === "step"
    ? requested
    : (Number(scenario?.timeLimitSeconds) > 0 ? "case" : "none");
  const seconds = mode === "none" ? 0 : limitSeconds(scenario?.timeLimitSeconds);
  if (mode !== "none" && seconds < 1) return { mode: "none", seconds: 0 };
  return { mode, seconds };
}

function limitSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(180 * 60, Math.round(number));
}

function normalizeNorms(body) {
  return (Array.isArray(body?.norms) ? body.norms : [])
    .map((norm) => ({ title: text(norm?.title, 180), href: text(norm?.href, 300) }))
    .filter((norm) => norm.title)
    .slice(0, 6);
}

function validateLinearStep(step, stepIndex) {
  const prompt = text(step?.prompt, 2000);
  if (prompt.length < 10) throw fail(400, `Крок ${stepIndex + 1}: опишіть ситуацію докладніше.`);
  const rawOptions = Array.isArray(step?.options) ? step.options.slice(0, 100) : [];
  if (rawOptions.length < 2) throw fail(400, `Крок ${stepIndex + 1}: потрібно щонайменше два варіанти.`);
  return {
    id: text(step?.id, 40) || `step-${stepIndex + 1}`,
    prompt,
    options: rawOptions.map((option, optionIndex) => ({
      ...sanitizeOption(option, optionIndex, `Крок ${stepIndex + 1}`),
      nextStepId: text(option?.nextStepId, 40),
      end: option?.end === true
    }))
  };
}

const BRANCH_LETTERS = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ".split("");

function validateNode(node, label, level) {
  if (level > 20) throw fail(400, "Гілка сценарію глибша за 20 етапів.");
  const prompt = text(node?.prompt, 2000);
  if (prompt.length < 10) throw fail(400, `Ситуація ${label}: опишіть її докладніше.`);
  const rawOptions = Array.isArray(node?.options) ? node.options.slice(0, 12) : [];
  if (rawOptions.length < 2) throw fail(400, `Ситуація ${label}: потрібно щонайменше два варіанти.`);
  return {
    id: text(node?.id, 40) || `n-${label}`,
    label: text(node?.label, 64) || label,
    prompt,
    options: rawOptions.map((option, optionIndex) => {
      const clean = sanitizeOption(option, optionIndex, `Ситуація ${label}`);
      const letter = BRANCH_LETTERS[optionIndex] || String(optionIndex + 1);
      const next = option?.next ? validateNode(option.next, `${label}${letter}`, level + 1) : null;
      return { ...clean, next };
    })
  };
}

function sanitizeOption(option, optionIndex, where) {
  const optionTitle = text(option?.title, 160);
  if (optionTitle.length < 2) throw fail(400, `${where}: заповніть назву варіанта ${optionIndex + 1}.`);
  const deltas = {};
  METRICS.forEach((key) => {
    const number = Number(option?.deltas?.[key] ?? option?.[key] ?? 0);
    if (!Number.isFinite(number) || number < -40) {
      throw fail(400, "Зміна шкали має бути числом від -40 до 0.");
    }
    deltas[key] = Math.min(0, Math.round(number));
  });
  const badges = String(option?.badges || "")
    .split(",")
    .map((item) => text(item, 40))
    .filter(Boolean)
    .slice(0, 4);
  const legalRefs = [];
  const legalTitle = text(option?.legalTitle || option?.legalRefs?.[0]?.title, 160);
  const legalHref = text(option?.legalHref || option?.legalRefs?.[0]?.href, 300);
  if (legalTitle) legalRefs.push({ title: legalTitle, href: legalHref });
  return {
    id: text(option?.id, 32) || String.fromCharCode(97 + optionIndex),
    title: optionTitle,
    text: text(option?.text, 800),
    badges,
    deltas,
    analysis: text(option?.analysis, 2000),
    deferred: text(option?.deferred, 2000),
    legal: text(option?.legal, 2000),
    legalRefs
  };
}

function flattenTree(node, list = []) {
  list.push({
    id: node.id,
    prompt: node.prompt,
    options: node.options.map((option) => {
      const { next, ...rest } = option;
      return { ...rest, nextId: next?.id || "" };
    })
  });
  node.options.forEach((option) => {
    if (option.next) flattenTree(option.next, list);
  });
  return list;
}

function treeDepth(node) {
  const below = (node.options || []).map((option) => (option.next ? treeDepth(option.next) : 0));
  return 1 + (below.length ? Math.max(...below) : 0);
}

async function readBuiltin() {
  await fs.mkdir(scenariosDir, { recursive: true });
  let files = [];
  try {
    files = await fs.readdir(scenariosDir);
  } catch {
    files = [];
  }
  const list = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(await fs.readFile(path.join(scenariosDir, file), "utf8"));
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || item.template || !item.id || !Array.isArray(item.steps) || item.steps.length === 0) continue;
        list.push(item);
      }
    } catch {
      continue;
    }
  }
  return list;
}

function applyOverride(scenario, override) {
  if (!override) return scenario;
  return {
    ...scenario,
    ...override,
    id: scenario.id,
    source: "builtin",
    status: "published",
    visibility: "public"
  };
}

export async function loadCatalog() {
  const [builtins, overrides, stored] = await Promise.all([
    readBuiltin(),
    readJson(overridesFile, {}),
    readJson(casesFile, { cases: [] })
  ]);
  builtins.forEach(normalizeCaseDeltas);
  normalizeCaseDeltas(overrides);
  normalizeCaseDeltas(stored);
  const custom = Array.isArray(stored.cases) ? stored.cases : [];
  const official = builtins.map((item) => applyOverride({
    ...item,
    source: "builtin",
    status: "published",
    visibility: "public"
  }, overrides[item.id]));
  const all = [...official, ...custom.filter((item) => item?.id && Array.isArray(item.steps))];
  const byId = new Map(all.map((item) => [item.id, item]));
  const publicList = all
    .filter((item) => item.source === "builtin" || item.status === "published")
    .map(publicView)
    .sort((a, b) => String(a.code || a.id).localeCompare(String(b.code || b.id), "uk"));
  return { all, byId, publicList, custom };
}

function publicView(item) {
  return {
    id: item.id,
    code: item.code,
    title: item.title,
    field: item.field,
    summary: item.summary,
    norms: item.norms || [],
    timeMode: item.timeMode === "case" || item.timeMode === "step" ? item.timeMode : (Number(item.timeLimitSeconds) > 0 ? "case" : "none"),
    timeLimitSeconds: Number(item.timeLimitSeconds) || 0,
    steps: item.steps,
    tree: item.tree || null,
    branching: Boolean(item.branching),
    source: item.source === "builtin" ? "builtin" : "community",
    status: "published"
  };
}

function manageView(item) {
  return {
    ...item,
    steps: item.steps || []
  };
}

function canHost(user, scenario) {
  if (!user || !scenario) return false;
  if (user.role !== "organizer" && user.role !== "superadmin") return false;
  if (user.role === "superadmin") return true;
  if (scenario.source === "builtin" || scenario.status === "published") return true;
  return scenario.ownerId === user.id;
}

export function hostAllowed(user, scenario) {
  return canHost(user, scenario);
}

function owns(user, scenario) {
  return user?.role === "superadmin" || scenario?.ownerId === user?.id;
}

async function readCases() {
  const stored = await readJson(casesFile, { cases: [] });
  return Array.isArray(stored.cases) ? stored.cases : [];
}

export function attachCaseRoutes(app, hooks = {}) {
  async function changed() {
    if (hooks.onChange) await hooks.onChange();
  }

  app.post("/api/cases/drafts", async (req, res) => {
    try {
      const user = await userFromRequest(req);
      if (!user || user.role !== "organizer") {
        res.status(403).json({ message: "Чернетки кейсів зберігає організатор." });
        return;
      }
      const input = normalizeDraftCase(req.body);
      const now = new Date().toISOString();
      const created = {
        id: `case-${crypto.randomBytes(6).toString("hex")}`,
        ...input,
        source: "custom",
        status: "draft",
        ownerId: user.id,
        ownerEmail: user.email,
        createdAt: now,
        updatedAt: now,
        reviewNote: ""
      };
      await enqueue(async () => {
        const catalog = await loadCatalog();
        const cases = await readCases();
        const usedCodes = new Set(catalog.all.map((item) => String(item.code || "").toUpperCase()).filter(Boolean));
        let sequence = catalog.all.reduce((maximum, item) => {
          const match = /^EG-(\d+)$/i.exec(String(item.code || ""));
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 0) + 1;
        let code = `EG-${String(sequence).padStart(2, "0")}`;
        while (usedCodes.has(code)) {
          sequence += 1;
          code = `EG-${String(sequence).padStart(2, "0")}`;
        }
        created.code = code;
        cases.push(created);
        await writeJson(casesFile, { cases });
      });
      await changed();
      res.status(201).json({ case: created });
    } catch (error) {
      console.error("Failed to save case draft:", error);
      res.status(error.status || 500).json({ message: error.message || "Не вдалося зберегти чернетку." });
    }
  });

  app.put("/api/cases/:id/draft", async (req, res) => {
    try {
      const user = await userFromRequest(req);
      if (!user || user.role !== "organizer") {
        res.status(403).json({ message: "Чернетки кейсів зберігає організатор." });
        return;
      }
      const input = normalizeDraftCase(req.body);
      const catalog = await loadCatalog();
      const current = catalog.byId.get(req.params.id);
      if (!current || current.source !== "custom" || current.ownerId !== user.id) {
        res.status(404).json({ message: "Чернетку не знайдено." });
        return;
      }
      const updated = await enqueue(async () => {
        const cases = await readCases();
        const target = cases.find((item) => item.id === current.id && item.ownerId === user.id);
        if (!target) throw fail(404, "Чернетку не знайдено.");
        Object.assign(target, input, {
          status: "draft",
          visibility: "local",
          updatedAt: new Date().toISOString()
        });
        await writeJson(casesFile, { cases });
        return target;
      });
      await changed();
      res.json({ case: updated });
    } catch (error) {
      console.error("Failed to update case draft:", error);
      res.status(error.status || 500).json({ message: error.message || "Не вдалося оновити чернетку." });
    }
  });

  app.get("/api/cases/manage", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || (user.role !== "organizer" && user.role !== "superadmin")) {
      res.status(403).json({ message: "Керувати кейсами можуть організатор і супер-адмін." });
      return;
    }
    const catalog = await loadCatalog();
    const cases = user.role === "superadmin"
      ? catalog.all.map(manageView)
      : catalog.custom.filter((item) => item.ownerId === user.id).map(manageView);
    res.json({ cases });
  });

  app.get("/api/cases/moderation", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || user.role !== "superadmin") {
      res.status(403).json({ message: "Модерація доступна лише супер-адміну." });
      return;
    }
    const cases = await readCases();
    cases.forEach(normalizeCaseDeltas);
    const queue = cases
      .filter((item) => item.visibility === "public" || item.status === "pending" || item.status === "published" || item.status === "rejected")
      .map(manageView)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    res.json({ cases: queue });
  });

  app.post("/api/cases", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || user.role !== "organizer") {
      res.status(403).json({ message: "Власні кейси створює організатор." });
      return;
    }
    try {
      const isDraft = req.body?.draft === true;
      const input = isDraft ? normalizeDraftCase(req.body) : validateCase(req.body);
      const now = new Date().toISOString();
      const status = isDraft ? "draft" : input.visibility === "public" ? "pending" : "local";
      const created = {
        id: `case-${crypto.randomBytes(6).toString("hex")}`,
        ...input,
        source: "custom",
        status,
        ownerId: user.id,
        ownerEmail: user.email,
        createdAt: now,
        updatedAt: now,
        reviewNote: ""
      };
      await enqueue(async () => {
        const catalog = await loadCatalog();
        const cases = await readCases();
        const usedCodes = new Set(catalog.all.map((item) => String(item.code || "").toUpperCase()).filter(Boolean));
        let sequence = catalog.all.reduce((maximum, item) => {
          const match = /^EG-(\d+)$/i.exec(String(item.code || ""));
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 0) + 1;
        let code = `EG-${String(sequence).padStart(2, "0")}`;
        while (usedCodes.has(code)) {
          sequence += 1;
          code = `EG-${String(sequence).padStart(2, "0")}`;
        }
        created.code = code;
        cases.push(created);
        await writeJson(casesFile, { cases });
      });
      await changed();
      res.status(201).json({ case: created });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || "Не вдалося зберегти кейс." });
    }
  });

  app.put("/api/cases/:id", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || (user.role !== "organizer" && user.role !== "superadmin")) {
      res.status(403).json({ message: "Редагувати кейси можуть організатор і супер-адмін." });
      return;
    }
    try {
      const isDraft = req.body?.draft === true;
      const input = isDraft ? normalizeDraftCase(req.body) : validateCase(req.body);
      const catalog = await loadCatalog();
      const current = catalog.byId.get(req.params.id);
      if (!current) {
        res.status(404).json({ message: "Кейс не знайдено." });
        return;
      }
      if (!owns(user, current) && current.source !== "builtin") {
        res.status(403).json({ message: "Цей кейс може редагувати його автор або супер-адмін." });
        return;
      }
      if (current.source === "builtin" && user.role !== "superadmin") {
        res.status(403).json({ message: "Вбудовані сценарії редагує супер-адмін." });
        return;
      }
      if (current.source === "builtin") {
        if (isDraft) throw fail(400, "Вбудований кейс не можна зберегти як чернетку.");
        const override = { ...input, visibility: "public" };
        await enqueue(async () => {
          const overrides = await readJson(overridesFile, {});
          overrides[current.id] = override;
          await writeJson(overridesFile, overrides);
        });
        await changed();
        res.json({ case: { ...current, ...override, id: current.id, source: "builtin", status: "published" } });
        return;
      }
      const updated = await enqueue(async () => {
        const cases = await readCases();
        const target = cases.find((item) => item.id === current.id);
        if (!target) throw fail(404, "Кейс не знайдено.");
        target.title = input.title;
        target.field = input.field;
        target.summary = input.summary;
        target.norms = input.norms;
        target.timeMode = input.timeMode || "none";
        target.timeLimitSeconds = input.timeLimitSeconds || 0;
        target.steps = input.steps;
        target.tree = input.tree || null;
        target.branching = Boolean(input.branching);
        target.depth = input.depth || 0;
        target.optionCount = input.optionCount || 0;
        target.visibility = isDraft ? "local" : input.visibility;
        if (isDraft) {
          target.status = "draft";
        } else if (user.role === "superadmin") {
          target.status = input.visibility === "local"
            ? "local"
            : (req.body?.status === "published" || req.body?.status === "rejected" || req.body?.status === "pending" ? req.body.status : target.status);
          if (target.visibility === "public" && target.status === "local") target.status = "pending";
        } else {
          target.status = input.visibility === "public" ? "pending" : "local";
        }
        target.updatedAt = new Date().toISOString();
        await writeJson(casesFile, { cases });
        return target;
      });
      await changed();
      res.json({ case: updated });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || "Не вдалося оновити кейс." });
    }
  });

  app.delete("/api/cases/:id", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || (user.role !== "organizer" && user.role !== "superadmin")) {
      res.status(403).json({ message: "Видаляти кейси можуть організатор і супер-адмін." });
      return;
    }
    try {
      const catalog = await loadCatalog();
      const current = catalog.byId.get(req.params.id);
      if (!current) {
        res.status(404).json({ message: "Кейс не знайдено." });
        return;
      }
      if (current.source !== "custom" || (user.role !== "superadmin" && current.ownerId !== user.id)) {
        res.status(403).json({ message: "Можна видалити лише власний кейс." });
        return;
      }
      await enqueue(async () => {
        const cases = await readCases();
        await writeJson(casesFile, { cases: cases.filter((item) => item.id !== req.params.id) });
      });
      await changed();
      res.json({ deleted: true });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || "Не вдалося видалити кейс." });
    }
  });

  app.delete("/api/cases/:id/draft", async (req, res) => {
    try {
      const user = await userFromRequest(req);
      if (!user || user.role !== "organizer") {
        res.status(403).json({ message: "Чернетки може видаляти лише організатор-власник." });
        return;
      }
      const catalog = await loadCatalog();
      const current = catalog.byId.get(req.params.id);
      if (!current || current.status !== "draft" || current.source !== "custom" || current.ownerId !== user.id) {
        res.status(404).json({ message: "Чернетку не знайдено." });
        return;
      }
      await enqueue(async () => {
        const cases = await readCases();
        const target = cases.find((item) => item.id === req.params.id && item.ownerId === user.id && item.status === "draft");
        if (!target) throw fail(404, "Чернетку не знайдено.");
        await writeJson(casesFile, { cases: cases.filter((item) => item !== target) });
      });
      await changed();
      res.json({ deleted: true });
    } catch (error) {
      console.error("Failed to delete case draft:", error);
      res.status(error.status || 500).json({ message: error.message || "Не вдалося видалити чернетку." });
    }
  });

  app.post("/api/cases/:id/moderate", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || user.role !== "superadmin") {
      res.status(403).json({ message: "Рішення про публікацію ухвалює супер-адмін." });
      return;
    }
    const decision = String(req.body?.status || "");
    if (!["published", "rejected", "pending"].includes(decision)) {
      res.status(400).json({ message: "Невідоме рішення модерації." });
      return;
    }
    try {
      const updated = await enqueue(async () => {
        const cases = await readCases();
        const target = cases.find((item) => item.id === req.params.id);
        if (!target) throw fail(404, "Кейс не знайдено.");
        target.status = decision;
        target.visibility = decision === "published" || target.visibility === "public" ? "public" : target.visibility;
        if (decision !== "published" && decision !== "pending" && decision !== "rejected") target.visibility = "local";
        target.reviewNote = text(req.body?.note, 400);
        target.updatedAt = new Date().toISOString();
        await writeJson(casesFile, { cases });
        return target;
      });
      await changed();
      res.json({ case: updated });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || "Не вдалося оновити статус." });
    }
  });

  app.post("/api/attempts", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user) {
      res.status(401).json({ message: "Гість може пройти кейс, але результат не зберігається." });
      return;
    }
    const catalog = await loadCatalog();
    const scenario = catalog.byId.get(String(req.body?.scenarioId || ""));
    if (!scenario) {
      res.status(404).json({ message: "Сценарій для збереження не знайдено." });
      return;
    }
    const scored = scoreChoices(scenario, req.body?.choices);
    if (!scored.history.length) {
      res.status(400).json({ message: "Немає зафіксованих рішень для збереження." });
      return;
    }
    const attempt = {
      id: crypto.randomUUID(),
      userId: user.id,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      scenarioCode: scenario.code,
      mode: req.body?.mode === "group" ? "group" : "solo",
      createdAt: new Date().toISOString(),
      scores: scored.scores,
      history: scored.history
    };
    await enqueue(async () => {
      const stored = await readJson(attemptsFile, { attempts: [] });
      const attempts = Array.isArray(stored.attempts) ? stored.attempts : [];
      attempts.unshift(attempt);
      await writeJson(attemptsFile, { attempts: attempts.slice(0, 1000) });
    });
    res.status(201).json({ attempt });
  });

  app.get("/api/attempts", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user) {
      res.status(401).json({ message: "Історія доступна після входу." });
      return;
    }
    const stored = await readJson(attemptsFile, { attempts: [] });
    const attempts = (Array.isArray(stored.attempts) ? stored.attempts : []).filter((item) => item.userId === user.id);
    res.json({ attempts });
  });

  app.get("/api/sessions", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || (user.role !== "organizer" && user.role !== "superadmin")) {
      res.status(403).json({ message: "Зведення занять доступне організатору та супер-адміну." });
      return;
    }
    const stored = await readJson(sessionsFile, { sessions: [] });
    const sessions = (Array.isArray(stored.sessions) ? stored.sessions : []).filter((item) => (
      user.role === "superadmin" || item.hostId === user.id
    ));
    res.json({ sessions });
  });

  app.get("/api/sessions/:code", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user || (user.role !== "organizer" && user.role !== "superadmin")) {
      res.status(403).json({ message: "Зведення сесії доступне організатору та супер-адміну." });
      return;
    }
    const code = String(req.params.code || "").trim().toUpperCase();
    const stored = await readJson(sessionsFile, { sessions: [] });
    const session = (Array.isArray(stored.sessions) ? stored.sessions : []).find((item) => (
      item.code === code && (user.role === "superadmin" || item.hostId === user.id)
    ));
    if (!session) {
      res.status(404).json({ message: "Сесію не знайдено у збережених даних." });
      return;
    }
    res.json({ session });
  });

  app.get("/api/rooms/:code/results", async (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) {
      res.status(400).json({ message: "Код кімнати не вказано." });
      return;
    }
    const stored = await readJson(resultsFile, {});
    const rooms = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    const room = rooms[code] || null;
    const participants = room?.participants || [];
    console.log("Room results route:", {
      code,
      participantCount: participants.length,
      finishedCount: room?.finishedCount || participants.filter((participant) => participant.status === "completed").length,
      participants
    });
    res.json({ room, participants, phase: room?.phase || "lobby" });
  });
}

export async function appendSession(record) {
  const session = {
    id: crypto.randomUUID(),
    code: record.code,
    scenarioId: record.scenarioId,
    scenarioTitle: record.scenarioTitle || "",
    scenarioCode: record.scenarioCode || "",
    groupName: record.groupName || "",
    groupLabel: record.groupLabel || "",
    named: Boolean(record.named),
    hostId: record.hostId,
    createdAt: record.createdAt,
    finishedAt: new Date().toISOString(),
    participantPeak: Number(record.participantPeak) || 0,
    steps: Array.isArray(record.steps) ? record.steps : [],
    participants: Array.isArray(record.participants) ? record.participants : []
  };
  await enqueue(async () => {
    const stored = await readJson(sessionsFile, { sessions: [] });
    const sessions = Array.isArray(stored.sessions) ? stored.sessions : [];
    sessions.unshift(session);
    await writeJson(sessionsFile, { sessions: sessions.slice(0, 200) });
  });
  return session;
}

export async function upsertSession(record) {
  const session = {
    id: record.id || crypto.randomUUID(),
    code: record.code,
    scenarioId: record.scenarioId,
    scenarioTitle: record.scenarioTitle || "",
    scenarioCode: record.scenarioCode || "",
    groupName: record.groupName || "",
    groupLabel: record.groupLabel || "",
    named: Boolean(record.named),
    hostId: record.hostId,
    createdAt: record.createdAt,
    finishedAt: record.phase === "done" ? new Date().toISOString() : (record.finishedAt || null),
    participantPeak: Number(record.participantPeak) || 0,
    steps: Array.isArray(record.steps) ? record.steps : [],
    participants: Array.isArray(record.participants) ? record.participants : [],
    phase: record.phase || "lobby"
  };
  await enqueue(async () => {
    const stored = await readJson(sessionsFile, { sessions: [] });
    const sessions = Array.isArray(stored.sessions) ? stored.sessions : [];
    const existingIndex = sessions.findIndex((item) => item.code === record.code);
    if (existingIndex >= 0) {
      session.id = sessions[existingIndex].id;
      sessions[existingIndex] = {
        ...sessions[existingIndex],
        ...session
      };
    } else {
      sessions.unshift(session);
    }
    await writeJson(sessionsFile, { sessions: sessions.slice(0, 200) });
  });
  return session;
}

export async function ensureRoomResultsFile() {
  await enqueue(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.access(resultsFile);
    } catch {
      await writeJson(resultsFile, {});
    }
  });
}

export async function upsertRoomResults(record) {
  const result = {
    code: record.code,
    scenarioId: record.scenarioId,
    scenarioTitle: record.scenarioTitle || "",
    phase: record.phase || "lobby",
    participantPeak: Number(record.participantPeak) || 0,
    finishedCount: Array.isArray(record.participants)
      ? record.participants.filter((participant) => participant.status === "completed").length
      : 0,
    steps: Array.isArray(record.steps) ? record.steps : [],
    participants: Array.isArray(record.participants) ? record.participants : [],
    updatedAt: new Date().toISOString()
  };
  await enqueue(async () => {
    const stored = await readJson(resultsFile, {});
    const rooms = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    rooms[result.code] = result;
    await writeJson(resultsFile, rooms);
    console.log("Room results JSON written:", {
      file: resultsFile,
      code: result.code,
      participantCount: result.participants.length,
      finishedCount: result.finishedCount
    });
  });
  return result;
}

function scoreChoices(scenario, choices) {
  const scores = { integrity: BASE_SCORE, trust: BASE_SCORE, effectiveness: BASE_SCORE };
  const history = [];
  const list = Array.isArray(choices) ? choices.slice(0, 40) : [];
  list.forEach((choice) => {
    const step = (scenario.steps || []).find((item) => item.id === choice?.stepId);
    const option = step?.options?.find((item) => item.id === choice?.optionId);
    if (!step || !option) return;
    METRICS.forEach((key) => {
      scores[key] = clamp(scores[key] + Number(option.deltas?.[key] || 0));
    });
    const best = Math.max(...step.options.map((item) => Number(item.deltas?.integrity || 0)));
    history.push({
      stepId: step.id,
      prompt: step.prompt,
      mistake: Number(option.deltas?.integrity || 0) < best,
      option,
      scores: { ...scores }
    });
  });
  return { scores, history };
}
