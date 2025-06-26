// js/viewer-init.js
// Viewer 초기화 헬퍼 - 수정된 완성 버전

import { getConfig } from './core/ConfigManager.js';

export class ViewerInitializer {
    constructor() {
        console.log('[ViewerInit] 초기화 헬퍼 생성');
        this.urlParams = new URLSearchParams(window.location.search);
    }
    
    getModelIdFromURL() {
        return this.urlParams.get('model');
    }
    
    getModelById(modelId) {
        const id = parseInt(modelId);
        // ✅ 수정: CONFIG.models 대신 getConfig 사용
        const models = getConfig('models.defaultModels', []);
        
        if (isNaN(id) || id < 0 || id >= models.length) {
            return null;
        }
        return models[id];
    }
    
    async initialize() {
        console.log('[ViewerInit] 초기화 시작');
        const modelId = this.getModelIdFromURL();
        
        if (modelId !== null) {
            const model = this.getModelById(modelId);
            
            if (model) {
                console.log(`[ViewerInit] URL 파라미터로 모델 자동 로드: ${model.name}`);
                this.showLoadingMessage(`${model.name} 로드 중...`);
                
                try {
                    const modelSelector = document.getElementById('model-selector');
                    if (modelSelector) {
                        modelSelector.style.display = 'none';
                    }
                    
                    await this.uiController.selectModel(model);
                    this.activateToggleButton(modelId);
                } catch (error) {
                    console.error('[ViewerInit] 모델 로드 실패:', error);
                    this.showError('모델을 로드할 수 없습니다.');
                }
            } else {
                console.warn(`[ViewerInit] 잘못된 모델 ID: ${modelId}`);
                this.showError('잘못된 모델 ID입니다.');
            }
        } else {
            console.log('[ViewerInit] URL 파라미터 없음 - 모델 선택 화면 표시');
            this.uiController.showModelSelector();
        }
    }
    
    activateToggleButton(modelId) {
        const modelTypes = ['block', 'cantilever', 'mse'];
        const modelType = modelTypes[parseInt(modelId)];
        
        if (modelType) {
            const btn = document.querySelector(`[data-model="${modelType}"]`);
            if (btn) {
                document.querySelectorAll('.model-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        }
    }
    
    addHomeButton() {
        const homeButton = document.createElement('button');
        homeButton.id = 'home-btn';
        homeButton.className = 'header-btn';
        homeButton.title = '홈으로';
        homeButton.innerHTML = '<span>🏠</span>';
        homeButton.onclick = () => {
            window.location.href = 'index.html';
        };
        
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.insertBefore(homeButton, headerRight.firstChild);
        } else {
            console.error('[ViewerInit] 헤더를 찾을 수 없습니다.');
        }
    }
    
    showLoadingMessage(message) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            const messageEl = loadingEl.querySelector('div:nth-child(2)');
            if (messageEl) {
                messageEl.textContent = message;
            }
            loadingEl.style.display = 'flex';
        }
    }
    
    showError(message) {
        const errorModal = document.getElementById('error-modal');
        if (errorModal) {
            const errorMessage = errorModal.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.textContent = message;
            }
            errorModal.style.display = 'flex';
            
            // 에러 메시지 자동 숨김
            setTimeout(() => {
                errorModal.style.display = 'none';
            }, getConfig('ui.errorMessageDuration', 5000));
        } else {
            alert(message);
        }
    }
    
    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
    
    /**
     * UIController 설정
     * @param {UIController} uiController 
     */
    setUIController(uiController) {
        this.uiController = uiController;
    }
    
    /**
     * 초기 UI 설정
     */
    setupInitialUI() {
        // 홈 버튼 추가
        this.addHomeButton();
        
        // 모델 선택 버튼 이벤트
        const modelButtons = document.querySelectorAll('.model-toggle-btn');
        modelButtons.forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                if (this.uiController) {
                    try {
                        // 버튼 활성화 상태 변경
                        modelButtons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        
                        // 모델 로드
                        await this.uiController.selectModel(index);
                    } catch (error) {
                        console.error('[ViewerInit] 모델 선택 실패:', error);
                        this.showError('모델을 로드할 수 없습니다.');
                    }
                }
            });
        });
        
        // 전체화면 버튼
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 설정 버튼
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (this.uiController) {
                    this.uiController.toggleSettings();
                }
            });
        }
        
        console.log('[ViewerInit] 초기 UI 설정 완료');
    }
    
    /**
     * 전체화면 토글
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('[ViewerInit] 전체화면 전환 실패:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * 모바일 장치 확인
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    /**
     * 브라우저 지원 확인
     */
    checkBrowserSupport() {
        const warnings = [];
        
        // WebGL 지원 확인
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            warnings.push('WebGL이 지원되지 않습니다.');
        }
        
        // 필수 API 확인
        if (!window.ResizeObserver) {
            warnings.push('ResizeObserver API가 지원되지 않습니다.');
        }
        
        if (!window.IntersectionObserver) {
            warnings.push('IntersectionObserver API가 지원되지 않습니다.');
        }
        
        if (warnings.length > 0) {
            console.warn('[ViewerInit] 브라우저 호환성 경고:', warnings);
            this.showBrowserWarning(warnings);
        }
        
        return warnings.length === 0;
    }
    
    /**
     * 브라우저 경고 표시
     */
    showBrowserWarning(warnings) {
        const warningEl = document.createElement('div');
        warningEl.className = 'browser-warning';
        warningEl.innerHTML = `
            <h3>브라우저 호환성 경고</h3>
            <p>다음 기능이 지원되지 않습니다:</p>
            <ul>
                ${warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
            <p>최신 브라우저를 사용해 주세요.</p>
            <button onclick="this.parentElement.remove()">확인</button>
        `;
        document.body.appendChild(warningEl);
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        if (getConfig('performance.enableMonitoring', true)) {
            // FPS 모니터링
            let frameCount = 0;
            let lastTime = performance.now();
            
            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();
                
                if (currentTime >= lastTime + 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    
                    // FPS 표시 업데이트
                    const fpsDisplay = document.getElementById('fps-display');
                    if (fpsDisplay) {
                        fpsDisplay.textContent = `${fps} FPS`;
                    }
                    
                    // 낮은 FPS 경고
                    if (fps < getConfig('performance.minAcceptableFPS', 20)) {
                        console.warn(`[ViewerInit] 낮은 FPS 감지: ${fps}`);
                    }
                    
                    frameCount = 0;
                    lastTime = currentTime;
                }
                
                requestAnimationFrame(updateFPS);
            };
            
            requestAnimationFrame(updateFPS);
        }
    }
}

// 전역 헬퍼 함수
export function createViewerInitializer() {
    return new ViewerInitializer();
}