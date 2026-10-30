@echo off
chcp 65001 >nul
echo ========================================================
echo   Compilazione APK Android Locale
echo ========================================================
echo.
cd android
if exist gradlew.bat (
    call gradlew.bat assembleDebug
    echo.
    echo ========================================================
    echo APK compilato con successo! Lo trovi in:
    echo android\app\build\outputs\apk\debug\app-debug.apk
    echo ========================================================
) else (
    echo [ERRORE] File gradlew.bat non trovato. Esegui prima setup_capacitor.bat
)
pause
