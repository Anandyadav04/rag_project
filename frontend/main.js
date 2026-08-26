// main.js – Legal RAG Intelligence Frontend

const API_BASE = "http://127.0.0.1:8000";
let selectedDocId = null;
let currentDocName = null;

// ── Helpers ──────────────────────────────────────────────
function setStatus(id, message, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = "status-msg" + (type ? " " + type : "");
}

function show(id)  { document.getElementById(id)?.classList.remove("hidden"); }
function hide(id)  { document.getElementById(id)?.classList.add("hidden"); }

function setLoading(btnId, spinnerId, loading) {
  const btn = document.getElementById(btnId);
  const spinner = document.getElementById(spinnerId);
  if (btn) btn.disabled = loading;
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

// ── 1. Upload ────────────────────────────────────────────
const uploadForm = document.getElementById("upload-form");
if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];
    if (!file) return setStatus("upload-status", "Please select a file first.", "error");

    const formData = new FormData();
    formData.append("file", file);

    setStatus("upload-status", "Uploading…", "loading");
    setLoading("upload-btn", "upload-spinner", true);

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
      setStatus("upload-status", `✅ Uploaded: ${data.document?.filename || data.id || "success"}`, "success");
      fileInput.value = "";
      loadDocuments();
    } catch (err) {
      setStatus("upload-status", "❌ " + err.message, "error");
    } finally {
      setLoading("upload-btn", "upload-spinner", false);
    }
  });
}

// ── 2. Document list ─────────────────────────────────────
async function loadDocuments() {
  const container = document.getElementById("documents-list");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error("Failed to fetch documents");
    const docs = await res.json();

    if (!docs.length) {
      container.innerHTML = '<p class="empty-state">No documents uploaded yet.</p>';
      return;
    }

    container.innerHTML = docs.map(doc => `
      <div class="doc-item" data-id="${doc.id}">
        <div class="doc-info">
          <span class="doc-name">${doc.filename}</span>
          <span class="doc-meta">
            <span class="status-badge status-${doc.status}">${doc.status}</span>
            &nbsp;·&nbsp;${doc.total_pages || 0} pages
          </span>
        </div>
        <div class="doc-actions">
          <button class="btn btn-action" onclick="analyzeDocument('${doc.id}', '${doc.filename.replace(/'/g, "\\'")}')">Analyze</button>
          <button class="btn btn-action" onclick="showQuerySection('${doc.id}', '${doc.filename.replace(/'/g, "\\'")}')">Query</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-state" style="color:var(--danger)">⚠️ Backend unreachable – is the server running on port 8000?</p>`;
    console.error("loadDocuments error:", err);
  }
}

