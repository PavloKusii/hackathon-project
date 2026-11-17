import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");
const secretFile = path.join(dataDir, "jwt.secret");

const ROLES = ["participant", "organizer", "superadmin"];
const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = "7d";
const DUMMY_HASH = bcrypt.hashSync("not-a-user", BCRYPT_ROUNDS);

const attempts = new Map();
let writeChain = Promise.resolve();

function enqueue(task) {
  const run = writeChain.then(task, task);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

function validPassword(password) {
  const value = String(password || "");
  if (value.length < 8 || value.length > 72) return false;
  if (!/[a-zA-Zа-яА-ЯіІїЇєЄґҐ]/.test(value)) return false;
  if (!/\d/.test(value)) return false;
  return true;
}

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function validLogin(login) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(login);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    login: user.login || user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

async function readUsers() {
  try {
    const raw = await fs.readFile(usersFile, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await fs.mkdir(dataDir, { recursive: true });
  const temp = `${usersFile}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ users }, null, 2));
  await fs.rename(temp, usersFile);
}

async function tokenSecret() {
  if (process.env.EG_JWT_SECRET) return process.env.EG_JWT_SECRET;
  try {
    const saved = await fs.readFile(secretFile, "utf8");
    if (saved.trim()) return saved.trim();
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  const created = crypto.randomBytes(32).toString("hex");
  await fs.writeFile(secretFile, created, { flag: "wx" }).catch(async () => {
    const saved = await fs.readFile(secretFile, "utf8");
    if (!saved.trim()) throw new Error("secret");
  });
  try {
    const saved = await fs.readFile(secretFile, "utf8");
    return saved.trim() || created;
  } catch {
    return created;
  }
}

let secretPromise;

function getSecret() {
  if (!secretPromise) secretPromise = tokenSecret();
  return secretPromise;
}

function signUser(user) {
  return getSecret().then((secret) => jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, { expiresIn: TOKEN_TTL }));
}

function locked(email) {
  const row = attempts.get(email);
  if (!row) return false;
  if (Date.now() > row.until) {
    attempts.delete(email);
    return false;
  }
  return row.count >= 8;
}

function markFailure(email) {
  const row = attempts.get(email);
  if (!row || Date.now() > row.until) {
    attempts.set(email, { count: 1, until: Date.now() + 15 * 60 * 1000 });
    return;
  }
  row.count += 1;
}

function clearFailures(email) {
  attempts.delete(email);
}

async function ensureSuperadmin() {
  await enqueue(async () => {
    const users = await readUsers();
    if (users.some((user) => user.role === "superadmin")) return;
    const email = normalizeEmail(process.env.EG_SUPERADMIN_EMAIL || "admin@ethical-guard.local");
    const password = process.env.EG_SUPERADMIN_PASSWORD || "Guard-Admin-2026";
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    users.push({
      id: crypto.randomUUID(),
      email,
      login: "admin",
      passwordHash,
      role: "superadmin",
      createdAt: new Date().toISOString()
    });
    await writeUsers(users);
  });
}

function bearer(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

export async function userFromToken(token) {
  if (!token) return null;
  try {
    const secret = await getSecret();
    const payload = jwt.verify(token, secret);
    const users = await readUsers();
    return users.find((user) => user.id === payload.sub) || null;
  } catch {
    return null;
  }
}

export async function userFromRequest(req) {
  return userFromToken(bearer(req));
}

export async function attachAuth(app) {
  await fs.mkdir(dataDir, { recursive: true });
  await getSecret();
  await ensureSuperadmin();

  app.post("/api/auth/register", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const passwordConfirm = String(req.body?.passwordConfirm || "");
    const requestedLogin = normalizeLogin(req.body?.login);
    const role = String(req.body?.role || "");
    if (role === "superadmin" || !["participant", "organizer"].includes(role)) {
      res.status(400).json({ message: "Оберіть роль учасника або організатора. Супер-адмін не створюється через публічну реєстрацію." });
      return;
    }
    if (!validEmail(email)) {
      res.status(400).json({ message: "Вкажіть коректну електронну пошту." });
      return;
    }
    if (requestedLogin && !validLogin(requestedLogin)) {
      res.status(400).json({ message: "Логін: 3–32 символи, латиниця, цифри, крапка, дефіс або підкреслення." });
      return;
    }
    if (!validPassword(password)) {
      res.status(400).json({ message: "Пароль має містити від 8 до 72 символів, літеру та цифру." });
      return;
    }
    if (password !== passwordConfirm) {
      res.status(400).json({ message: "Підтвердження пароля не збігається." });
      return;
    }
    try {
      const user = await enqueue(async () => {
        const users = await readUsers();
        let safeLogin = requestedLogin || email.split("@")[0].replace(/[^a-z0-9._-]/g, "").slice(0, 32);
        if (!validLogin(safeLogin)) safeLogin = `user${crypto.randomBytes(3).toString("hex")}`;
        if (users.some((item) => item.email === email)) {
          const error = new Error("taken");
          error.code = "taken";
          throw error;
        }
        if (users.some((item) => normalizeLogin(item.login) === safeLogin)) {
          if (requestedLogin) {
            const error = new Error("taken");
            error.code = "taken";
            throw error;
          }
          safeLogin = `${safeLogin.slice(0, 24)}${crypto.randomBytes(2).toString("hex")}`;
        }
        const created = {
          id: crypto.randomUUID(),
          email,
          login: safeLogin,
          passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
          role,
          createdAt: new Date().toISOString()
        };
        users.push(created);
        await writeUsers(users);
        return created;
      });
      const token = await signUser(user);
      res.status(201).json({ token, user: publicUser(user) });
    } catch (error) {
      if (error.code === "taken") {
        res.status(409).json({ message: "Обліковий запис із цією поштою або логіном вже існує." });
        return;
      }
      res.status(500).json({ message: "Не вдалося створити обліковий запис." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const identifier = normalizeEmail(req.body?.email || req.body?.login);
    const password = String(req.body?.password || "");
    if (!identifier || !password) {
      res.status(400).json({ message: "Вкажіть пошту або логін і пароль." });
      return;
    }
    if (locked(identifier)) {
      res.status(429).json({ message: "Забагато спроб входу. Спробуйте пізніше." });
      return;
    }
    const users = await readUsers();
    const user = users.find((item) => item.email === identifier || normalizeLogin(item.login) === identifier);
    const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !matches) {
      markFailure(identifier);
      res.status(401).json({ message: "Невірна пошта, логін або пароль." });
      return;
    }
    clearFailures(identifier);
    const token = await signUser(user);
    res.json({ token, user: publicUser(user) });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await userFromRequest(req);
    if (!user) {
      res.status(401).json({ message: "Потрібен вхід." });
      return;
    }
    res.json({ user: publicUser(user) });
  });

  app.get("/api/admin/users", async (req, res) => {
    const actor = await userFromRequest(req);
    if (!actor || actor.role !== "superadmin") {
      res.status(403).json({ message: "Цей розділ доступний лише супер-адміну." });
      return;
    }
    const users = await readUsers();
    res.json({ users: users.map(publicUser) });
  });

  app.patch("/api/admin/users/:id/role", async (req, res) => {
    const actor = await userFromRequest(req);
    if (!actor || actor.role !== "superadmin") {
      res.status(403).json({ message: "Змінювати ролі може лише супер-адмін." });
      return;
    }
    const role = String(req.body?.role || "");
    if (!ROLES.includes(role)) {
      res.status(400).json({ message: "Невідома роль." });
      return;
    }
    try {
      const updated = await enqueue(async () => {
        const users = await readUsers();
        const target = users.find((item) => item.id === req.params.id);
        if (!target) {
          const error = new Error("missing");
          error.code = "missing";
          throw error;
        }
        const superadmins = users.filter((item) => item.role === "superadmin");
        if (target.role === "superadmin" && role !== "superadmin" && superadmins.length < 2) {
          const error = new Error("last");
          error.code = "last";
          throw error;
        }
        target.role = role;
        await writeUsers(users);
        return target;
      });
      res.json({ user: publicUser(updated) });
    } catch (error) {
      if (error.code === "missing") {
        res.status(404).json({ message: "Користувача не знайдено." });
        return;
      }
      if (error.code === "last") {
        res.status(400).json({ message: "У системі має лишитися хоча б один супер-адмін." });
        return;
      }
      res.status(500).json({ message: "Не вдалося змінити роль." });
    }
  });
}
