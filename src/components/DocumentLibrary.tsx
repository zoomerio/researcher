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

interface DocumentLibraryProps {
  user: any;
  onOpenDocument: (filePath: string) => void;
}

export function DocumentLibrary({ user, onOpenDocument }: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [sortBy, setSortBy] = useState<'title' | 'modified'>('modified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadDocuments();
  }, [viewMode, user]);

  const loadDocuments = async () => {
    console.log('[DocumentLibrary] Loading documents...');
    console.log('[DocumentLibrary] View mode:', viewMode);
    console.log('[DocumentLibrary] User:', user);
    
    try {
      setLoading(true);
      let result;
      
      if (viewMode === 'my') {
        console.log('[DocumentLibrary] Calling getUserDocuments with userId:', user.id);
        result = await window.api.getUserDocuments({ userId: user.id });
      } else {
        console.log('[DocumentLibrary] Calling getAllDocuments');
        result = await window.api.getAllDocuments();
      }
      
      console.log('[DocumentLibrary] API result:', result);
      
      if (result.success) {
        console.log('[DocumentLibrary] Documents loaded:', result.documents?.length || 0);
        setDocuments(result.documents || []);
      } else {
        console.error('Failed to load documents:', result.error);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDocuments();
      return;
    }

    try {
      setLoading(true);
      const result = await window.api.searchDocuments({
        query: searchQuery,
        userId: viewMode === 'my' ? user.id : undefined
      });
      
      if (result.success) {
        setDocuments(result.documents || []);
      } else {
        console.error('Failed to search documents:', result.error);
      }
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ из библиотеки?')) {
      return;
    }

    try {
      const result = await window.api.deleteDocument({
        documentId,
        userId: user.id
      });
      
      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      } else {
        alert('Ошибка при удалении документа: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Произошла ошибка при удалении документа');
    }
  };

  const sortDocuments = (docs: Document[]) => {
    return [...docs].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'modified':
        default:
          comparison = new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
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

  return (
    <div className="document-library">
      <div className="library-header">
        <h3>Исследования</h3>
        
        <div className="view-mode-toggle">
          <button 
            className={viewMode === 'my' ? 'active' : ''}
            onClick={() => setViewMode('my')}
          >
            Мои исследования
          </button>
          <button 
            className={viewMode === 'all' ? 'active' : ''}
            onClick={() => setViewMode('all')}
          >
            Все исследования
          </button>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Поиск исследований..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Найти</button>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); loadDocuments(); }}>
              Очистить
            </button>
          )}
        </div>

        <div className="sort-controls">
          <label>Сортировка:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="modified">По новизне</option>
            <option value="title">По алфавиту</option>
          </select>
          <button 
            className="sort-order-btn"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="documents-list">
        {loading ? (
          <div className="loading">Загрузка документов...</div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'Исследования не найдены' : 'Нет сохраненных исследований'}
          </div>
        ) : (
          sortDocuments(documents).map((doc) => (
            <div key={doc.id} className="document-item">
              <div className="document-cover">
                {doc.cover_image_path ? (
                  <img 
                    src={`file://${doc.cover_image_path}`} 
                    alt={`Cover for ${doc.title}`}
                    className="cover-image"
                    onError={(e) => {
                      console.error('Failed to load cover image:', doc.cover_image_path);
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling.style.display = 'flex';
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
                  <div className="author-info">
                    👤 {doc.author_full_name} ({doc.author_group_id})
                  </div>
                  <div className="date-info">
                    📅 {formatDate(doc.modified_at)}
                  </div>
                  {doc.file_size && (
                    <div className="size-info">
                      📊 {formatFileSize(doc.file_size)}
                    </div>
                  )}
                </div>

                {doc.description && (
                  <div className="document-description">
                    {doc.description.substring(0, 100)}
                    {doc.description.length > 100 && '...'}
                  </div>
                )}

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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
