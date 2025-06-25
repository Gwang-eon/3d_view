// js/AnimationController.js
// 애니메이션 제어 모듈

export class AnimationController {
    constructor() {
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.clock = new THREE.Clock();
        this.isPlaying = false;
        
        console.log('[AnimationController] 초기화 완료');
    }
    
    setAnimations(animations) {
        if (!animations || animations.length === 0) {
            console.log('[AnimationController] 애니메이션이 없습니다.');
            return;
        }
        
        console.log(`[AnimationController] ${animations.length}개 애니메이션 설정`);
        
        // 이전 애니메이션 정리
        this.cleanup();
        
        // 새 믹서 생성
        this.mixer = new THREE.AnimationMixer(animations[0].target || animations[0]);
        
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
        }
    }
    
    pause() {
        if (this.activeAction && this.isPlaying) {
            this.activeAction.paused = true;
            this.isPlaying = false;
            console.log('[AnimationController] 애니메이션 일시정지');
        }
    }
    
    stop() {
        if (this.activeAction) {
            this.activeAction.stop();
            this.isPlaying = false;
            console.log('[AnimationController] 애니메이션 정지');
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
        }
    }
    
    update() {
        if (this.mixer && this.isPlaying) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
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
    }
}