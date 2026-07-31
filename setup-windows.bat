@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

REM Первый запуск CMS на Windows:
REM   Node.js + Docker Desktop (если нет) → npm install → Postgres → seed → build
REM   .env не обязателен — дефолты в server/config.js
REM
REM Запускать из папки admin (лучше: правый клик → «Запуск от имени администратора»).
REM Ожидаемая структура:
REM   utkina-dacha\
REM     admin\          <- этот скрипт
REM     exhibition-hall\
REM     ...

cd /d "%~dp0"
set "WORKDIR=%CD%"
set "TMPDIR=%TEMP%\utkina-cms-setup"
if not exist "%TMPDIR%" mkdir "%TMPDIR%" >nul 2>&1

echo ========================================
echo  CMS Уткина дача — установка (Windows)
echo ========================================
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo [!] Скрипт не от администратора.
  echo     Установка Node/Docker может запросить UAC или не пройти.
  echo     При ошибках перезапустите bat от имени администратора.
  echo.
)

call :ensure_node
if errorlevel 1 goto :fail

call :refresh_path
where npm >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] npm не найден после установки Node.
  echo Закройте окно и снова запустите setup-windows.bat ^(PATH обновится^).
  goto :fail
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node %%v
for /f "tokens=*" %%v in ('npm -v') do echo [OK] npm %%v

call :ensure_docker
call :refresh_path

set "DOCKER_OK=0"
where docker >nul 2>&1
if not errorlevel 1 (
  call :wait_docker_engine
  if not errorlevel 1 set "DOCKER_OK=1"
)

if "%DOCKER_OK%"=="1" (
  echo [OK] Docker доступен
) else (
  echo [!] Docker пока недоступен.
  echo     Если только что установили Docker Desktop:
  echo       1^) перезагрузите ПК при запросе
  echo       2^) откройте Docker Desktop и дождитесь зелёного статуса
  echo       3^) снова запустите setup-windows.bat
  echo     Либо поставьте PostgreSQL отдельно ^(дефолт: utkina/utkina @ localhost:5432/utkina_cms^)
  echo.
)

if exist ".env" (
  echo [OK] Найден .env — переопределит дефолты из server/config.js
) else (
  echo [OK] .env нет — используются дефолты ^(admin / admin123, локальный Postgres^)
)

echo.
echo --- npm install ---
call npm install
if errorlevel 1 (
  echo [ОШИБКА] npm install не удался
  goto :fail
)

if "%DOCKER_OK%"=="1" (
  echo.
  echo --- PostgreSQL (docker compose) ---
  docker compose up -d
  if errorlevel 1 (
    echo [ОШИБКА] docker compose up не удался
    goto :fail
  )
  echo Ждём готовности Postgres...
  set /a "TRIES=0"
  :wait_pg
  set /a "TRIES+=1"
  docker compose exec -T postgres pg_isready -U utkina -d utkina_cms >nul 2>&1
  if not errorlevel 1 goto :pg_ready
  if !TRIES! GEQ 30 (
    echo [ОШИБКА] Postgres не ответил за ~60 сек
    goto :fail
  )
  timeout /t 2 /nobreak >nul
  goto :wait_pg
  :pg_ready
  echo [OK] Postgres готов
) else (
  echo.
  echo --- Пропуск Docker ---
  echo Убедитесь, что PostgreSQL слушает на localhost:5432
  echo ^(utkina / utkina / utkina_cms^) или задайте DATABASE_URL в .env
  echo.
  choice /C YN /M "Продолжить seed/build без Docker"
  if errorlevel 2 goto :fail
)

echo.
echo --- Миграции + seed из соседних проектов ---
call npm run db:seed
if errorlevel 1 (
  echo [ОШИБКА] db:seed не удался. Проверьте DATABASE_URL и что Postgres запущен.
  goto :fail
)

echo.
echo --- Сборка фронта (vite build) ---
call npm run build
if errorlevel 1 (
  echo [ОШИБКА] build не удался
  goto :fail
)

echo.
echo ========================================
echo  Готово.
echo  Дальше: start-windows.bat
echo  Или:    npm start
echo  Открыть: http://localhost:3333
echo  Логин:   admin / admin123
echo ========================================
echo.
pause
exit /b 0