// ── 3. Analyze ───────────────────────────────────────────
async function analyzeDocument(id, filename) {
  selectedDocId = id;
  currentDocName = filename || null;
  show("analysis-section");
  setStatus("analysis-status", "Running 41-category CUAD analysis… (this may take a minute)", "loading");
  document.getElementById("analysis-result").innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/documents/${id}/analyze`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

    const clauses = data.extracted_clauses || [];
    document.getElementById("analysis-result").innerHTML = renderAnalysisResult(data, clauses);
    setStatus("analysis-status", `✅ Done – ${clauses.length} clause(s) extracted`, "success");
  } catch (err) {
    setStatus("analysis-status", "❌ " + err.message, "error");
  }
}

function renderAnalysisResult(data, clauses) {
  if (!clauses.length) {
    return `
      <div class="no-clauses">
        <span class="no-clauses-icon">📭</span>
        <p>No clauses were extracted from this document.</p>
        <p style="font-size:0.8rem; margin-top:0.3rem;">The document may not contain standard legal contract language.</p>
      </div>
    `;
  }

  const summaryHtml = `
    <div class="analysis-summary">
      <span class="analysis-summary-icon">⚖️</span>
      <p class="analysis-summary-text">
        Analyzed <strong>${data.total_categories_analyzed}</strong> CUAD categories · Found <strong>${clauses.length}</strong> clause(s)
      </p>
    </div>
  `;

  const cardsHtml = clauses.map((c, i) => {
    const pct = Math.round(c.confidence * 100);
    const level = getConfidenceLevel(c.confidence);
    return `
      <div class="clause-card" style="animation-delay: ${i * 60}ms">
        <div class="clause-card-header">
          <div class="clause-category">
            <span class="clause-category-icon">§</span>
            ${escapeHtml(c.category)}
          </div>
          <span class="clause-confidence-pill ${level}">${pct}%</span>
        </div>
        <div class="clause-card-body">
          <p class="clause-extracted-text">"${escapeHtml(c.extracted_text)}"</p>
        </div>
        ${c.page_number ? `
        <div class="clause-card-footer">
          <span>📍</span> Page ${c.page_number}
        </div>
        ` : ""}
      </div>
    `;
  }).join("");

  return `<div class="analysis-results-container">${summaryHtml}${cardsHtml}</div>`;
}

// ── 4. Query ─────────────────────────────────────────────
function showQuerySection(id, filename) {
  selectedDocId = id;
  currentDocName = filename || null;
  show("query-section");
  document.getElementById("query-input")?.focus();
}

const queryForm = document.getElementById("query-form");
if (queryForm) {
  queryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedDocId) return setStatus("query-status", "Select a document first.", "error");

    const query = document.getElementById("query-input").value.trim();
    if (!query) return;

    setStatus("query-status", "Querying…", "loading");
    setLoading("query-btn", "query-spinner", true);
    document.getElementById("query-result").innerHTML = "";

    try {
      const res = await fetch(`${API_BASE}/documents/${selectedDocId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

      document.getElementById("query-result").innerHTML = renderAnswerCard(data, query);
      setStatus("query-status", "✅ Answer received", "success");
    } catch (err) {
      setStatus("query-status", "❌ " + err.message, "error");
    } finally {
      setLoading("query-btn", "query-spinner", false);
    }
  });
}

// ── Render helpers ────────────────────────────────────────
function getConfidenceLevel(score) {
  if (score >= 0.6) return "high";
  if (score >= 0.25) return "medium";
  return "low";
}

function renderAnswerCard(data, query) {
  const pct = Math.round(data.confidence * 100);
  const level = getConfidenceLevel(data.confidence);
  const pages = (data.page_numbers || []).map(p => `Page ${p}`).join(", ") || "—";
  const docName = currentDocName || "Document";

  return `
    <div class="answer-card">
      <div class="answer-section">
        <div class="answer-label">
          <span class="answer-label-icon">💡</span>
          Answer
        </div>
        <p class="answer-text">${escapeHtml(data.answer)}</p>
      </div>

      <hr class="answer-divider" />

      <div class="answer-source">
        <div class="source-item">
          <span class="source-icon">📄</span>
          <span class="source-value">${escapeHtml(docName)}</span>
        </div>
        <div class="source-item">
          <span class="source-icon">📍</span>
          <span class="source-value">${pages}</span>
        </div>
      </div>

      ${data.exact_evidence_text && data.exact_evidence_text.trim() ? `
      <hr class="answer-divider" />
      <div class="answer-clause">
        <div class="clause-label">
          <span>📜</span> Supporting Clause
        </div>
        <p class="clause-text">"${escapeHtml(data.exact_evidence_text)}"</p>
      </div>
      ` : ""}

      <div class="confidence-section">
        <span class="confidence-label">Confidence</span>
        <div class="confidence-bar-track">
          <div class="confidence-bar-fill ${level}" style="width: ${pct}%"></div>
        </div>
        <span class="confidence-value ${level}">${pct}%</span>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── 5. Refresh button ────────────────────────────────────
document.getElementById("refresh-btn")?.addEventListener("click", loadDocuments);

// ── 6. Drag & drop visual feedback ──────────────────────
const dropZone = document.getElementById("drop-zone");
if (dropZone) {
  ["dragenter", "dragover"].forEach(evt =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    dropZone.addEventListener(evt, () => dropZone.classList.remove("drag-over"))
  );
}

// ── Init ─────────────────────────────────────────────────
loadDocuments();
