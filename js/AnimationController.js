// AnimationController.js - 완전한 애니메이션 컨트롤러
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
        this.fps = CONFIG.animation?.defaultFPS || 60;
        this.timeScale = 1.0;
        this.loop = true;
        
        console.log('[AnimationController] 초기화 완료');
    }
    
    setupAnimations(animationClips, model) {
        console.log('[AnimationController] 애니메이션 설정 시작');
        
        // 기존 애니메이션 정리
        this.cleanup();
        
        if (!animationClips || animationClips.length === 0) {
            console.log('[AnimationController] 애니메이션이 없습니다.');
            return;
        }
        
        // 애니메이션 믹서 생성
        this.mixer = new THREE.AnimationMixer(model);
        
        // 애니메이션 클립 설정
        animationClips.forEach((clip, index) => {
            const action = this.mixer.clipAction(clip);
            const animationName = clip.name || `Animation_${index}`;
            
            this.animations[animationName] = action;
            this.activeActions.push(action);
            
            // 최대 지속 시간 계산
            this.duration = Math.max(this.duration, clip.duration);
            
            console.log(`[AnimationController] 애니메이션 추가: ${animationName}, 길이: ${clip.duration}초`);
        });
        
        console.log(`[AnimationController] ${animationClips.length}개 애니메이션 로드 완료, 총 시간: ${this.duration}초`);
    }
    
    play() {
        if (!this.mixer || this.activeActions.length === 0) {
            console.warn('[AnimationController] 재생할 애니메이션이 없습니다.');
            return;
        }
        
        this.isPlaying = true;
        this.clock.start();
        
        this.activeActions.forEach(action => {
            action.paused = false;
            action.play();
        });
        
        console.log('[AnimationController] 애니메이션 재생 시작');
    }
    
    pause() {
        if (!this.mixer) return;
        
        this.isPlaying = false;
        
        this.activeActions.forEach(action => {
            action.paused = true;
        });
        
        console.log('[AnimationController] 애니메이션 일시정지');
    }
    
    stop() {
        if (!this.mixer) return;
        
        this.isPlaying = false;
        
        this.activeActions.forEach(action => {
            action.stop();
        });
        
        this.currentTime = 0;
        this.mixer.setTime(0);
        
        console.log('[AnimationController] 애니메이션 정지');
    }
    
    reset() {
        if (!this.mixer) return;
        
        this.stop();
        this.currentTime = 0;
        this.mixer.setTime(0);
        
        console.log('[AnimationController] 애니메이션 리셋');
    }
    
    setProgress(progress) {
        if (!this.mixer) return;
        
        // progress는 0 ~ 1 사이의 값
        const time = progress * this.duration;
        this.setTime(time);
    }
    
    setTime(time) {
        if (!this.mixer) return;
        
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.mixer.setTime(this.currentTime);
        
        // 일시정지 상태에서도 즉시 업데이트
        if (!this.isPlaying) {
            this.mixer.update(0);
        }
    }
    
    setFrame(frame) {
        if (!this.mixer) return;
        
        const time = frame / this.fps;
        this.setTime(time);
    }
    
    setTimeScale(scale) {
        if (!this.mixer) return;
        
        this.timeScale = scale;
        this.mixer.timeScale = scale;
        
        console.log(`[AnimationController] 재생 속도 변경: ${scale}x`);
    }
    
    setLoop(loop) {
        this.loop = loop;
        
        this.activeActions.forEach(action => {
            action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
        });
    }
    
    update() {
        if (!this.mixer) return;
        
        if (this.isPlaying) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
            this.currentTime = this.mixer.time;
            
            // 루프 처리
            if (this.loop && this.currentTime >= this.duration) {
                this.currentTime = 0;
                this.mixer.setTime(0);
            } else if (!this.loop && this.currentTime >= this.duration) {
                this.pause();
            }
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
        
        console.log('[AnimationController] 애니메이션 정리 완료');
    }
    
    // 유틸리티 메서드들
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
    
    getProgress() {
        return this.duration > 0 ? this.currentTime / this.duration : 0;
    }
    
    getAnimationNames() {
        return Object.keys(this.animations);
    }
    
    playAnimation(name) {
        if (this.animations[name]) {
            // 모든 애니메이션 정지
            this.activeActions.forEach(action => action.stop());
            
            // 특정 애니메이션만 재생
            const action = this.animations[name];
            action.play();
            this.isPlaying = true;
            
            console.log(`[AnimationController] '${name}' 애니메이션 재생`);
        } else {
            console.warn(`[AnimationController] '${name}' 애니메이션을 찾을 수 없습니다.`);
        }
    }
    
    dispose() {
        this.cleanup();
        console.log('[AnimationController] 리소스 해제 완료');
    }
}