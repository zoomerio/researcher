import React, { useState, useEffect } from 'react';

interface Document {
  id: number;
  title: string;
  author_id: number;
  author_username: string;
  author_full_name: string;
  author_group_id: string;
  file_path: string;
  cover_image_path?: string;
  created_at: string;
  modified_at: string;
  file_size?: number;
  description: string;
  goals: string;
  hypotheses: string;
  plan: string;
}

interface RecentDocumentsProps {
  user: any;
  recentDocuments: string[];
  onOpenDocument: (filePath: string) => void;
}

export function RecentDocuments({ user, recentDocuments, onOpenDocument }: RecentDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentDocuments();
  }, [recentDocuments]);

  const loadRecentDocuments = async () => {
    if (recentDocuments.length === 0) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const documentPromises = recentDocuments.map(async (filePath) => {
        try {
          const result = await window.api.getDocumentByPath(filePath);
          return result.success ? result.document : null;
        } catch (error) {
          console.error('Error loading recent document:', filePath, error);
          return null;
        }
      });

      const results = await Promise.all(documentPromises);
      const validDocuments = results.filter(doc => doc !== null) as Document[];
      setDocuments(validDocuments);
    } catch (error) {
      console.error('Error loading recent documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Recent documents are already limited to 5 and ordered by recency
  const displayDocuments = documents;

  const handleDeleteDocument = async (documentId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это исследование?')) {
      return;
    }

    try {
      const result = await window.api.deleteDocument({ documentId, userId: user.id });
      if (result.success) {
        // Reload documents after deletion
        loadRecentDocuments();
      } else {
        alert('Ошибка при удалении документа: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Произошла ошибка при удалении документа');
    }
  };

  return (
    <div className="documents-library">
      <div className="library-header">
        <h3>Недавние исследования</h3>
        <p className="recent-subtitle">Последние 5 открытых документов</p>
      </div>

      <div className="documents-grid">
        {loading ? (
          <div className="loading">Загрузка документов...</div>
        ) : displayDocuments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h4>Нет недавних документов</h4>
            <p>Откройте исследование, и оно появится здесь</p>
          </div>
        ) : (
          <div className="documents-container">
            {displayDocuments.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="card-content">
                  <div className="document-cover">
                    {doc.cover_image_path ? (
                      <img
                        src={`file://${doc.cover_image_path}`}
                        alt={`Cover for ${doc.title}`}
                        className="cover-image"
                        onError={(e) => {
                          console.error('Failed to load cover image:', doc.cover_image_path);
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling!.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="cover-placeholder" style={{ display: doc.cover_image_path ? 'none' : 'flex' }}>
                      📄
                    </div>
                  </div>

                  <div className="document-info">
                    <h4 className="document-title" title={doc.title}>
                      {doc.title || 'Без названия'}
                    </h4>

                    <div className="document-meta">
                      <div className="meta-item">
                        <span className="meta-icon">👤</span>
                        <span className="meta-text">{doc.author_full_name} ({doc.author_group_id})</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-icon">📅</span>
                        <span className="meta-text">{formatDate(doc.created_at)}</span>
                      </div>
                      {doc.file_size && (
                        <div className="meta-item">
                          <span className="meta-icon">📊</span>
                          <span className="meta-text">{formatFileSize(doc.file_size)}</span>
                        </div>
                      )}
                    </div>

                    {doc.description && (
                      <div className="document-description">
                        {doc.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="document-actions">
                  <button
                    className="open-btn"
                    onClick={() => onOpenDocument(doc.file_path)}
                  >
                    Открыть
                  </button>

                  {doc.author_id === user.id && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
