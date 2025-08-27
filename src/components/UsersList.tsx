import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  fullName: string;
  groupId: string;
  createdAt: string;
  lastLogin?: string;
  documentCount?: number;
}

interface UsersListProps {
  user: any;
}

export function UsersList({ user }: UsersListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'group' | 'documents' | 'created'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await window.api.getAllUsers();
      
      if (result.success) {
        setUsers(result.users || []);
      } else {
        console.error('Failed to load users:', result.error);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      u.groupId.toLowerCase().includes(query)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.fullName.localeCompare(b.fullName);
        break;
      case 'group':
        comparison = a.groupId.localeCompare(b.groupId);
        break;
      case 'documents':
        comparison = (a.documentCount || 0) - (b.documentCount || 0);
        break;
      case 'created':
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = aDate - bDate;
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentUsers = sortedUsers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page when searching
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="users-list">
      <div className="users-header">
        <h3>Пользователи</h3>
        
        <div className="controls-container">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Поиск по имени или группе..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
              >
                Очистить
              </button>
            )}
          </div>

          <div className="controls-group">
            <button className="search-btn" onClick={handleSearch}>Найти</button>
            <div className="sort-controls">
              <label>Сортировка:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="name">По имени</option>
                <option value="group">По группе</option>
                <option value="documents">По количеству исследований</option>
                <option value="created">По дате регистрации</option>
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
        </div>
      </div>

      <div className="users-grid">
        {loading ? (
          <div className="loading">Загрузка пользователей...</div>
        ) : currentUsers.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'Пользователи не найдены' : 'Нет зарегистрированных пользователей'}
          </div>
        ) : (
          <div className="users-container">
            {currentUsers.map((userItem) => (
              <div key={userItem.id} className="user-card">
                <div className="user-avatar">
                  <span className="avatar-icon">👤</span>
                </div>
                
                <div className="user-info">
                  <h4 className="user-name" title={userItem.fullName}>
                    {userItem.fullName}
                  </h4>
                  
                  <div className="user-meta">
                    <div className="meta-item">
                      <span className="meta-icon">🏢</span>
                      <span className="meta-text">{userItem.groupId}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">📚</span>
                      <span className="meta-text">Исследований: {userItem.documentCount || 0}</span>
                    </div>
                  </div>
                </div>
                
                {userItem.id === user.id && (
                  <div className="current-user-badge">
                    Это вы
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ← Предыдущая
            </button>
            <div className="pagination-info">
              Страница {currentPage} из {totalPages}
              <span className="total-count">Всего пользователей: {sortedUsers.length}</span>
            </div>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Следующая →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
