@echo off
echo 옹벽 3D 뷰어를 시작합니다...
echo.

:: Python 설치 확인
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python이 설치되어 있지 않습니다!
    echo Python 3.x를 설치하거나 기존 방식으로 실행합니다...
    echo.
    goto :FileProtocol
)

:: Python 웹서버 시작
echo Python 웹서버를 시작합니다...
echo 포트: 8000
echo.

:: 서버 시작 (백그라운드)
start /B python -m http.server 8000

:: 잠시 대기 (서버 시작 시간)
timeout /t 2 /nobreak >nul

:: Chrome으로 열기
echo 브라우저를 실행합니다...
start chrome.exe "http://localhost:8000/viewer.html"

echo.
echo ===================================
echo 웹서버가 실행 중입니다.
echo 주소: http://localhost:8000
echo ===================================
echo.
echo 종료하려면 이 창을 닫으세요.
echo.

:: 서버 유지
python -m http.server 8000
goto :End

:FileProtocol
:: Python이 없을 때 기존 방식 사용
echo file:// 프로토콜로 실행합니다 (일부 기능 제한)
echo.
set TEMP_PROFILE=%cd%\chrome-temp-profile
start chrome.exe --user-data-dir="%TEMP_PROFILE%" --allow-file-access-from-files "file:///%cd:\=/%/viewer.html"
echo.
echo 종료하려면 Chrome을 닫으세요.
pause

:End