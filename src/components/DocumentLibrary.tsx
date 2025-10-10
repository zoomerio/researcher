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
  const [sortBy, setSortBy] = useState<'title' | 'created' | 'modified'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    author: '',
    group: ''
  });

  useEffect(() => {
    loadDocuments();
  }, [viewMode, user]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when documents change
  }, [documents, sortBy, sortOrder, filters]);

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
        setCurrentPage(1); // Reset to first page after search
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
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'modified':
        default:
          comparison = new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const getPaginatedDocuments = (docs: Document[]) => {
    const filtered = applyFilters(docs);
    const sorted = sortDocuments(filtered);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  const getTotalPages = (docs: Document[]) => {
    const filtered = applyFilters(docs);
    return Math.ceil(filtered.length / itemsPerPage);
  };

  const getFilteredCount = (docs: Document[]) => {
    return applyFilters(docs).length;
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

  const applyFilters = (docs: Document[]) => {
    return docs.filter(doc => {
      const createdDate = new Date(doc.created_at);
      const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
      const dateTo = filters.dateTo ? new Date(filters.dateTo) : null;
      
      if (dateFrom && createdDate < dateFrom) return false;
      if (dateTo && createdDate > dateTo) return false;
      if (filters.author && !doc.author_full_name.toLowerCase().includes(filters.author.toLowerCase())) return false;
      if (filters.group && !doc.author_group_id.toLowerCase().includes(filters.group.toLowerCase())) return false;
      
      return true;
    });
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      author: '',
      group: ''
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return filters.dateFrom || filters.dateTo || filters.author || filters.group;
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

        <div className="controls-container">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Поиск исследований..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => { setSearchQuery(''); loadDocuments(); }}>
                Очистить
              </button>
            )}
          </div>

          <div className="controls-group">
            <button className="search-btn" onClick={handleSearch}>Найти</button>
            
            <div className="sort-controls">
              <label>Сортировка:</label>
              <select value={sortBy} onChange={(e) => setSortBy((e.target.value as 'title' | 'created' | 'modified'))}>
                <option value="created">По дате создания</option>
                <option value="modified">По дате изменения</option>
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

            <button 
              className={`filter-btn ${hasActiveFilters() ? 'active' : ''}`}
              onClick={() => setShowFilters(true)}
            >
              🔍 Фильтры {hasActiveFilters() && `(${Object.values(filters).filter(v => v).length})`}
            </button>
          </div>
        </div>
      </div>

      <div className="documents-grid">
        {loading ? (
          <div className="loading">Загрузка документов...</div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'Исследования не найдены' : 'Нет сохраненных исследований'}
          </div>
        ) : getFilteredCount(documents) === 0 ? (
          <div className="empty-state">
            По заданным фильтрам исследования не найдены
          </div>
        ) : (
          <>
            <div className="documents-container">
              {getPaginatedDocuments(documents).map((doc) => (
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
                            const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (nextEl && (nextEl as HTMLElement).style) {
                              (nextEl as HTMLElement).style.display = 'flex';
                            }
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
                          <span className="meta-text">{doc.author_full_name}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-icon">🏢</span>
                          <span className="meta-text">{doc.author_group_id}</span>
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
                          {doc.description.substring(0, 100)}
                          {doc.description.length > 100 && '...'}
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
            
            {getTotalPages(documents) > 1 && (
              <div className="pagination">
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ← Предыдущая
                </button>
                
                <div className="pagination-info">
                  Страница {currentPage} из {getTotalPages(documents)}
                  <span className="total-count">({getFilteredCount(documents)} из {documents.length} исследований)</span>
                </div>
                
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(getTotalPages(documents), prev + 1))}
                  disabled={currentPage === getTotalPages(documents)}
                >
                  Следующая →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="filter-modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>Фильтры поиска</h3>
              <button className="close-btn" onClick={() => setShowFilters(false)}>×</button>
            </div>
            
            <div className="filter-modal-content">
              <div className="filter-group">
                <label>Дата создания (от):</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              
              <div className="filter-group">
                <label>Дата создания (до):</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
              
              <div className="filter-group">
                <label>Автор:</label>
                <input
                  type="text"
                  placeholder="Поиск по имени автора..."
                  value={filters.author}
                  onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
                />
              </div>
              
              <div className="filter-group">
                <label>Группа:</label>
                <input
                  type="text"
                  placeholder="Поиск по группе..."
                  value={filters.group}
                  onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="filter-modal-actions">
              <button className="clear-filters-btn" onClick={clearFilters}>
                Очистить все
              </button>
              <button className="apply-filters-btn" onClick={() => setShowFilters(false)}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
