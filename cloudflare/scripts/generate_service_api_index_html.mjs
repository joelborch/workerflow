#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().slice(0, 10);
}

function renderRow(service) {
  const rank = service.rank ?? "-";
  const connectorName = escapeHtml(service.connectorName ?? "");
  const vendorName = escapeHtml(service.officialVendorName ?? "");
  const authType = escapeHtml(service.authType ?? "unknown");
  const confidence = escapeHtml(service.confidence ?? "unknown");
  const docsUrl = typeof service.bestBaseLink === "string" ? service.bestBaseLink : service.officialApiDocsUrl;
  const docsCell = docsUrl
    ? `<a href="${escapeHtml(docsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(docsUrl)}</a>`
    : "-";

  return `<tr>
<td>${rank}</td>
<td>${connectorName}</td>
<td>${vendorName}</td>
<td>${authType}</td>
<td>${confidence}</td>
<td>${docsCell}</td>
</tr>`;
}

function run() {
  const cloudflareDir = process.cwd();
  const servicesPath = join(cloudflareDir, "connector-registry", "services.json");
  const outputPath = join(cloudflareDir, "..", "docs", "SERVICE_API_INDEX.html");

  const parsed = JSON.parse(readFileSync(servicesPath, "utf8"));
  const services = Array.isArray(parsed.services) ? parsed.services.slice() : [];
  services.sort((a, b) => {
    const aRank = typeof a.rank === "number" ? a.rank : Number.MAX_SAFE_INTEGER;
    const bRank = typeof b.rank === "number" ? b.rank : Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });

  const rows = services.map(renderRow).join("\n");
  const updatedAt = escapeHtml(asDate(parsed.updatedAt ?? "unknown"));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WorkerFlow Service API Index</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --card: #ffffff;
      --text: #122033;
      --muted: #5a6472;
      --accent: #0c7a6a;
      --border: #d8e0ea;
      --hover: #eef6ff;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: radial-gradient(circle at top right, #e5fff2 0%, var(--bg) 50%);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
    }

    main {
      max-width: 1180px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(15, 31, 51, 0.08);
      overflow: hidden;
    }

    header {
      padding: 24px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(90deg, #f6fff9, #f8fbff);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 1.6rem;
      letter-spacing: 0.01em;
    }

    p {
      margin: 0;
      color: var(--muted);
    }

    .toolbar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      background: #fbfdff;
    }

    input,
    select {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      font: inherit;
      min-width: 220px;
      background: #fff;
      color: var(--text);
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
    }

    th,
    td {
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--border);
      padding: 10px 12px;
      font-size: 0.95rem;
    }

    th {
      background: #f3f8ff;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    tbody tr:hover {
      background: var(--hover);
    }

    a {
      color: var(--accent);
      text-decoration: none;
      word-break: break-all;
    }

    a:hover {
      text-decoration: underline;
    }

    .count {
      margin-left: auto;
      color: var(--muted);
      align-self: center;
      font-size: 0.9rem;
    }

    @media (max-width: 720px) {
      body {
        padding: 12px;
      }

      header,
      .toolbar {
        padding: 14px;
      }

      h1 {
        font-size: 1.3rem;
      }

      input,
      select {
        min-width: 100%;
      }

      .count {
        margin-left: 0;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>WorkerFlow Service API Index</h1>
      <p>Generated from <code>cloudflare/connector-registry/services.json</code>. Updated: ${updatedAt}</p>
    </header>
    <section class="toolbar" aria-label="table controls">
      <input id="search" type="search" placeholder="Filter by service/vendor/auth/docs URL" />
      <select id="authFilter">
        <option value="">All auth types</option>
      </select>
      <span class="count" id="count"></span>
    </section>
    <section class="table-wrap">
      <table id="servicesTable">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Connector</th>
            <th>Vendor</th>
            <th>Auth</th>
            <th>Confidence</th>
            <th>Base Docs</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </section>
  </main>
  <script>
    const searchInput = document.getElementById("search");
    const authFilter = document.getElementById("authFilter");
    const countLabel = document.getElementById("count");
    const rows = Array.from(document.querySelectorAll("#servicesTable tbody tr"));

    const authValues = new Set();
    for (const row of rows) {
      authValues.add(row.children[3].textContent.trim());
    }
    for (const auth of Array.from(authValues).sort((a, b) => a.localeCompare(b))) {
      const option = document.createElement("option");
      option.value = auth;
      option.textContent = auth;
      authFilter.appendChild(option);
    }

    function applyFilters() {
      const search = searchInput.value.trim().toLowerCase();
      const auth = authFilter.value;
      let visible = 0;

      for (const row of rows) {
        const text = row.textContent.toLowerCase();
        const authCell = row.children[3].textContent.trim();
        const showBySearch = search.length === 0 || text.includes(search);
        const showByAuth = auth.length === 0 || authCell === auth;
        const show = showBySearch && showByAuth;
        row.style.display = show ? "" : "none";
        if (show) {
          visible += 1;
        }
      }

      countLabel.textContent = \`Showing \${visible} of \${rows.length}\`;
    }

    searchInput.addEventListener("input", applyFilters);
    authFilter.addEventListener("change", applyFilters);
    applyFilters();
  </script>
</body>
</html>
`;

  writeFileSync(outputPath, html, "utf8");
  console.log(`service API index HTML generated: ${outputPath}`);
}

run();
