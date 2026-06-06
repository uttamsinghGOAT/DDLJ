const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const CANDIDATES = [
  { party: "Party A", name: "R***-***a" },
  { party: "Party B", name: "A***-***a" },
  { party: "Party C", name: "V***-***h" },
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function defaultDb() {
  return {
    users: [],
    otps: {},
    sessions: {},
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function cleanupExpired(db) {
  const now = Date.now();

  Object.keys(db.otps).forEach((key) => {
    if (db.otps[key].expiresAt <= now) {
      delete db.otps[key];
    }
  });

  Object.keys(db.sessions).forEach((token) => {
    if (db.sessions[token].expiresAt <= now) {
      delete db.sessions[token];
    }
  });
}

function hashAadhaar(aadhaar) {
  return crypto.createHash("sha256").update(aadhaar).digest("hex");
}

function maskAadhaar(last4) {
  return `XXXX XXXX ${last4}`;
}

function publicUser(user) {
  return {
    id: user.id,
    fullname: user.fullname,
    phone: user.phone,
    address: user.address,
    aadhaarMasked: maskAadhaar(user.aadhaarLast4),
    dob: user.dob,
    voterId: user.voterId,
    photo: user.photo,
    voteCompleted: Boolean(user.vote),
    selectedParty: user.vote ? user.vote.party : null,
  };
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function sendOptions(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end();
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  const maxSize = 20 * 1024 * 1024;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxSize) {
      throw createHttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createHttpError(400, "Invalid JSON request body.");
  }
}

function requireFields(body, fields) {
  fields.forEach((field) => {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      throw createHttpError(400, `${field} is required.`);
    }
  });
}

function validateAadhaar(aadhaar) {
  if (!/^\d{12}$/.test(aadhaar)) {
    throw createHttpError(400, "Aadhaar must be 12 digits.");
  }
}

function validatePhone(phone) {
  if (!/^\d{10}$/.test(phone)) {
    throw createHttpError(400, "Phone number must be 10 digits.");
  }
}

function validateDob(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw createHttpError(400, "Date of birth is required.");
  }
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function otpKey(purpose, aadhaarHash) {
  return `${purpose}:${aadhaarHash}`;
}

function setOtp(db, purpose, aadhaarHash) {
  const otp = generateOtp();
  db.otps[otpKey(purpose, aadhaarHash)] = {
    otp,
    verified: false,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return otp;
}

function getOtpRecord(db, purpose, aadhaarHash) {
  const record = db.otps[otpKey(purpose, aadhaarHash)];
  if (!record || record.expiresAt <= Date.now()) {
    throw createHttpError(400, "OTP has expired. Please send a new one.");
  }
  return record;
}

function requireAuth(req, db) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = db.sessions[token];

  if (!token || !session || session.expiresAt <= Date.now()) {
    throw createHttpError(401, "Please login again.");
  }

  const user = db.users.find((entry) => entry.id === session.userId);
  if (!user) {
    throw createHttpError(401, "Please login again.");
  }

  return { token, session, user };
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions[token] = {
    userId,
    verifiedToVote: false,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  return token;
}

function generateVoterId(db) {
  let voterId = "";
  do {
    voterId = crypto.randomBytes(5).toString("hex").toUpperCase();
  } while (db.users.some((user) => user.voterId === voterId));
  return voterId;
}

async function handleApi(req, res, url) {
  const db = readDb();
  cleanupExpired(db);

  if (req.method === "GET" && url.pathname === "/api/health") {
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/candidates") {
    writeDb(db);
    return sendJson(res, 200, { candidates: CANDIDATES });
  }

  if (req.method === "GET" && url.pathname === "/api/results") {
    const results = CANDIDATES.map((candidate) => ({
      ...candidate,
      votes: db.users.filter((user) => user.vote && user.vote.party === candidate.party).length,
    }));
    writeDb(db);
    return sendJson(res, 200, {
      totalVotes: results.reduce((sum, candidate) => sum + candidate.votes, 0),
      results,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/register/send-otp") {
    const body = await readJson(req);
    requireFields(body, ["phone", "aadhaar"]);
    const phone = body.phone.trim();
    const aadhaar = body.aadhaar.trim();
    validatePhone(phone);
    validateAadhaar(aadhaar);

    const aadhaarHash = hashAadhaar(aadhaar);
    if (db.users.some((user) => user.aadhaarHash === aadhaarHash)) {
      throw createHttpError(409, "This Aadhaar is already registered.");
    }

    const demoOtp = setOtp(db, "register", aadhaarHash);
    writeDb(db);
    return sendJson(res, 200, {
      message: "Demo OTP generated.",
      demoOtp,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/register/verify-otp") {
    const body = await readJson(req);
    requireFields(body, ["aadhaar", "otp"]);
    const aadhaar = body.aadhaar.trim();
    const otp = body.otp.trim();
    validateAadhaar(aadhaar);

    const aadhaarHash = hashAadhaar(aadhaar);
    const record = getOtpRecord(db, "register", aadhaarHash);
    if (record.otp !== otp) {
      throw createHttpError(400, "Invalid OTP.");
    }

    record.verified = true;
    writeDb(db);
    return sendJson(res, 200, { message: "OTP verified successfully." });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readJson(req);
    requireFields(body, ["fullname", "phone", "aadhaar", "address", "dob"]);
    const fullname = body.fullname.trim();
    const phone = body.phone.trim();
    const aadhaar = body.aadhaar.trim();
    const address = body.address.trim();
    const dob = body.dob.trim();
    const photo = typeof body.photo === "string" ? body.photo : "";

    validatePhone(phone);
    validateAadhaar(aadhaar);
    validateDob(dob);

    const aadhaarHash = hashAadhaar(aadhaar);
    if (db.users.some((user) => user.aadhaarHash === aadhaarHash)) {
      throw createHttpError(409, "This Aadhaar is already registered.");
    }

    const record = getOtpRecord(db, "register", aadhaarHash);
    if (!record.verified) {
      throw createHttpError(400, "Please verify OTP before registering.");
    }

    const user = {
      id: crypto.randomUUID(),
      fullname,
      phone,
      aadhaarHash,
      aadhaarLast4: aadhaar.slice(-4),
      address,
      dob,
      photo,
      voterId: generateVoterId(db),
      vote: null,
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    delete db.otps[otpKey("register", aadhaarHash)];
    writeDb(db);
    return sendJson(res, 201, {
      message: "Registration successful.",
      user: publicUser(user),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/login/send-otp") {
    const body = await readJson(req);
    requireFields(body, ["aadhaar"]);
    const aadhaar = body.aadhaar.trim();
    validateAadhaar(aadhaar);

    const aadhaarHash = hashAadhaar(aadhaar);
    const user = db.users.find((entry) => entry.aadhaarHash === aadhaarHash);
    if (!user) {
      throw createHttpError(404, "No registered user found for this Aadhaar.");
    }

    const demoOtp = setOtp(db, "login", aadhaarHash);
    writeDb(db);
    return sendJson(res, 200, {
      message: "Demo OTP generated.",
      demoOtp,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJson(req);
    requireFields(body, ["aadhaar", "otp"]);
    const aadhaar = body.aadhaar.trim();
    const otp = body.otp.trim();
    validateAadhaar(aadhaar);

    const aadhaarHash = hashAadhaar(aadhaar);
    const user = db.users.find((entry) => entry.aadhaarHash === aadhaarHash);
    if (!user) {
      throw createHttpError(404, "No registered user found for this Aadhaar.");
    }

    const record = getOtpRecord(db, "login", aadhaarHash);
    if (record.otp !== otp) {
      throw createHttpError(400, "Invalid OTP.");
    }

    delete db.otps[otpKey("login", aadhaarHash)];
    const token = createSession(db, user.id);
    writeDb(db);
    return sendJson(res, 200, {
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const { user } = requireAuth(req, db);
    writeDb(db);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const { token } = requireAuth(req, db);
    delete db.sessions[token];
    writeDb(db);
    return sendJson(res, 200, { message: "Logged out." });
  }

  if (req.method === "POST" && url.pathname === "/api/verify-voter") {
    const { session, user } = requireAuth(req, db);
    const body = await readJson(req);
    requireFields(body, ["voterId", "dob"]);
    const voterId = body.voterId.trim().toUpperCase();
    const dob = body.dob.trim();

    if (user.vote) {
      throw createHttpError(409, "You have already cast your vote.");
    }

    if (user.voterId !== voterId || user.dob !== dob) {
      throw createHttpError(400, "Voter ID or date of birth is incorrect.");
    }

    session.verifiedToVote = true;
    writeDb(db);
    return sendJson(res, 200, { message: "Voter verification successful." });
  }

  if (req.method === "POST" && url.pathname === "/api/vote") {
    const { session, user } = requireAuth(req, db);
    const body = await readJson(req);
    requireFields(body, ["party"]);
    const party = body.party.trim();

    if (!CANDIDATES.some((candidate) => candidate.party === party)) {
      throw createHttpError(400, "Please select a valid party.");
    }

    if (user.vote) {
      throw createHttpError(409, "You have already cast your vote.");
    }

    if (!session.verifiedToVote) {
      throw createHttpError(403, "Please verify your voter ID before voting.");
    }

    user.vote = {
      party,
      votedAt: new Date().toISOString(),
    };
    session.verifiedToVote = false;
    writeDb(db);
    return sendJson(res, 200, {
      message: "Vote successfully submitted.",
      user: publicUser(user),
    });
  }

  writeDb(db);
  return sendJson(res, 404, { error: "API route not found." });
}

function serveStatic(req, res, url) {
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { error: "Bad request path." });
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden." });
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      return sendOptions(res);
    }

    try {
      return await handleApi(req, res, url);
    } catch (error) {
      return sendJson(res, error.status || 500, {
        error: error.status ? error.message : "Server error.",
      });
    }
  }

  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Click2Web demo backend running at http://localhost:${PORT}`);
});
