import { CONFIG } from './config.js';

export class AnimationController {
    constructor() {
        this.mixer = null;
        this.animations = {};
        this.activeActions = [];
        this.isPlaying = false;
        this.clock = new THREE.Clock();
        this.currentTime = 0;
        this.duration = 0;
        this.fps = CONFIG.animation.defaultFPS;
    }
    
    setupAnimations(animationClips, model) {
        this.cleanup();
        
        if (!animationClips || animationClips.length === 0) {
            console.log('[AnimationController] 애니메이션이 없습니다.');
            return;
        }
        
        this.mixer = new THREE.AnimationMixer(model);
        
        animationClips.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            this.animations[clip.name] = action;
            this.activeActions.push(action);
            this.duration = Math.max(this.duration, clip.duration);
        });
        
        console.log(`[AnimationController] ${animationClips.length}개 애니메이션 로드, 총 시간: ${this.duration}초`);
        
        // DOM 직접 조작 제거 - UIController에서 처리하도록 함
        // document.getElementById('frameSlider').max = Math.floor(this.duration * this.fps);
    }

    play() {
        if (!this.mixer || this.activeActions.length === 0) return;
        this.isPlaying = true;
        this.activeActions.forEach(action => { 
            action.paused = false; 
            action.play(); 
        });
    }
    
    pause() {
        if (!this.mixer) return;
        this.isPlaying = false;
        this.activeActions.forEach(action => { 
            action.paused = true; 
        });
    }
    
    reset() {
        if (!this.mixer) return;
        this.isPlaying = false;
        this.mixer.setTime(0);
        this.currentTime = 0;
        this.pause(); // 리셋 후 일시정지
    }

    setFrame(frame) {
        if (!this.mixer) return;
        const time = frame / this.fps;
        this.mixer.setTime(time);
        this.currentTime = time;
        if (!this.isPlaying) {
            this.update(); // 일시정지 상태에서도 즉시 업데이트
        }
    }
    
    setTimeScale(scale) {
        if (!this.mixer) return;
        this.mixer.timeScale = scale;
    }
    
    update() {
        if (!this.mixer) return;
        
        const delta = this.isPlaying ? this.clock.getDelta() : 0;
        this.mixer.update(delta);
        this.currentTime = this.mixer.time;
        
        // 루프 처리
        if (this.isPlaying && this.currentTime >= this.duration) {
            this.currentTime = 0;
            this.mixer.setTime(0);
        }
    }

    cleanup() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.mixer.getRoot());
            this.mixer = null;
        }
        this.animations = {};
        this.activeActions = [];
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
    }

    hasAnimations() { 
        return this.activeActions.length > 0; 
    }
    
    getCurrentFrame() { 
        return Math.floor(this.currentTime * this.fps); 
    }
    
    getMaxFrames() {
        return Math.floor(this.duration * this.fps);
    }
    
    getDuration() {
        return this.duration;
    }
    
    getCurrentTime() {
        return this.currentTime;
    }
    
    getAnimationNames() {
        return Object.keys(this.animations);
    }
}