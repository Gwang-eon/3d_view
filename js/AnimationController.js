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
        
        if (!animationClips || animationClips.length === 0) return;
        
        this.mixer = new THREE.AnimationMixer(model);
        
        animationClips.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            this.animations[clip.name] = action;
            this.activeActions.push(action);
            this.duration = Math.max(this.duration, clip.duration);
        });
        
        document.getElementById('frameSlider').max = Math.floor(this.duration * this.fps);
    }

    play() {
        if (!this.mixer || this.activeActions.length === 0) return;
        this.isPlaying = true;
        this.activeActions.forEach(action => { action.paused = false; action.play(); });
    }
    
    pause() {
        if (!this.mixer) return;
        this.isPlaying = false;
        this.activeActions.forEach(action => { action.paused = true; });
    }
    
    reset() {
        if (!this.mixer) return;
        this.isPlaying = false;
        this.mixer.setTime(0);
        this.update(); // Reset immediately
    }

    setFrame(frame) {
        if (!this.mixer) return;
        this.mixer.setTime(frame / this.fps);
        if (!this.isPlaying) this.update();
    }
    
    update() {
        if (!this.mixer) return;
        const delta = this.isPlaying ? this.clock.getDelta() : 0;
        this.mixer.update(delta);
        this.currentTime = this.mixer.time;
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

    hasAnimations() { return this.activeActions.length > 0; }
    getCurrentFrame() { return Math.floor(this.currentTime * this.fps); }
}