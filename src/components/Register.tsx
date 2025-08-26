import React, { useState } from 'react';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

interface RegisterFormData {
  username: string;
  fullName: string;
  groupId: string;
  password: string;
  confirmPassword: string;
}

export function Register({ onRegisterSuccess, onSwitchToLogin }: RegisterProps) {
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    fullName: '',
    groupId: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.username.trim()) {
      setError('Логин обязателен для заполнения');
      return false;
    }

    if (!formData.fullName.trim()) {
      setError('ФИО обязательно для заполнения');
      return false;
    }

    if (!formData.groupId.trim()) {
      setError('ID группы обязателен для заполнения');
      return false;
    }

    if (!formData.password) {
      setError('Пароль обязателен для заполнения');
      return false;
    }

    if (formData.password.length < 5) {
      setError('Пароль должен содержать минимум 5 символов');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await window.api.register({
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        groupId: formData.groupId.trim(),
        password: formData.password
      });

      if (result.success) {
        onRegisterSuccess();
      } else {
        setError(result.error || 'Ошибка регистрации');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Произошла ошибка при регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Регистрация пользователя</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Логин *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Введите логин"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="fullName">ФИО *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="Введите полное имя"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="groupId">ID группы *</label>
            <input
              type="text"
              id="groupId"
              name="groupId"
              value={formData.groupId}
              onChange={handleInputChange}
              placeholder="Введите ID группы"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Введите пароль (минимум 5 символов)"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Повторите пароль *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Повторите пароль"
              disabled={isLoading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button 
              type="submit" 
              className="primary"
              disabled={isLoading}
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
            <button 
              type="button" 
              className="secondary"
              onClick={onSwitchToLogin}
              disabled={isLoading}
            >
              Назад к входу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
