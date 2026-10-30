@echo off
chcp 65001 >nul
echo ========================================================
echo   Alta Badia Mountain Huts Challenge - Setup Capacitor
echo ========================================================
echo.
echo Controllo installazione Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ATTENZIONE] Node.js non e' installato su questo PC.
    echo Per compilare in locale, installa Node.js da https://nodejs.org
    echo Oppure carica questo progetto su GitHub per far compilare l'APK
    echo automaticamente e gratis a GitHub Actions!
    pause
    exit /b 1
)

echo Installazione dipendenze e plugin background geolocation...
call npm install
echo.
echo Sincronizzazione progetto Android...
call npx cap sync android
echo.
echo ========================================================
echo Setup completato con successo!
echo Per aprire il progetto in Android Studio esegui:
echo   npx cap open android
echo ========================================================
pause