:fail
echo.
echo Установка прервана.
pause
exit /b 1

REM ========== helpers ==========

:refresh_path
set "MachinePath="
set "UserPath="
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "MachinePath=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "UserPath=%%b"
if defined MachinePath set "PATH=%MachinePath%;%PATH%"
if defined UserPath set "PATH=%UserPath%;%PATH%"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
exit /b 0

:ensure_node
where node >nul 2>&1
if not errorlevel 1 exit /b 0

echo [!] Node.js не найден — ставлю LTS...
where winget >nul 2>&1
if not errorlevel 1 (
  echo --- winget: OpenJS.NodeJS.LTS ---
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  call :refresh_path
  where node >nul 2>&1
  if not errorlevel 1 exit /b 0
  echo [!] winget отработал, но node ещё не в PATH — пробую MSI...
)

echo --- Скачиваю официальный MSI Node.js LTS ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json';" ^
  "$rel = $idx | Where-Object { $_.lts } | Select-Object -First 1;" ^
  "$ver = $rel.version;" ^
  "$msi = Join-Path $env:TEMP 'utkina-nodejs-lts.msi';" ^
  "$url = \"https://nodejs.org/dist/$ver/node-$ver-x64.msi\";" ^
  "Write-Host ('URL: ' + $url);" ^
  "Invoke-WebRequest -Uri $url -OutFile $msi;" ^
  "Start-Process msiexec.exe -ArgumentList @('/i', $msi, '/qn', '/norestart') -Wait -Verb RunAs;"
if errorlevel 1 (
  echo [ОШИБКА] Не удалось установить Node.js автоматически.
  echo Скачайте вручную: https://nodejs.org/
  exit /b 1
)
call :refresh_path
where node >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Node установлен, но не виден в PATH.
  echo Закройте окно и снова запустите setup-windows.bat.
  exit /b 1
)
exit /b 0

:ensure_docker
where docker >nul 2>&1
if not errorlevel 1 (
  docker info >nul 2>&1
  if not errorlevel 1 exit /b 0
  echo [!] docker есть, но движок не отвечает — попробую запустить Docker Desktop...
  call :start_docker_desktop
  exit /b 0
)

echo [!] Docker не найден — ставлю Docker Desktop...
where winget >nul 2>&1
if not errorlevel 1 (
  echo --- winget: Docker.DockerDesktop ---
  winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
  if not errorlevel 1 (
    echo [OK] Docker Desktop установлен через winget.
    echo     Часто нужен reboot и первый запуск Docker Desktop.
    call :start_docker_desktop
    exit /b 0
  )
  echo [!] winget не смог поставить Docker — скачиваю установщик...
)

echo --- Скачиваю Docker Desktop Installer ---
set "DOCKER_SETUP=%TMPDIR%\DockerDesktopInstaller.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$url='https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe';" ^
  "Invoke-WebRequest -Uri $url -OutFile '%DOCKER_SETUP%';"
if errorlevel 1 (
  echo [ОШИБКА] Не удалось скачать Docker Desktop.
  echo Вручную: https://docs.docker.com/desktop/setup/install/windows-install/
  exit /b 1
)

echo Запускаю установщик Docker Desktop (может запросить UAC / reboot)...
"%DOCKER_SETUP%" install --quiet --accept-license
if errorlevel 1 (
  echo [!] Тихая установка вернула код ошибки — пробую интерактивно...
  start /wait "" "%DOCKER_SETUP%"
)

call :start_docker_desktop
exit /b 0

:start_docker_desktop
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
  start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
)
exit /b 0

:wait_docker_engine
echo Ждём движок Docker (до ~2 мин)...
set /a "DTRIES=0"
:wait_docker_loop
set /a "DTRIES+=1"
docker info >nul 2>&1
if not errorlevel 1 exit /b 0
if !DTRIES! GEQ 24 (
  echo [!] Docker engine так и не ответил.
  exit /b 1
)
if !DTRIES! EQU 1 call :start_docker_desktop
timeout /t 5 /nobreak >nul
goto :wait_docker_loop
