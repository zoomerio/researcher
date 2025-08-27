import React, { useState } from 'react';

interface User {
  id: number;
  username: string;
  fullName: string;
  groupId: string;
}

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
}

export function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [formData, setFormData] = useState({
    fullName: user.fullName,
    groupId: user.groupId,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords if changing
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError('Введите текущий пароль для изменения');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('Новые пароли не совпадают');
        return;
      }
      if (formData.newPassword.length < 6) {
        setError('Новый пароль должен содержать минимум 6 символов');
        return;
      }
    }

    try {
      setLoading(true);
      const result = await window.api.updateUserProfile({
        userId: user.id,
        fullName: formData.fullName,
        groupId: formData.groupId,
        currentPassword: formData.currentPassword || undefined,
        newPassword: formData.newPassword || undefined
      });

      if (result.success) {
        setSuccess('Профиль успешно обновлен');
        onUpdate({
          ...user,
          fullName: formData.fullName,
          groupId: formData.groupId
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(result.error || 'Ошибка при обновлении профиля');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Произошла ошибка при обновлении профиля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>Мой профиль</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h4>Основная информация</h4>
            
            <div className="form-group">
              <label>Имя пользователя</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="disabled-input"
              />
              <small>Имя пользователя нельзя изменить</small>
            </div>
            
            <div className="form-group">
              <label>Полное имя</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Группа</label>
              <input
                type="text"
                value={formData.groupId}
                onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Изменение пароля</h4>
            <small>Оставьте поля пустыми, если не хотите менять пароль</small>
            
            <div className="form-group">
              <label>Текущий пароль</label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Введите текущий пароль"
              />
            </div>
            
            <div className="form-group">
              <label>Новый пароль</label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Введите новый пароль"
                minLength={6}
              />
            </div>
            
            <div className="form-group">
              <label>Подтвердите новый пароль</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Повторите новый пароль"
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <div className="profile-modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
