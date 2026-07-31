@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM Ежедневный запуск CMS на Windows.
REM Поднимает Postgres (если есть Docker) и стартует API + статику на :3333.

cd /d "%~dp0"

echo ========================================
echo  CMS Уткина дача — запуск
echo ========================================
echo.

if not exist "node_modules\" (
  echo [ОШИБКА] Нет node_modules
  echo Сначала запустите setup-windows.bat
  goto :fail
)

if not exist "build\index.html" (
  echo [!] Нет сборки фронта — собираю...
  call npm run build
  if errorlevel 1 goto :fail
)

where docker >nul 2>&1
if not errorlevel 1 (
  docker info >nul 2>&1
  if not errorlevel 1 (
    echo Поднимаю Postgres...
    docker compose up -d
    if errorlevel 1 (
      echo [!] docker compose не удался — продолжаю, если БД уже запущена иначе.
    ) else (
      timeout /t 2 /nobreak >nul
    )
  ) else (
    echo [!] Docker не запущен — ожидается уже работающий PostgreSQL.
  )
) else (
  echo [!] Docker не найден — ожидается уже работающий PostgreSQL.
)

echo.
echo API:      http://localhost:3333
echo GraphQL:  http://localhost:3333/graphql
echo Остановка: Ctrl+C в этом окне
echo.

start "" "http://localhost:3333"
call npm start
exit /b %ERRORLEVEL%

:fail
echo.
pause
exit /b 1
