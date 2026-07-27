import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import { login } from './auth';

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const user = login(username, password);
    if (!user) {
      setError('Неверный логин или пароль');
      return;
    }
    onSuccess(user);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
        p: 2,
      }}
    >
      <Paper sx={{ p: 3, width: '100%', maxWidth: 360 }} elevation={2}>
        <Typography variant='h6' gutterBottom>
          Вход в админку
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          Уткина дача
        </Typography>
        {error && (
          <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label='Логин'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete='username'
            autoFocus
            required
            fullWidth
          />
          <TextField
            label='Пароль'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='current-password'
            required
            fullWidth
          />
          <Button type='submit' variant='contained' fullWidth>
            Войти
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
