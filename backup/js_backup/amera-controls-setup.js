// camera-controls-setup.js - 카메라 컨트롤 추가 설정
// viewer.html에서 사용하는 추가 카메라 컨트롤 설정

export function setupCameraControls(app) {
    console.log('[CameraControls] 추가 카메라 컨트롤 설정 시작');
    
    // 카메라 전환 인디케이터 생성
    let cameraTransitionIndicator = null;
    
    // 카메라 상태
    const cameraState = {
        currentOrbitAngle: 0,
        savedViews: new Map()
    };
    
    // 카메라 전환 표시 함수
    function showCameraTransitionIndicator(message) {
        if (!cameraTransitionIndicator) {
            cameraTransitionIndicator = document.createElement('div');
            cameraTransitionIndicator.className = 'camera-hint';
            document.body.appendChild(cameraTransitionIndicator);
        }
        
        cameraTransitionIndicator.textContent = message;
        cameraTransitionIndicator.style.display = 'block';
        cameraTransitionIndicator.style.animation = 'none';
        
        setTimeout(() => {
            cameraTransitionIndicator.style.animation = 'camera-transition-hint 2s ease-out';
        }, 10);
        
        setTimeout(() => {
            cameraTransitionIndicator.style.display = 'none';
        }, 2000);
    }
    
    // 1. 기본 뷰 버튼
    const defaultViewBtn = document.getElementById('default-view');
    if (defaultViewBtn) {
        defaultViewBtn.addEventListener('click', () => {
            showCameraTransitionIndicator('기본 뷰');
            if (app.sceneManager) {
                app.sceneManager.setCameraView('default', {
                    duration: 1.5,
                    easeType: 'easeInOutCubic'
                });
            }
        });
    }
    
    // 2. 리셋 버튼
    const resetViewBtn = document.getElementById('reset-view');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            showCameraTransitionIndicator('뷰 리셋');
            
            if (app.sceneManager) {
                app.sceneManager.setCameraView('default', {
                    duration: 1.0,
                    easeType: 'easeOutQuad'
                });
            }
        });
    }
    
    // 3. 모델 포커스 버튼
    const focusModelBtn = document.getElementById('focus-model');
    if (focusModelBtn) {
        focusModelBtn.addEventListener('click', () => {
            showCameraTransitionIndicator('모델 포커스');
            
            if (app.sceneManager) {
                app.sceneManager.setCameraView('focus-model', {
                    duration: 1.2,
                    easeType: 'easeOutCubic'
                });
            }
        });
    }
    
    // 4. 회전 뷰 버튼
    const orbitViewBtn = document.getElementById('orbit-view');
    if (orbitViewBtn) {
        orbitViewBtn.addEventListener('click', () => {
            cameraState.currentOrbitAngle = (cameraState.currentOrbitAngle + 90) % 360;
            showCameraTransitionIndicator(`${cameraState.currentOrbitAngle}° 회전`);
            
            if (app.sceneManager) {
                app.sceneManager.setCameraView(`orbit-${cameraState.currentOrbitAngle}`, {
                    duration: 1.5,
                    easeType: 'easeInOutSine'
                });
            }
        });
    }
    
    // 5. 줌 컨트롤
    const zoomControls = {
        'zoom-in': () => {
            if (app.sceneManager) {
                app.sceneManager.setCameraView('zoom-in', { duration: 0.5 });
            }
        },
        'zoom-out': () => {
            if (app.sceneManager) {
                app.sceneManager.setCameraView('zoom-out', { duration: 0.5 });
            }
        },
        'zoom-fit': () => {
            showCameraTransitionIndicator('화면 맞춤');
            if (app.sceneManager) {
                app.sceneManager.setCameraView('focus-model', { duration: 1.0 });
            }
        }
    };
    
    Object.entries(zoomControls).forEach(([id, handler]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', handler);
        }
    });
    
    // 6. 카메라 전환 속도
    const cameraSpeedSelect = document.getElementById('camera-speed');
    if (cameraSpeedSelect) {
        cameraSpeedSelect.addEventListener('change', (e) => {
            const duration = parseFloat(e.target.value);
            if (app.sceneManager) {
                app.sceneManager.setCameraTransitionDuration(duration);
            }
        });
    }
    
    // 7. 이징 효과
    const cameraEasingSelect = document.getElementById('camera-easing');
    if (cameraEasingSelect) {
        cameraEasingSelect.addEventListener('change', (e) => {
            if (app.sceneManager) {
                app.sceneManager.setCameraTransitionEasing(e.target.value);
            }
        });
    }
    
    // 8. 밝기 조절
    const brightnessSlider = document.getElementById('brightness-slider');
    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', (e) => {
            const brightness = parseFloat(e.target.value);
            if (app.sceneManager) {
                app.sceneManager.setLightIntensity('ambient', 0.6 * brightness);
                app.sceneManager.setLightIntensity('directional', 0.8 * brightness);
            }
        });
    }
    
    // 9. 스크린샷 기능
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            takeScreenshot(app.sceneManager.renderer);
        });
    }
    
    // 10. 키보드 단축키 (추가)
    document.addEventListener('keydown', (e) => {
        // R 키: 리셋
        if (e.key === 'r' || e.key === 'R') {
            showCameraTransitionIndicator('뷰 리셋');
            if (app.sceneManager) {
                app.sceneManager.setCameraView('default');
            }
        }
        
        // G 키: 그리드 토글
        if (e.key === 'g' || e.key === 'G') {
            if (app.sceneManager) {
                app.sceneManager.toggleGrid();
            }
        }
        
        // S 키: 스크린샷
        if (e.key === 's' || e.key === 'S') {
            if (!e.ctrlKey) { // Ctrl+S 방지
                takeScreenshot(app.sceneManager.renderer);
            }
        }
    });
    
    console.log('[CameraControls] 추가 카메라 컨트롤 설정 완료');
}

