@echo off
REM quick-setup.bat - 새 구조로 빠르게 전환하는 스크립트 (Windows)

echo ===================================
echo   옹벽 3D 뷰어 구조 변경 스크립트
echo ===================================
echo.

REM 1. 백업 디렉토리 생성
echo 1. 백업 생성 중...
set BACKUP_DIR=backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
mkdir %BACKUP_DIR% 2>nul

REM 2. 기존 파일 백업
if exist "index.html" (
    copy index.html "%BACKUP_DIR%\index.html.backup" >nul
    echo    √ index.html 백업 완료
)

if exist "index-improved.html" (
    copy index-improved.html "%BACKUP_DIR%\index-improved.html.backup" >nul
    echo    √ index-improved.html 백업 완료
)

REM 3. viewer.html 생성
echo.
echo 2. viewer.html 생성 중...
if exist "index-improved.html" (
    copy index-improved.html viewer.html >nul
    echo    √ viewer.html 생성 완료
) else (
    echo    경고: index-improved.html을 찾을 수 없습니다!
)

REM 4. JavaScript 디렉토리 확인
echo.
echo 3. JavaScript 디렉토리 확인...
if not exist "js" mkdir js
echo    √ js 디렉토리 준비 완료

REM 5. 안내 메시지
echo.
echo ===================================
echo 4. 다음 파일들을 수동으로 생성해주세요:
echo ===================================
echo    - index.html (새로운 랜딩페이지)
echo    - js\viewer-init.js
echo    - js\viewer-main.js
echo.
echo 5. viewer.html 수정 필요:
echo    찾기: ^<script type="module" src="js/main.js"^>^</script^>
echo    바꾸기: ^<script type="module" src="js/viewer-main.js"^>^</script^>
echo.
echo ===================================
echo √ 준비 완료!
echo 백업 위치: %BACKUP_DIR%
echo ===================================
echo.
echo 다음 단계:
echo 1. 위에서 안내한 파일들을 생성하세요
echo 2. viewer.html의 스크립트 경로를 수정하세요
echo 3. 서버를 실행하고 테스트하세요
echo.
pause