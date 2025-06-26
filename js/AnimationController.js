// js/AnimationController.js
// 애니메이션 제어 모듈 - 이벤트 시스템 추가된 완성 버전

export class AnimationController {
    constructor() {
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.clock = new THREE.Clock();
        this.isPlaying = false;
        
        // 이벤트 시스템 추가
        this.events = new Map();
        
        console.log('[AnimationController] 초기화 완료');
    }
    
    setAnimations(animations, targetModel) {
        if (!animations || animations.length === 0) {
            console.log('[AnimationController] 애니메이션이 없습니다.');
            return;
        }
        
        if (!targetModel) {
            console.error('[AnimationController] 타겟 모델이 없습니다.');
            return;
        }
        
        console.log(`[AnimationController] ${animations.length}개 애니메이션 설정`);
        
        // 이전 애니메이션 정리
        this.cleanup();
        
        // 새 믹서 생성
        this.mixer = new THREE.AnimationMixer(targetModel);
        
        // 각 애니메이션에 대한 액션 생성
        animations.forEach((clip, index) => {
            const action = this.mixer.clipAction(clip);
            this.actions[clip.name || `Animation_${index}`] = action;
            
            console.log(`[AnimationController] 애니메이션 추가: ${clip.name || `Animation_${index}`}`);
        });
        
        // 첫 번째 애니메이션을 기본으로 설정
        const firstKey = Object.keys(this.actions)[0];
        if (firstKey) {
            this.activeAction = this.actions[firstKey];
        }
        
        // 애니메이션 설정 완료 이벤트
        this.emit('animations:loaded', { count: animations.length });
    }
    
    play(animationName = null) {
        if (!this.mixer) {
            console.warn('[AnimationController] 믹서가 설정되지 않았습니다.');
            return;
        }
        
        // 특정 애니메이션 지정
        if (animationName && this.actions[animationName]) {
            if (this.activeAction && this.activeAction !== this.actions[animationName]) {
                this.activeAction.stop();
            }
            this.activeAction = this.actions[animationName];
        }
        
        if (this.activeAction) {
            this.activeAction.play();
            this.isPlaying = true;
            console.log('[AnimationController] 애니메이션 재생 시작');
            
            // 재생 시작 이벤트
            this.emit('animation:start', {
                clipName: this.activeAction.getClip().name,
                duration: this.activeAction.getClip().duration
            });
        }
    }
    
    pause() {
        if (this.activeAction && this.isPlaying) {
            this.activeAction.paused = true;
            this.isPlaying = false;
            console.log('[AnimationController] 애니메이션 일시정지');
            
            // 일시정지 이벤트
            this.emit('animation:pause', {
                clipName: this.activeAction.getClip().name,
                currentTime: this.activeAction.time
            });
        }
    }
    
    stop() {
        if (this.activeAction) {
            this.activeAction.stop();
            this.isPlaying = false;
            console.log('[AnimationController] 애니메이션 정지');
            
            // 정지 이벤트
            this.emit('animation:stop', {
                clipName: this.activeAction.getClip().name
            });
        }
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    setTimeScale(scale) {
        if (this.mixer) {
            this.mixer.timeScale = scale;
            console.log(`[AnimationController] 재생 속도: ${scale}x`);
            
            // 속도 변경 이벤트
            this.emit('animation:speed', { scale });
        }
    }
    
    update() {
        if (this.mixer && this.isPlaying) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
            
            // 진행 상황 업데이트
            const progress = this.getProgress();
            this.emit('animation:progress', progress);
            
            // 애니메이션 완료 확인
            if (this.activeAction && this.activeAction.time >= this.activeAction.getClip().duration) {
                this.emit('animation:complete', {
                    clipName: this.activeAction.getClip().name
                });
            }
        }
    }
    
    getProgress() {
        if (this.activeAction && this.activeAction.getClip()) {
            const clip = this.activeAction.getClip();
            const currentTime = this.activeAction.time;
            const duration = clip.duration;
            return (currentTime / duration) * 100;
        }
        return 0;
    }
    
    setProgress(progress) {
        if (this.activeAction && this.activeAction.getClip()) {
            const clip = this.activeAction.getClip();
            const duration = clip.duration;
            this.activeAction.time = (progress / 100) * duration;
            
            // 진행 위치 변경 이벤트
            this.emit('animation:seek', { progress, time: this.activeAction.time });
        }
    }
    
    hasAnimations() {
        return Object.keys(this.actions).length > 0;
    }
    
    getAnimationList() {
        return Object.keys(this.actions).map(name => ({
            name: name,
            duration: this.actions[name].getClip().duration,
            isActive: this.activeAction === this.actions[name]
        }));
    }
    
    switchAnimation(animationName) {
        if (this.actions[animationName]) {
            const wasPlaying = this.isPlaying;
            
            if (wasPlaying) {
                this.stop();
            }
            
            this.activeAction = this.actions[animationName];
            
            if (wasPlaying) {
                this.play();
            }
            
            // 애니메이션 전환 이벤트
            this.emit('animation:switch', { 
                newAnimation: animationName,
                wasPlaying 
            });
        } else {
            console.warn(`[AnimationController] 애니메이션을 찾을 수 없습니다: ${animationName}`);
        }
    }
    
    cleanup() {
        this.stop();
        
        // 모든 액션 정리
        Object.values(this.actions).forEach(action => {
            action.stop();
        });
        
        this.actions = {};
        this.activeAction = null;
        this.mixer = null;
        
        // 정리 완료 이벤트
        this.emit('animation:cleanup');
    }
    
    // 이벤트 시스템
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        return this;
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
        return this;
    }
    
    emit(event, data = {}) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[AnimationController] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
        return this;
    }
    
    // 상태 조회
    getState() {
        return {
            isPlaying: this.isPlaying,
            hasAnimations: this.hasAnimations(),
            currentAnimation: this.activeAction ? this.activeAction.getClip().name : null,
            progress: this.getProgress(),
            timeScale: this.mixer ? this.mixer.timeScale : 1,
            animations: this.getAnimationList()
        };
    }
    
    // 디버그 정보
    debug() {
        console.group('[AnimationController] 디버그 정보');
        console.log('상태:', this.getState());
        console.log('액션 개수:', Object.keys(this.actions).length);
        console.log('믹서 존재:', !!this.mixer);
        console.log('현재 재생 중:', this.isPlaying);
        console.groupEnd();
    }
}