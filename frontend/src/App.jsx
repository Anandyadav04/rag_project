import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const statusStyles = {
  neutral: 'status status-neutral',
  success: 'status status-success',
  error: 'status status-error',
  loading: 'status status-loading',
};

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [currentDocName, setCurrentDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ text: 'Upload a contract to begin', tone: 'neutral' });
  const [analysisStatus, setAnalysisStatus] = useState({ text: '', tone: 'neutral' });
  const [queryStatus, setQueryStatus] = useState({ text: '', tone: 'neutral' });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const queryInputRef = useRef(null);

  const totalClauses = useMemo(
    () => analysisResult?.clauses?.length ?? 0,
    [analysisResult]
  );

  const visibleDocuments = useMemo(() => {
    if (!selectedFile) return documents;
    const hasFileInList = documents.some((doc) => doc.filename === selectedFile.name);
    if (hasFileInList) return documents;
    return [{
      id: `pending-${selectedFile.name}`,
      filename: selectedFile.name,
      status: 'ready',
      total_pages: 0,
      isPending: true,
    }, ...documents];
  }, [documents, selectedFile]);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (!documents.some((doc) => String(doc.status || '').toLowerCase() === 'processing')) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadDocuments();
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  useEffect(() => {
    if (selectedDocId && queryInputRef.current) {
      queryInputRef.current.focus();
    }
  }, [selectedDocId]);

  function getStatusLabel(status) {
    const normalized = String(status || 'uploaded').toLowerCase();
    if (normalized === 'ready') return 'Ready';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  async function loadDocuments() {
    try {
      const response = await fetch(`${API_BASE}/documents`);
      if (!response.ok) {
        throw new Error('Unable to load documents');
      }

      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      setDocuments([]);
      setUploadStatus({
        text: 'Backend is offline or unavailable on port 8000.',
        tone: 'error',
      });
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0] || selectedFile;

    if (!file) {
      setUploadStatus({ text: 'Please select a PDF or DOCX file first.', tone: 'error' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setSelectedFile(file);
    setIsUploading(true);
    setUploadStatus({ text: 'Uploading document…', tone: 'loading' });

    try {
      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      setUploadStatus({
        text: `Document uploaded: ${data.document?.filename || data.id || 'success'}`,
        tone: 'success',
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setSelectedFile(null);
      const nextDocuments = Array.isArray(documents) ? [data.document, ...documents] : [data.document];
      setDocuments(nextDocuments);
      await loadDocuments();
    } catch (error) {
      setUploadStatus({ text: `Upload failed: ${error.message}`, tone: 'error' });
    } finally {
      setIsUploading(false);
    }
  }

  async function analyzeDocument(docId, docName) {
    setSelectedDocId(docId);
    setCurrentDocName(docName || 'Document');
    setAnalysisStatus({ text: 'Running CUAD clause extraction…', tone: 'loading' });
    setAnalysisResult(null);
    setIsRunningAnalysis(true);

    try {
      const response = await fetch(`${API_BASE}/documents/${docId}/analyze`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Analysis failed');
      }

      const clauses = data.extracted_clauses || [];
      setAnalysisResult({
        totalCategories: data.total_categories_analyzed ?? 0,
        clauses,
      });
      setAnalysisStatus({
        text: `Analysis complete — ${clauses.length} clause${clauses.length === 1 ? '' : 's'} extracted.`,
        tone: 'success',
      });
    } catch (error) {
      setAnalysisStatus({ text: `Analysis failed: ${error.message}`, tone: 'error' });
    } finally {
      setIsRunningAnalysis(false);
    }
  }

  async function submitQuery(event) {
    event.preventDefault();
    if (!selectedDocId) {
      setQueryStatus({ text: 'Select a document before asking a question.', tone: 'error' });
      return;
    }

    const query = event.target.elements.query.value.trim();
    if (!query) {
      setQueryStatus({ text: 'Please enter a question to continue.', tone: 'error' });
      return;
    }

    setIsQuerying(true);
    setQueryStatus({ text: 'Searching the document…', tone: 'loading' });
    setQueryResult(null);

    try {
      const response = await fetch(`${API_BASE}/documents/${selectedDocId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Query failed');
      }

      setQueryResult(data);
      setQueryStatus({ text: 'Answer received.', tone: 'success' });
    } catch (error) {
      setQueryStatus({ text: `Query failed: ${error.message}`, tone: 'error' });
    } finally {
      setIsQuerying(false);
    }
  }

  async function removeDocument(docId) {
    try {
      const response = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Unable to remove document');
      }

      setDocuments((currentDocuments) => currentDocuments.filter((doc) => doc.id !== docId));

      if (selectedDocId === docId) {
        setSelectedDocId(null);
        setCurrentDocName('');
        setQueryResult(null);
        setQueryStatus({ text: 'Document removed. Select another contract to continue.', tone: 'neutral' });
      }

      setUploadStatus({ text: 'Document removed successfully.', tone: 'success' });
    } catch (error) {
      setUploadStatus({ text: `Unable to remove document: ${error.message}`, tone: 'error' });
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">⚖</div>
          <div>
            <p className="eyebrow">Legal intelligence</p>
            <h1>Legal RAG Intelligence</h1>
          </div>
        </div>
        <div className="topbar-pill">
          <span className="dot" />
          CUAD analysis pipeline
        </div>
      </header>

      <main className="workspace-grid">
        <section className="panel panel-surface">
          <div className="panel-header">
            <div className="header-label">
              <span className="icon">📄</span>
              <h2>Upload contract</h2>
            </div>
          </div>

          <form onSubmit={handleUpload} className="upload-form">
            <label
              className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (fileInputRef.current && file) {
                  const fileList = new DataTransfer();
                  fileList.items.add(file);
                  fileInputRef.current.files = fileList.files;
                  setSelectedFile(file);
                  setUploadStatus({ text: `${file.name} selected and ready to upload`, tone: 'neutral' });
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file) {
                    setUploadStatus({ text: `${file.name} selected and ready to upload`, tone: 'neutral' });
                  }
                }}
              />
              <span className="drop-icon">⬆</span>
              <p>{selectedFile ? 'File ready to upload' : 'Drag and drop a contract here or browse a file'}</p>
              {selectedFile ? <div className="selected-file-pill">{selectedFile.name}</div> : <small>PDF • DOCX</small>}
            </label>

            <button type="submit" className="primary-button" disabled={isUploading}>
              {isUploading ? 'Uploading…' : 'Upload document'}
            </button>
          </form>

          <div className={statusStyles[uploadStatus.tone] || 'status'}>{uploadStatus.text}</div>
        </section>

        <section className="panel panel-surface">
          <div className="panel-header">
            <div className="header-label">
              <span className="icon">📚</span>
              <h2>Documents</h2>
            </div>
            <button type="button" className="secondary-button" onClick={loadDocuments}>
              Refresh
            </button>
          </div>

          <div className="document-list">
            {visibleDocuments.length === 0 ? (
              <div className="empty-state">No documents uploaded yet.</div>
            ) : (
              visibleDocuments.map((doc) => {
                const status = doc.isPending ? 'ready' : String(doc.status || 'uploaded').toLowerCase();

                return (
                  <div key={doc.id} className={`document-item ${selectedDocId === doc.id ? 'active' : ''} ${doc.isPending ? 'is-pending' : ''}`}>
                    <div className="document-copy">
                      <strong>{doc.filename}</strong>
                      <span>{doc.total_pages || 0} pages</span>
                    </div>

                    <div className="document-meta">
                      <span className={`badge badge-${status}`}>{doc.isPending ? 'Ready' : getStatusLabel(doc.status)}</span>
                      <div className="mini-actions">
                        <button type="button" onClick={() => analyzeDocument(doc.id, doc.filename)} disabled={doc.isPending}>
                          Analyze
                        </button>
                        <button type="button" onClick={() => setSelectedDocId(doc.id)} disabled={doc.isPending}>
                          Query
                        </button>
                        <button type="button" className="danger-button" onClick={() => removeDocument(doc.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="panel panel-surface">
          <div className="panel-header">
            <div className="header-label">
              <span className="icon">🔎</span>
              <h2>Clause extraction</h2>
            </div>
          </div>

          {analysisStatus.text ? (
            <div className={statusStyles[analysisStatus.tone] || 'status'}>{analysisStatus.text}</div>
          ) : null}

          {isRunningAnalysis ? (
            <div className="loader-card">Running CUAD clause extraction…</div>
          ) : null}

          {analysisResult && (
            <div className="analysis-block">
              <div className="summary-row">
                <span className="summary-badge">{analysisResult.totalCategories} categories checked</span>
                <span className="summary-badge alt">{totalClauses} clauses found</span>
              </div>

              <div className="clause-grid">
                {analysisResult.clauses.map((clause, index) => {
                  const confidence = Math.round((clause.confidence || 0) * 100);
                  const confidenceTone = clause.confidence >= 0.6 ? 'high' : clause.confidence >= 0.25 ? 'medium' : 'low';

                  return (
                    <article key={`${clause.category}-${index}`} className="clause-card">
                      <div className="clause-header">
                        <span className="category-pill">{clause.category}</span>
                        <span className={`confidence-pill ${confidenceTone}`}>{confidence}%</span>
                      </div>
                      <p className="clause-text">“{clause.extracted_text || 'No clause text available.'}”</p>
                      {clause.page_number ? <small>Page {clause.page_number}</small> : null}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="panel panel-surface">
          <div className="panel-header">
            <div className="header-label">
              <span className="icon">💬</span>
              <h2>Ask a question</h2>
            </div>
          </div>

          <form onSubmit={submitQuery} className="query-form">
            <input
              ref={queryInputRef}
              type="text"
              name="query"
              placeholder="Ask about governing law, indemnity, or payment terms…"
              disabled={!selectedDocId}
            />
            <button type="submit" className="primary-button" disabled={!selectedDocId || isQuerying}>
              {isQuerying ? 'Querying…' : 'Ask'}
            </button>
          </form>

          {queryStatus.text ? (
            <div className={statusStyles[queryStatus.tone] || 'status'}>{queryStatus.text}</div>
          ) : null}

          {queryResult && (
            <div className="answer-card">
              <div className="answer-header">
                <span>Answer</span>
                <span className="confidence-meter">{Math.round((queryResult.confidence || 0) * 100)}%</span>
              </div>
              <p className="answer-text">{queryResult.answer}</p>

              <div className="source-row">
                <strong>{currentDocName || 'Document'}</strong>
                <span>{(queryResult.page_numbers || []).length ? `Pages: ${queryResult.page_numbers.join(', ')}` : 'Page references unavailable'}</span>
              </div>

              {queryResult.exact_evidence_text ? (
                <div className="evidence-box">
                  <span>Supporting clause</span>
                  <p>“{queryResult.exact_evidence_text}”</p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
