// camera-controls-setup.js
// viewer.html의 카메라 관련 컨트롤 설정
// viewer-main.js에 추가하거나 별도 모듈로 사용

export function setupCameraControls(app) {
    console.log('[CameraControls] 카메라 컨트롤 설정 시작');
    
    // 카메라 전환 상태 관리
    const cameraState = {
        currentOrbitAngle: 0,
        transitionIndicator: null
    };
    
    // 카메라 전환 인디케이터
    function showCameraTransitionIndicator(message) {
        if (!cameraState.transitionIndicator) {
            cameraState.transitionIndicator = document.querySelector('.camera-transition-indicator');
        }
        
        if (cameraState.transitionIndicator) {
            cameraState.transitionIndicator.textContent = message;
            cameraState.transitionIndicator.style.opacity = '1';
            
            // 2초 후 자동 숨김
            setTimeout(() => {
                cameraState.transitionIndicator.style.opacity = '0';
            }, 2000);
        }
    }
    
    // 알림 표시
    function showNotification(message, type = 'info') {
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // 1. 홈 버튼
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // 2. 프리셋 뷰 버튼
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            showCameraTransitionIndicator(`${view} 뷰로 전환`);
            
            if (app.sceneManager) {
                app.sceneManager.setCameraView(view, {
                    duration: 1.0,
                    priority: 'high'
                });
            }
        });
    });
    
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
    
    // 8. 키보드 단축키
    const keyboardShortcuts = {
        '1': () => {
            showCameraTransitionIndicator('기본 뷰');
            app.sceneManager?.setCameraView('default');
        },
        '2': () => {
            showCameraTransitionIndicator('모델 포커스');
            app.sceneManager?.setCameraView('focus-model');
        },
        '3': () => {
            showCameraTransitionIndicator('정면 뷰');
            app.sceneManager?.setCameraView('front');
        },
        '4': () => {
            showCameraTransitionIndicator('우측 뷰');
            app.sceneManager?.setCameraView('right');
        },
        '5': () => {
            showCameraTransitionIndicator('상단 뷰');
            app.sceneManager?.setCameraView('top');
        },
        '6': () => {
            showCameraTransitionIndicator('등각 뷰');
            app.sceneManager?.setCameraView('isometric');
        },
        'r': () => {
            cameraState.currentOrbitAngle = (cameraState.currentOrbitAngle + 90) % 360;
            showCameraTransitionIndicator(`${cameraState.currentOrbitAngle}° 회전`);
            app.sceneManager?.setCameraView(`orbit-${cameraState.currentOrbitAngle}`);
        },
        'R': () => {
            cameraState.currentOrbitAngle = (cameraState.currentOrbitAngle - 90 + 360) % 360;
            showCameraTransitionIndicator(`${cameraState.currentOrbitAngle}° 회전`);
            app.sceneManager?.setCameraView(`orbit-${cameraState.currentOrbitAngle}`);
        },
        '+': () => app.sceneManager?.setCameraView('zoom-in'),
        '-': () => app.sceneManager?.setCameraView('zoom-out'),
        'f': () => {
            showCameraTransitionIndicator('모델 포커스');
            app.sceneManager?.setCameraView('focus-model');
        },
        'g': () => {
            const gridBtn = document.getElementById('toggle-grid');
            if (gridBtn) gridBtn.click();
        },
        'h': () => {
            const hotspotBtn = document.getElementById('toggle-hotspots');
            if (hotspotBtn) hotspotBtn.click();
        },
        'Escape': () => {
            app.sceneManager?.cancelCameraTransition();
            showNotification('카메라 전환 취소됨', 'info');
        }
    };
    
    document.addEventListener('keydown', (e) => {
        // 입력 필드에서는 단축키 비활성화
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const action = keyboardShortcuts[e.key];
        if (action) {
            e.preventDefault();
            action();
        }
    });
    
    // 9. 카메라 전환 이벤트 리스너
    if (app.sceneManager) {
        app.sceneManager.onCameraTransitionStart = (viewName) => {
            // 전환 중 버튼 비활성화
            document.querySelectorAll('.view-btn, .preset-btn, .zoom-btn').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            });
        };
        
        app.sceneManager.onCameraTransitionEnd = (viewName) => {
            // 전환 완료 후 버튼 재활성화
            document.querySelectorAll('.view-btn, .preset-btn, .zoom-btn').forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
        };
    }
    
    // 10. 스크린샷 기능
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            if (app.sceneManager?.renderer) {
                try {
                    app.sceneManager.render();
                    const canvas = app.sceneManager.renderer.domElement;
                    
                    canvas.toBlob((blob) => {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `wall-viewer-${new Date().toISOString().slice(0, 10)}.png`;
                        link.click();
                        URL.revokeObjectURL(url);
                        
                        showNotification('📸 스크린샷이 저장되었습니다', 'success');
                    }, 'image/png');
                } catch (error) {
                    console.error('스크린샷 오류:', error);
                    showNotification('스크린샷 저장 실패', 'error');
                }
            }
        });
    }
    
    // 11. 녹화 기능 (기본 구현)
    let isRecording = false;
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
        recordBtn.addEventListener('click', () => {
            isRecording = !isRecording;
            
            if (isRecording) {
                recordBtn.classList.add('recording');
                recordBtn.querySelector('span').textContent = '⏹️';
                showNotification('🔴 녹화를 시작합니다', 'info');
                // TODO: MediaRecorder API 구현
            } else {
                recordBtn.classList.remove('recording');
                recordBtn.querySelector('span').textContent = '🔴';
                showNotification('녹화가 중지되었습니다', 'info');
            }
        });
    }
    
    console.log('[CameraControls] 설정 완료');
    console.log('키보드 단축키: 1-6(뷰 전환), R(회전), +/-(줌), F(포커스), G(그리드), H(핫스팟), ESC(취소)');
    
    return {
        showCameraTransitionIndicator,
        showNotification,
        cameraState
    };
}

