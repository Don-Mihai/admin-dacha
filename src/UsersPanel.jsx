import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { listUsers, createUser, updateUser, deleteUser } from './auth';

const ROLE_LABELS = {
  admin: 'Админ',
  editor: 'Редактор',
  viewer: 'Просмотр',
};

const emptyForm = { username: '', password: '', role: 'editor' };

export default function UsersPanel({ currentUser, onUserUpdated }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => setUsers(listUsers());

  useEffect(() => {
    refresh();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({ username: user.username, password: '', role: user.role });
    setDialogOpen(true);
  };

  const handleSave = () => {
    setError('');
    setSuccess('');
    try {
      if (editing) {
        const body = { username: form.username.trim(), role: form.role };
        if (form.password) body.password = form.password;
        const updated = updateUser(editing.id, body);
        if (updated.id === currentUser.id && onUserUpdated) onUserUpdated(updated);
        setSuccess('Пользователь обновлён');
      } else {
        createUser({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
        });
        setSuccess('Пользователь создан');
      }
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = (user) => {
    if (user.id === currentUser.id) {
      setError('Нельзя удалить самого себя');
      return;
    }
    if (!window.confirm(`Удалить пользователя «${user.username}»?`)) return;
    setError('');
    setSuccess('');
    try {
      deleteUser(user.id, currentUser.id);
      setSuccess('Пользователь удалён');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      {(error || success) && (
        <Alert
          severity={error ? 'error' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => {
            setError('');
            setSuccess('');
          }}
        >
          {error || success}
        </Alert>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant='h6' sx={{ flex: 1 }}>
          Пользователи
        </Typography>
        <Button variant='contained' onClick={openCreate}>
          Добавить
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Логин</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Роль</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 120 }} align='right'>
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  {u.username}
                  {u.id === currentUser.id ? ' (вы)' : ''}
                </TableCell>
                <TableCell>{ROLE_LABELS[u.role] || u.role}</TableCell>
                <TableCell align='right'>
                  <IconButton size='small' onClick={() => openEdit(u)} title='Редактировать'>
                    <EditIcon fontSize='small' />
                  </IconButton>
                  <IconButton
                    size='small'
                    onClick={() => handleDelete(u)}
                    disabled={u.id === currentUser.id}
                    title='Удалить'
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{editing ? 'Редактировать пользователя' : 'Новый пользователь'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label='Логин'
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
            fullWidth
            margin='dense'
          />
          <TextField
            label={editing ? 'Новый пароль (необязательно)' : 'Пароль'}
            type='password'
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required={!editing}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Роль</InputLabel>
            <Select
              value={form.role}
              label='Роль'
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <MenuItem value='admin'>Админ</MenuItem>
              <MenuItem value='editor'>Редактор</MenuItem>
              <MenuItem value='viewer'>Просмотр</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={!form.username.trim() || (!editing && !form.password)}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
