@echo off
title 옹벽 3D 뷰어 로컬 서버
echo ===================================================
echo      옹벽 3D 뷰어 로컬 서버 시작 스크립트
echo ===================================================
echo.

REM Python이 설치되어 있는지 확인
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python이 설치되어 있습니다. Python 서버를 시작합니다...
    echo.
    python local_server.py
) else (
    echo Python이 설치되어 있지 않습니다.
    echo 다른 방법으로 서버를 시작합니다...
    echo.
    
    REM Node.js가 설치되어 있는지 확인
    node --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo Node.js가 설치되어 있습니다. http-server를 시작합니다...
        echo.
        npx http-server -o debug-helper.html
    ) else (
        echo Node.js도 설치되어 있지 않습니다.
        echo.
        echo 웹 서버를 시작할 수 없습니다.
        echo Python 또는 Node.js를 설치하거나 VS Code의 Live Server를 사용하세요.
        echo.
        echo 자세한 내용은 debug-helper.html 파일을 참조하세요.
    )
)

echo.
echo 종료하려면 아무 키나 누르세요...
pause >nul 