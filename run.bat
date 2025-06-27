@echo off
echo 옹벽 3D 뷰어를 시작합니다...

:: 임시 프로필 폴더 생성
set TEMP_PROFILE=%cd%\chrome-temp-profile

:: Chrome 실행 (독립 프로필)
start chrome.exe --user-data-dir="%TEMP_PROFILE%" --allow-file-access-from-files "file:///%cd:\=/%/index.html"

echo.
echo 종료하려면 Chrome을 닫으세요.
echo 임시 프로필 폴더는 수동으로 삭제하세요: chrome-temp-profile