// 핫스팟 핸들러 설정
export function setupHotspotHandler(app) {
    // 핫스팟 클릭 시 카메라 이동
    if (app.hotspotManager) {
        app.hotspotManager.onHotspotClick = (hotspot) => {
            console.log('[HotspotHandler] 핫스팟 클릭:', hotspot.name);
            
            if (app.sceneManager) {
                app.sceneManager.focusOnHotspot(hotspot, {
                    duration: 1.5,
                    easeType: 'easeOutCubic',
                    onComplete: () => {
                        // 핫스팟 정보 표시
                        showHotspotInfo(hotspot);
                    }
                });
            }
        };
    }
}

// 핫스팟 정보 표시
function showHotspotInfo(hotspot) {
    const infoPanel = document.createElement('div');
    infoPanel.className = 'hotspot-info-panel';
    infoPanel.innerHTML = `
        <h3>${hotspot.name}</h3>
        <p>${hotspot.description}</p>
        ${hotspot.details ? `<p class="details">${hotspot.details}</p>` : ''}
        <button class="close-btn">닫기</button>
    `;
    
    infoPanel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #00ff88;
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        z-index: 1000;
        color: white;
    `;
    
    document.body.appendChild(infoPanel);
    
    infoPanel.querySelector('.close-btn').addEventListener('click', () => {
        infoPanel.remove();
    });
    
    // ESC 키로 닫기
    const closeOnEsc = (e) => {
        if (e.key === 'Escape') {
            infoPanel.remove();
            document.removeEventListener('keydown', closeOnEsc);
        }
    };
    document.addEventListener('keydown', closeOnEsc);
}

// 스크린샷 기능
function takeScreenshot(renderer) {
    if (!renderer) return;
    
    // 현재 프레임 렌더링
    renderer.render();
    
    // Canvas를 이미지로 변환
    const canvas = renderer.domElement;
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screenshot_${new Date().getTime()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // 스크린샷 알림
    const notification = document.createElement('div');
    notification.textContent = '📸 스크린샷 저장됨';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 255, 136, 0.9);
        color: black;
        padding: 12px 24px;
        border-radius: 24px;
        font-weight: bold;
        animation: slideInUp 0.3s ease-out;
        z-index: 10000;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutDown 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 디버그 패널 토글 (개발 모드용)
export function setupDebugPanel(app) {
    if (!app.config?.debug) return;
    
    const debugPanel = document.createElement('div');
    debugPanel.className = 'debug-panel';
    debugPanel.innerHTML = `
        <h4>디버그 패널</h4>
        <div id="debug-info">
            <p>카메라 위치: <span id="cam-pos">-</span></p>
            <p>카메라 타겟: <span id="cam-target">-</span></p>
            <p>모델 바운딩 박스: <span id="model-bounds">-</span></p>
            <p>FPS: <span id="debug-fps">-</span></p>
        </div>
        <button id="toggle-wireframe">와이어프레임 토글</button>
        <button id="toggle-helpers">헬퍼 토글</button>
    `;
    
    document.body.appendChild(debugPanel);
    
    // 디버그 정보 업데이트
    setInterval(() => {
        if (app.sceneManager) {
            const cam = app.sceneManager.camera;
            const controls = app.sceneManager.controls;
            
            document.getElementById('cam-pos').textContent = 
                `${cam.position.x.toFixed(2)}, ${cam.position.y.toFixed(2)}, ${cam.position.z.toFixed(2)}`;
            
            document.getElementById('cam-target').textContent = 
                `${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)}`;
        }
    }, 100);
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slideOutDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100%); opacity: 0; }
    }
    
    .hotspot-info-panel h3 {
        margin: 0 0 10px 0;
        color: #00ff88;
    }
    
    .hotspot-info-panel .details {
        font-size: 14px;
        color: #aaa;
        margin: 10px 0;
    }
    
    .hotspot-info-panel .close-btn {
        background: #00ff88;
        color: black;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        margin-top: 10px;
        width: 100%;
    }
    
    .hotspot-info-panel .close-btn:hover {
        background: #00cc70;
    }
`;
document.head.appendChild(style);