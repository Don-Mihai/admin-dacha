# CMS Уткина дача

Единая система управления контентом по ТЗ: **PostgreSQL**, **Express REST + GraphQL**, **JWT** с ролями (`admin` / `editor` / `viewer`).

Файл `.env` **не обязателен** — в `server/config.js` заданы дефолты (совпадают с `docker-compose.yml` и `.env.example`).

## Быстрый старт

### Windows — через скрипты (рекомендуется на машине редактора)

На киоски по-прежнему достаточно статических билдов. **CMS с Postgres** ставится только на ПК, где правят контент.

Структура папок:

```
utkina-dacha\
  admin\              ← скрипты лежат здесь
  exhibition-hall\
  hall-of-finds\
  ...
```

| Скрипт | Когда |
|--------|--------|
| `setup-windows.bat` | **Первый раз** (или после установки Docker / reboot) |
| `start-windows.bat` | **Каждый день** — запуск CMS |
| `stop-windows.bat` | Остановить контейнер Postgres |

**Первая установка**

1. Откройте папку `admin`.
2. Правый клик по `setup-windows.bat` → **Запуск от имени администратора**.
3. Скрипт при необходимости поставит Node.js и Docker Desktop (`winget`, иначе скачает установщики), затем выполнит `npm install`, поднимет Postgres, сделает seed и `npm run build`.
4. Если Docker Desktop только что установлен — часто нужен **reboot**. После перезагрузки откройте Docker Desktop (дождитесь зелёного статуса) и снова запустите `setup-windows.bat`.

**Ежедневный запуск**

1. Дважды кликните `start-windows.bat` (Docker Desktop должен быть запущен или скрипт попробует его поднять).
2. Откроется http://localhost:3333 (скрипт поднимает Postgres и вызывает `npm start`).
3. Логин: `admin` / `admin123`.
4. Остановка сервера — `Ctrl+C` в окне скрипта. Чтобы погасить и БД: `stop-windows.bat`.

Без Docker: поставьте PostgreSQL с пользователем/БД из таблицы переменных ниже (или задайте `DATABASE_URL` в `.env`) и при вопросе setup-скрипта продолжайте с **Y**.

### macOS / Linux — через npm

```bash
cd admin
npm install
npm run db:up          # Docker: PostgreSQL на :5432
npm run db:seed        # миграции + seed из */public/data/*.json
npm run dev            # API :3333 + Vite :5174
```

Откройте http://localhost:5174  
Логин: `admin` / `admin123`.

Продакшен:

```bash
npm run build
npm start
```

http://localhost:3333

## Переменные окружения

Все опциональны. Без `.env` используются значения ниже.

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PORT` | `3333` | Порт API и раздачи статики |
| `DATABASE_URL` | `postgresql://utkina:utkina@localhost:5432/utkina_cms` | Postgres (как в `docker-compose.yml`) |
| `JWT_SECRET` | `dev-secret-change-me-in-production` | Секрет подписи JWT |
| `JWT_EXPIRES_IN` | `12h` | Срок жизни токена |
| `PROJECTS_ROOT` | `..` | Корень с папками проектов (рядом с `admin`) |
| `ADMIN_LOGIN` | `admin` | Логин создаваемого админа |
| `ADMIN_PASSWORD` | `admin123` | Пароль создаваемого админа |

Переопределение: скопируйте `.env.example` → `.env` и измените нужные строки. В проде обязательно смените `JWT_SECRET` и `ADMIN_PASSWORD`.

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
