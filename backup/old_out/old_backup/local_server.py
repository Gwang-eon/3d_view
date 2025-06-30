#!/usr/bin/env python3
"""
간단한 HTTP 서버 - 옹벽 3D 뷰어용
"""

import os
import sys
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socket

# 기본 포트 설정
PORT = 8000

# 이미 사용 중인 포트인지 확인하고 필요하면 다른 포트 사용
def find_free_port(start_port):
    port = start_port
    while port < start_port + 100:  # 최대 100개 포트 시도
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            port += 1
    raise RuntimeError("사용 가능한 포트를 찾을 수 없습니다")

# 메인 함수
def main():
    # 현재 디렉토리 출력
    current_dir = os.path.abspath(os.getcwd())
    print(f"현재 디렉토리: {current_dir}")
    
    # GLTF 폴더 확인
    gltf_dir = os.path.join(current_dir, 'gltf')
    if not os.path.exists(gltf_dir):
        print(f"경고: 'gltf' 폴더를 찾을 수 없습니다: {gltf_dir}")
    else:
        print(f"GLTF 폴더 확인: {gltf_dir}")
        # GLTF 폴더 내용 확인
        subfolders = [f for f in os.listdir(gltf_dir) if os.path.isdir(os.path.join(gltf_dir, f))]
        print(f"발견된 GLTF 서브폴더: {', '.join(subfolders) if subfolders else '없음'}")
    
    # 사용 가능한 포트 찾기
    port = find_free_port(PORT)
    
    # 서버 주소
    server_address = ('', port)
    
    # HTTP 서버 시작
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    
    # 서버 URL
    url = f"http://localhost:{port}/debug-helper.html"
    
    print(f"\n{'='*60}")
    print(f"옹벽 3D 뷰어 로컬 서버가 시작되었습니다!")
    print(f"{'='*60}")
    print(f"브라우저에서 다음 URL을 열어주세요:")
    print(f"  {url}")
    print(f"\n서버를 종료하려면 Ctrl+C를 누르세요.")
    print(f"{'='*60}")
    
    # 브라우저 자동 열기
    try:
        webbrowser.open(url)
    except:
        pass
    
    # 서버 실행
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버가 종료되었습니다.")
        httpd.server_close()
        sys.exit(0)

if __name__ == "__main__":
    main() 