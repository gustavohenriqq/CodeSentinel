import { useState } from 'react';
import { SeverityBadge } from './SeverityBadge.jsx';

// Ícone por tipo de arquivo
function FileIcon({ filename }) {
  const name = filename.toLowerCase();
  if (name.includes('workflow') || name.endsWith('.yml') || name.endsWith('.yaml')) return '⚙️';
  if (name.includes('dockerfile')) return '🐳';
  if (name.includes('docker-compose')) return '🐳';
  if (name.includes('package.json')) return '📦';
  if (name.includes('.env')) return '🔑';
  if (name.includes('requirements')) return '🐍';
  if (name.includes('.gitignore')) return '📋';
  return '📄';
}

export function FindingCard({ finding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`finding-card ${finding.severity}`}>
      <div className="finding-header" onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <SeverityBadge severity={finding.severity} />
          <span className="finding-title">{finding.title}</span>
        </div>
        <span className={`finding-chevron ${open ? 'open' : ''}`}>›</span>
      </div>

      {open && (
        <div className="finding-body">
          <div className="finding-section">
            <div className="finding-section-label">📁 Arquivo</div>
            <span className="finding-file">
              <FileIcon filename={finding.file} /> {finding.file}
            </span>
          </div>

          <div className="finding-section">
            <div className="finding-section-label">🔍 O que foi detectado</div>
            <p className="finding-text">{finding.description}</p>
          </div>

          <div className="finding-section">
            <div className="finding-section-label">⚠️ Por que é um risco</div>
            <p className="finding-text">{finding.reason}</p>
          </div>

          <div className="finding-section">
            <div className="finding-section-label">✅ Como corrigir</div>
            <div className="suggestion-box">
              <p className="finding-text" style={{ whiteSpace: 'pre-wrap' }}>
                {finding.suggestion}
              </p>
            </div>
          </div>

          {finding.reference && (
            <div className="finding-section">
              <a
                href={finding.reference}
                target="_blank"
                rel="noopener noreferrer"
                className="ref-link"
              >
                📖 Ver documentação oficial ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
