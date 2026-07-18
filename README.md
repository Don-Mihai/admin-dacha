# CMS Уткина дача

Единая система управления контентом по ТЗ: **PostgreSQL**, **Express REST + GraphQL**, **JWT** с ролями (`admin` / `editor` / `viewer`).

## Быстрый старт

```bash
cd admin-dacha
cp .env.example .env   # при необходимости
npm install
npm run db:up          # Docker: PostgreSQL на :5432
npm run db:seed        # миграции + seed из */public/data/*.json
npm run dev            # API :3333 + Vite :5174
```

Откройте http://localhost:5174  
Логин по умолчанию: `admin` / `admin123` (из `.env`).

Продакшен:

```bash
npm run build
npm start
```

http://localhost:3333

## API

| Метод | Путь | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/auth/login` | — | JWT |
| GET | `/api/projects` | JWT | Список проектов и документов |
| GET/PUT | `/api/projects/:id/documents/:key` | JWT | Чтение / сохранение (PUT → БД + sync JSON) |
| POST | `/api/media` | JWT editor+ | Загрузка файла |
| GET | `/api/public/projects/:id/documents/:key` | — | Публичное чтение для киосков |
| POST | `/api/sync/:projectId` | JWT | Выгрузка документов проекта на диск |
| * | `/graphql` | JWT для queries | GraphQL Yoga |

## Переменные окружения

См. `.env.example`: `DATABASE_URL`, `JWT_SECRET`, `PROJECTS_ROOT`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`.
