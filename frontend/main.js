// main.js – Legal RAG Intelligence Frontend

const API_BASE = "http://127.0.0.1:8001";
let selectedDocId = null;

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
          <button class="btn btn-action" onclick="analyzeDocument('${doc.id}')">Analyze</button>
          <button class="btn btn-action" onclick="showQuerySection('${doc.id}')">Query</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-state" style="color:var(--danger)">⚠️ Backend unreachable – is the server running on port 8001?</p>`;
    console.error("loadDocuments error:", err);
  }
}

// ── 3. Analyze ───────────────────────────────────────────
async function analyzeDocument(id) {
  selectedDocId = id;
  show("analysis-section");
  setStatus("analysis-status", "Running 41-category CUAD analysis… (this may take a minute)", "loading");
  document.getElementById("analysis-result").textContent = "";

  try {
    const res = await fetch(`${API_BASE}/documents/${id}/analyze`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

    const summary = {
      document_id: data.document_id,
      total_categories: data.total_categories_analyzed,
      clauses_found: data.extracted_clauses?.length || 0,
      clauses: (data.extracted_clauses || []).map(c => ({
        category: c.category,
        text: c.extracted_text,
        confidence: c.confidence,
        page: c.page_number,
      })),
    };

    document.getElementById("analysis-result").textContent = JSON.stringify(summary, null, 2);
    setStatus("analysis-status", `✅ Done – ${summary.clauses_found} clause(s) extracted`, "success");
  } catch (err) {
    setStatus("analysis-status", "❌ " + err.message, "error");
  }
}

// ── 4. Query ─────────────────────────────────────────────
function showQuerySection(id) {
  selectedDocId = id;
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
    document.getElementById("query-result").textContent = "";

    try {
      const res = await fetch(`${API_BASE}/documents/${selectedDocId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

      document.getElementById("query-result").textContent = JSON.stringify(data, null, 2);
      setStatus("query-status", "✅ Answer received", "success");
    } catch (err) {
      setStatus("query-status", "❌ " + err.message, "error");
    } finally {
      setLoading("query-btn", "query-spinner", false);
    }
  });
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
