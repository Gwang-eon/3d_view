// js/progressive-loader.js - 프로그레시브 로딩 시스템

import { ModelLoader } from './loader.js';

export class ProgressiveLoader extends ModelLoader {
    constructor(config = {}) {
        super(config);
        
        // 로딩 상태
        this.loadingStates = {
            IDLE: 'idle',
            PREVIEW_LOADING: 'preview-loading',
            PREVIEW_LOADED: 'preview-loaded',
            MODEL_LOADING: 'model-loading',
            MODEL_PROCESSING: 'model-processing',
            COMPLETE: 'complete',
            ERROR: 'error'
        };
        
        this.currentState = this.loadingStates.IDLE;
        this.progress = 0;
        
        // 콜백
        this.onStateChange = config.onStateChange || (() => {});
        this.onProgress = config.onProgress || (() => {});
        
        // 프리뷰 캐시
        this.previewCache = new Map();
        
        // LoadingManager 재설정
        this.setupLoadingManager();
    }
    
    /**
     * LoadingManager 설정
     */
    setupLoadingManager() {
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`🚀 로딩 시작: ${itemsLoaded}/${itemsTotal}`);
            this.updateState(this.loadingStates.MODEL_LOADING);
        };
        
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = Math.round((itemsLoaded / itemsTotal) * 100);
            this.updateProgress(progress);
        };
        
        this.loadingManager.onLoad = () => {
            console.log('✅ 모든 리소스 로드 완료');
            this.updateState(this.loadingStates.MODEL_PROCESSING);
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`❌ 로드 오류: ${url}`);
            this.updateState(this.loadingStates.ERROR);
        };
    }
    
    /**
     * 상태 업데이트
     */
    updateState(state) {
        this.currentState = state;
        this.onStateChange(state);
        
        // 상태별 진행률 설정
        const stateProgress = {
            [this.loadingStates.IDLE]: 0,
            [this.loadingStates.PREVIEW_LOADING]: 10,
            [this.loadingStates.PREVIEW_LOADED]: 20,
            [this.loadingStates.MODEL_LOADING]: 50,
            [this.loadingStates.MODEL_PROCESSING]: 90,
            [this.loadingStates.COMPLETE]: 100,
            [this.loadingStates.ERROR]: 0
        };
        
        this.updateProgress(stateProgress[state] || this.progress);
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress(progress) {
        this.progress = progress;
        this.onProgress(progress);
    }
    
    /**
     * 프리뷰 이미지 로드
     */
    async loadPreview(modelPath) {
        // 캐시 확인
        if (this.previewCache.has(modelPath)) {
            return this.previewCache.get(modelPath);
        }
        
        this.updateState(this.loadingStates.PREVIEW_LOADING);
        
        // 프리뷰 경로 생성 (같은 폴더의 preview.jpg)
        const previewPath = modelPath.replace(/\.gltf$/i, '').replace(/[^\/]+$/, 'preview.jpg');
        
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const loaded = await new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('프리뷰 로드 실패'));
                img.src = previewPath;
            });
            
            this.previewCache.set(modelPath, loaded);
            this.updateState(this.loadingStates.PREVIEW_LOADED);
            
            return loaded;
        } catch (error) {
            console.warn('프리뷰 이미지 로드 실패:', error);
            // 프리뷰 실패해도 계속 진행
            this.updateState(this.loadingStates.PREVIEW_LOADED);
            return null;
        }
    }
    
    /**
     * 모델과 프리뷰를 함께 로드
     */
    async loadWithPreview(modelPath) {
        try {
            this.updateState(this.loadingStates.IDLE);
            
            // 1. 프리뷰 이미지 먼저 로드
            const previewImage = await this.loadPreview(modelPath);
            
            // 2. 모델 로드
            const gltf = await this.loadGLTF(modelPath);
            
            // 3. 후처리
            this.updateState(this.loadingStates.MODEL_PROCESSING);
            await this.postProcessModel(gltf);
            
            // 4. 완료
            this.updateState(this.loadingStates.COMPLETE);
            
            return {
                gltf,
                preview: previewImage,
                success: true
            };
            
        } catch (error) {
            this.updateState(this.loadingStates.ERROR);
            throw error;
        }
    }
    
    /**
     * 모델 후처리 (최적화, 매터리얼 조정 등)
     */
    async postProcessModel(gltf) {
        // 약간의 지연으로 후처리 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 실제 후처리 작업
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                // 그림자 설정
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 매터리얼 최적화
                if (child.material) {
                    child.material.needsUpdate = true;
                }
            }
        });
        
        console.log('✅ 모델 후처리 완료');
    }
    
    /**
     * 로딩 상태 리셋
     */
    reset() {
        this.currentState = this.loadingStates.IDLE;
        this.progress = 0;
        this.updateProgress(0);
    }
}

/**
 * 로딩 상태별 메시지
 */
export const LOADING_MESSAGES = {
    'idle': '대기 중...',
    'preview-loading': '프리뷰 로드 중...',
    'preview-loaded': '프리뷰 준비 완료',
    'model-loading': '3D 모델 로드 중...',
    'model-processing': '모델 최적화 중...',
    'complete': '로드 완료!',
    'error': '로드 실패'
};