const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const port = process.env.PORT || 3177;
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const staticDir = path.join(rootDir, "data-builder");

app.use(express.json({ limit: "5mb" }));

function isValidFileName(fileName) {
  return /^[a-z0-9_.-]+\.json$/i.test(fileName);
}

function resolveDataPath(fileName) {
  if (!isValidFileName(fileName)) return null;
  const resolved = path.resolve(dataDir, fileName);
  if (!resolved.startsWith(dataDir + path.sep)) return null;
  return resolved;
}

async function listJsonFiles() {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/data", async (req, res) => {
  try {
    const files = await listJsonFiles();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: "Failed to list data files", detail: err.message });
  }
});

app.get("/api/data/:file", async (req, res) => {
  const filePath = resolveDataPath(req.params.file);
  if (!filePath) {
    return res.status(400).json({ error: "Invalid file name" });
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    const status = err.code === "ENOENT" ? 404 : 500;
    res.status(status).json({ error: "Failed to read data file", detail: err.message });
  }
});

app.put("/api/data/:file", async (req, res) => {
  const filePath = resolveDataPath(req.params.file);
  if (!filePath) {
    return res.status(400).json({ error: "Invalid file name" });
  }

  try {
    const payload = req.body;
    if (payload === undefined) {
      return res.status(400).json({ error: "Missing JSON body" });
    }

    const serialized = JSON.stringify(payload, null, 2);
    await fs.writeFile(filePath, `${serialized}\n`, "utf8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to write data file", detail: err.message });
  }
});

app.use(express.static(staticDir));

app.listen(port, () => {
  console.log(`Data builder server running at http://localhost:${port}/`);
});
