@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM Останавливает контейнер Postgres CMS (сервер Node останавливайте Ctrl+C в окне start).

cd /d "%~dp0"

echo Останавливаю Docker Postgres (utkina-cms-db)...
docker compose down
if errorlevel 1 (
  echo Не удалось остановить compose. Docker запущен?
  pause
  exit /b 1
)

echo Готово. Данные БД сохранены в volume utkina_pg_data.
pause
exit /b 0
