// viewer-init.js - viewer.html에서 URL 파라미터로 모델 자동 로드

import { CONFIG } from './config.js';

export class ViewerInitializer {
    constructor(uiController) {
        this.uiController = uiController;
        this.urlParams = new URLSearchParams(window.location.search);
    }
    
    // URL 파라미터에서 모델 ID 가져오기
    getModelIdFromURL() {
        return this.urlParams.get('model');
    }
    
    // 모델 ID로 모델 정보 찾기
    getModelById(modelId) {
        const id = parseInt(modelId);
        if (isNaN(id) || id < 0 || id >= CONFIG.models.length) {
            return null;
        }
        return CONFIG.models[id];
    }
    
    // 초기화 및 자동 로드
    async initialize() {
        const modelId = this.getModelIdFromURL();
        
        if (modelId !== null) {
            const model = this.getModelById(modelId);
            
            if (model) {
                console.log(`[ViewerInit] URL 파라미터로 모델 자동 로드: ${model.name}`);
                
                // 로딩 화면 표시
                this.showLoadingMessage(`${model.name} 로딩 중...`);
                
                try {
                    // 모델 선택 화면 숨기기
                    const modelSelector = document.getElementById('model-selector');
                    if (modelSelector) {
                        modelSelector.style.display = 'none';
                    }
                    
                    // 직접 모델 로드
                    await this.uiController.selectModel(model);
                    
                    // 상단 토글 버튼 활성화 (improved 버전인 경우)
                    this.activateToggleButton(modelId);
                    
                } catch (error) {
                    console.error('[ViewerInit] 모델 로드 실패:', error);
                    this.showError('모델을 로드할 수 없습니다.');
                    
                    // 에러 시 모델 선택 화면으로
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 3000);
                }
            } else {
                console.warn(`[ViewerInit] 잘못된 모델 ID: ${modelId}`);
                this.showError('잘못된 모델 ID입니다.');
                
                // 잘못된 ID면 메인으로
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        } else {
            // URL 파라미터가 없으면 모델 선택 화면 표시
            console.log('[ViewerInit] URL 파라미터 없음 - 모델 선택 화면 표시');
            this.uiController.showModelSelector();
        }
    }
    
    // 로딩 메시지 표시
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
    
    // 에러 메시지 표시
    showError(message) {
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
    
    // 상단 토글 버튼 활성화 (improved 버전)
    activateToggleButton(modelId) {
        const modelTypeMap = ['block', 'cantilever', 'mse'];
        const modelType = modelTypeMap[modelId];
        
        if (modelType) {
            const toggleBtn = document.querySelector(`[data-model="${modelType}"]`);
            if (toggleBtn) {
                // 모든 버튼 비활성화
                document.querySelectorAll('.model-toggle-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // 선택된 버튼 활성화
                toggleBtn.classList.add('active');
            }
        }
    }
    
    // 홈으로 돌아가기 버튼 추가
    addHomeButton() {
        const homeBtn = document.createElement('button');
        homeBtn.id = 'home-btn';
        homeBtn.className = 'header-btn';
        homeBtn.title = '홈으로';
        homeBtn.innerHTML = '<span>🏠</span>';
        homeBtn.onclick = () => {
            window.location.href = 'index.html';
        };
        
        // 헤더 우측에 추가
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.insertBefore(homeBtn, headerRight.firstChild);
        }
    }
}

// UIController 수정 제안 (기존 UIController에 추가할 메서드)
export function enhanceUIController(UIController) {
    // 모델 선택 시 URL 업데이트
    const originalSelectModel = UIController.prototype.selectModel;
    
    UIController.prototype.selectModel = async function(model) {
        // 기존 selectModel 실행
        const result = await originalSelectModel.call(this, model);
        
        // URL 파라미터 업데이트 (브라우저 히스토리에 추가)
        const modelIndex = CONFIG.models.findIndex(m => m.name === model.name);
        if (modelIndex !== -1) {
            const newUrl = `${window.location.pathname}?model=${modelIndex}`;
            window.history.pushState({ model: modelIndex }, '', newUrl);
        }
        
        return result;
    };
    
    // 브라우저 뒤로가기 처리
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.model !== undefined) {
            const model = CONFIG.models[event.state.model];
            if (model) {
                this.selectModel(model);
            }
        } else {
            // 홈으로
            window.location.href = 'index.html';
        }
    });
}