// 핫스팟 클릭 핸들러 개선
export function setupHotspotHandler(app) {
    if (!app.hotspotManager) return;
    
    app.hotspotManager.onHotspotClick = (hotspot) => {
        const hotspotDetail = document.getElementById('hotspot-detail');
        if (!hotspotDetail) return;
        
        // 우측 패널 열기
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel?.classList.contains('collapsed')) {
            rightPanel.classList.remove('collapsed');
            const toggle = document.getElementById('right-panel-toggle');
            if (toggle) toggle.textContent = '▶';
        }
        
        // 상세 정보 표시
        let detailHTML = `
            <div class="hotspot-info-container">
                <h4>${hotspot.userData.title || hotspot.name}</h4>
                ${hotspot.userData.description ? `<p class="description">${hotspot.userData.description}</p>` : ''}
                <div class="info-list">
        `;
        
        if (hotspot.userData.data) {
            Object.entries(hotspot.userData.data).forEach(([key, value]) => {
                const label = formatLabel(key);
                detailHTML += `
                    <div class="info-item">
                        <span class="info-label">${label}:</span>
                        <span class="info-value">${value}</span>
                    </div>
                `;
            });
        }
        
        detailHTML += `
                </div>
                <div class="hotspot-actions">
                    <button class="action-btn" onclick="window.focusOnHotspot('${hotspot.name}')">
                        🎯 포커스
                    </button>
                    <button class="action-btn" onclick="window.showHotspotAnalysis('${hotspot.name}')">
                        📊 분석
                    </button>
                </div>
            </div>
        `;
        
        hotspotDetail.innerHTML = detailHTML;
    };
    
    // 전역 함수 등록
    window.focusOnHotspot = (hotspotName) => {
        const hotspot = app.hotspotManager.hotspots.find(h => h.name === hotspotName);
        if (hotspot && app.sceneManager?.focusOnHotspot) {
            app.sceneManager.focusOnHotspot(hotspot, {
                duration: 1.2,
                onComplete: () => {
                    const { showNotification } = window.cameraControls || {};
                    if (showNotification) {
                        showNotification(`'${hotspotName}' 포커스 완료`, 'success');
                    }
                }
            });
        }
    };
    
    window.showHotspotAnalysis = (hotspotName) => {
        console.log(`핫스팟 분석: ${hotspotName}`);
        const { showNotification } = window.cameraControls || {};
        if (showNotification) {
            showNotification('분석 기능은 준비 중입니다', 'info');
        }
    };
}

// 라벨 포맷팅
function formatLabel(key) {
    const labelMap = {
        'type': '유형',
        'diameter': '직경',
        'material': '재질',
        'strength': '강도',
        'spacing': '간격',
        'depth': '깊이',
        'width': '너비',
        'height': '높이',
        'status': '상태',
        'lastInspection': '최근 점검일',
        'riskLevel': '위험도'
    };
    
    return labelMap[key] || key;
}