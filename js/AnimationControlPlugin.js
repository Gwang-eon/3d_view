// AnimationControlPlugin.js
import { Plugin } from './PluginSystem.js';
import { UIComponent, SliderComponent, SelectComponent, ButtonGroupComponent } from './UIComponent.js';

export class AnimationControlPlugin extends Plugin {
    constructor() {
        super('AdvancedAnimationControl', '2.0.0');
        this.ui = {};
        this.timeline = null;
    }
    
    async init(context) {
        await super.init(context);
        
        // 기존 AnimationController를 고급 버전으로 교체
        if (context.animationController) {
            this.animController = context.animationController;
            this.setupEventListeners();
        }
    }
    
    setupEventListeners() {
        // 애니메이션 이벤트 리스닝
        this.animController.on('play', (data) => {
            console.log(`[AnimationPlugin] 재생: ${data.clip}`);
            this.updateUI();
        });
        
        this.animController.on('blend', (data) => {
            console.log(`[AnimationPlugin] 블렌딩: ${data.from} → ${data.to}`);
        });
        
        this.animController.on('keyframe', (data) => {
            console.log(`[AnimationPlugin] 키프레임 이벤트: ${data.event} at ${data.time}s`);
            this.handleKeyframeEvent(data);
        });
    }
    
    createUI(container) {
        // 메인 컨테이너
        const mainDiv = document.createElement('div');
        mainDiv.className = 'animation-advanced-controls';
        
        // 1. 애니메이션 선택 및 제어
        this.createAnimationSelector(mainDiv);
        
        // 2. 재생 제어
        this.createPlaybackControls(mainDiv);
        
        // 3. 블렌딩 제어
        this.createBlendingControls(mainDiv);
        
        // 4. 타임라인
        this.createTimeline(mainDiv);
        
        // 5. 애니메이션 레이어
        this.createLayerControls(mainDiv);
        
        // 6. 고급 옵션
        this.createAdvancedOptions(mainDiv);
        
        container.appendChild(mainDiv);
    }
    
    createAnimationSelector(container) {
        const group = document.createElement('div');
        group.className = 'control-group';
        group.innerHTML = '<label>애니메이션 클립:</label>';
        
        // 애니메이션 목록
        const select = document.createElement('select');
        select.id = 'animation-clip-select';
        select.innerHTML = '<option value="">애니메이션 선택...</option>';
        
        // 애니메이션 목록 채우기
        if (this.animController && this.animController.animations) {
            Object.keys(this.animController.animations).forEach(clipName => {
                const option = document.createElement('option');
                option.value = clipName;
                option.textContent = clipName;
                select.appendChild(option);
            });
        }
        
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                this.playAnimation(e.target.value);
            }
        });
        
        group.appendChild(select);
        container.appendChild(group);
        
        this.ui.clipSelect = select;
    }
    
    createPlaybackControls(container) {
        // 재생 컨트롤 버튼
        const controls = new ButtonGroupComponent('playback-controls', container, [
            {
                id: 'anim-play',
                text: '▶️',
                onClick: () => this.play()
            },
            {
                id: 'anim-pause',
                text: '⏸️',
                onClick: () => this.pause()
            },
            {
                id: 'anim-stop',
                text: '⏹️',
                onClick: () => this.stop()
            },
            {
                id: 'anim-reverse',
                text: '◀️',
                onClick: () => this.reverse()
            }
        ]).mount();
        
        // 재생 속도 제어
        this.ui.speedSlider = new SliderComponent('speed-control', container, {
            label: '재생 속도',
            min: 0.1,
            max: 3.0,
            step: 0.1,
            value: 1.0,
            unit: 'x',
            onChange: (value) => this.setSpeed(value)
        }).mount();
        
        // 루프 모드
        const loopGroup = document.createElement('div');
        loopGroup.className = 'control-group';
        loopGroup.innerHTML = `
            <label>루프 모드:</label>
            <select id="loop-mode">
                <option value="once">한 번</option>
                <option value="repeat" selected>반복</option>
                <option value="pingpong">왕복</option>
            </select>
        `;
        
        loopGroup.querySelector('select').addEventListener('change', (e) => {
            this.setLoopMode(e.target.value);
        });
        
        container.appendChild(loopGroup);
    }
    
    createBlendingControls(container) {
        const blendGroup = document.createElement('div');
        blendGroup.className = 'control-group blend-controls';
        blendGroup.innerHTML = '<h5>애니메이션 블렌딩</h5>';
        
        // 블렌드 시간
        this.ui.blendSlider = new SliderComponent('blend-time', blendGroup, {
            label: '전환 시간',
            min: 0,
            max: 2.0,
            step: 0.1,
            value: 0.5,
            unit: 's',
            onChange: (value) => this.setBlendTime(value)
        }).mount();
        
        // 블렌드 모드
        const blendMode = document.createElement('div');
        blendMode.innerHTML = `
            <label>전환 모드:</label>
            <select id="blend-mode">
                <option value="fade">페이드</option>
                <option value="cross">크로스페이드</option>
                <option value="additive">가산</option>
            </select>
        `;
        blendGroup.appendChild(blendMode);
        
        container.appendChild(blendGroup);
    }
    
    createTimeline(container) {
        const timelineGroup = document.createElement('div');
        timelineGroup.className = 'timeline-container';
        timelineGroup.innerHTML = '<h5>타임라인</h5>';
        
        // 타임라인 캔버스
        const canvas = document.createElement('canvas');
        canvas.id = 'animation-timeline';
        canvas.width = 300;
        canvas.height = 60;
        canvas.style.width = '100%';
        canvas.style.height = '60px';
        canvas.style.background = 'rgba(0,0,0,0.3)';
        canvas.style.borderRadius = '4px';
        canvas.style.cursor = 'pointer';
        
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const progress = x / rect.width;
            this.seek(progress);
        });
        
        timelineGroup.appendChild(canvas);
        container.appendChild(timelineGroup);
        
        this.timeline = {
            canvas: canvas,
            ctx: canvas.getContext('2d')
        };
        
        // 타임라인 업데이트 시작
        this.startTimelineUpdate();
    }
    
    createLayerControls(container) {
        const layerGroup = document.createElement('div');
        layerGroup.className = 'control-group layer-controls';
        layerGroup.innerHTML = '<h5>애니메이션 레이어</h5>';
        
        // 레이어 추가 버튼
        const addLayerBtn = document.createElement('button');
        addLayerBtn.textContent = '+ 레이어 추가';
        addLayerBtn.onclick = () => this.addAnimationLayer();
        layerGroup.appendChild(addLayerBtn);
        
        // 레이어 목록
        const layerList = document.createElement('div');
        layerList.id = 'layer-list';
        layerList.className = 'layer-list';
        layerGroup.appendChild(layerList);
        
        container.appendChild(layerGroup);
        this.ui.layerList = layerList;
    }
    
    createAdvancedOptions(container) {
        const advancedGroup = document.createElement('div');
        advancedGroup.className = 'control-group advanced-options';
        advancedGroup.innerHTML = '<h5>고급 옵션</h5>';
        
        // 애니메이션 큐
        const queueBtn = document.createElement('button');
        queueBtn.textContent = '📋 큐 관리';
        queueBtn.onclick = () => this.openQueueManager();
        advancedGroup.appendChild(queueBtn);
        
        // 본 컨트롤
        const boneBtn = document.createElement('button');
        boneBtn.textContent = '🦴 본 제어';
        boneBtn.onclick = () => this.openBoneController();
        advancedGroup.appendChild(boneBtn);
        
        // 녹화
        const recordBtn = document.createElement('button');
        recordBtn.textContent = '🔴 녹화';
        recordBtn.onclick = () => this.toggleRecording();
        advancedGroup.appendChild(recordBtn);
        
        container.appendChild(advancedGroup);
    }
    
    // 애니메이션 제어 메서드들
    playAnimation(clipName) {
        if (!this.animController) return;
        
        const options = {
            fadeIn: parseFloat(this.ui.blendSlider?.getValue() || 0.5),
            loop: this.getLoopMode(),
            timeScale: parseFloat(this.ui.speedSlider?.getValue() || 1.0)
        };
        
        this.animController.play(clipName, options);
    }
    
    play() {
        const currentClip = this.ui.clipSelect.value;
        if (currentClip) {
            this.playAnimation(currentClip);
        }
    }
    
    pause() {
        if (this.animController) {
            this.animController.pause();
        }
    }
    
    stop() {
        if (this.animController) {
            this.animController.reset();
        }
    }
    
    reverse() {
        const currentSpeed = this.ui.speedSlider?.getValue() || 1.0;
        this.setSpeed(-currentSpeed);
    }
    
    setSpeed(speed) {
        if (this.animController) {
            this.animController.setTimeScale(speed);
        }
    }
    
    setBlendTime(time) {
        if (this.animController) {
            this.animController.blendTime = time;
        }
    }
    
    seek(progress) {
        if (this.animController) {
            this.animController.seekNormalized(progress);
        }
    }
    
    setLoopMode(mode) {
        let loopType = THREE.LoopRepeat;
        
        switch(mode) {
            case 'once':
                loopType = THREE.LoopOnce;
                break;
            case 'pingpong':
                loopType = THREE.LoopPingPong;
                break;
        }
        
        if (this.animController) {
            this.animController.loopMode = loopType;
        }
    }
    
    getLoopMode() {
        const mode = document.getElementById('loop-mode')?.value || 'repeat';
        return mode === 'once' ? THREE.LoopOnce : 
               mode === 'pingpong' ? THREE.LoopPingPong : 
               THREE.LoopRepeat;
    }
    
    // 타임라인 업데이트
    startTimelineUpdate() {
        const updateTimeline = () => {
            if (this.timeline && this.animController) {
                this.drawTimeline();
            }
            requestAnimationFrame(updateTimeline);
        };
        updateTimeline();
    }
    
    drawTimeline() {
        const { canvas, ctx } = this.timeline;
        const width = canvas.width;
        const height = canvas.height;
        
        // 클리어
        ctx.clearRect(0, 0, width, height);
        
        // 배경
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);
        
        // 진행 바
        const progress = this.animController.state?.progress || 0;
        ctx.fillStyle = '#007bff';
        ctx.fillRect(0, 0, width * progress, height);
        
        // 키프레임 마커 (예시)
        ctx.fillStyle = '#ffc107';
        const keyframes = [0.25, 0.5, 0.75]; // 예시 키프레임
        keyframes.forEach(kf => {
            ctx.fillRect(width * kf - 1, 0, 2, height);
        });
        
        // 현재 위치 인디케이터
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(width * progress - 1, 0, 2, height);
    }
    
    // 레이어 관리
    addAnimationLayer() {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'animation-layer';
        layerDiv.innerHTML = `
            <select class="layer-clip">
                <option value="">클립 선택...</option>
                ${Object.keys(this.animController.animations || {})
                    .map(name => `<option value="${name}">${name}</option>`)
                    .join('')}
            </select>
            <input type="range" class="layer-weight" min="0" max="1" step="0.1" value="1">
            <button class="remove-layer">❌</button>
        `;
        
        layerDiv.querySelector('.remove-layer').onclick = () => {
            layerDiv.remove();
        };
        
        this.ui.layerList.appendChild(layerDiv);
    }
    
    // 큐 매니저
    openQueueManager() {
        // 큐 관리 UI 표시 (모달 등)
        console.log('큐 매니저 열기');
    }
    
    // 본 컨트롤러
    openBoneController() {
        // 본 제어 UI 표시
        console.log('본 컨트롤러 열기');
    }
    
    // 녹화 토글
    toggleRecording() {
        if (this.animController.recording?.isRecording) {
            const data = this.animController.stopRecording();
            console.log('녹화 완료:', data);
            // 녹화 데이터 저장 또는 내보내기
        } else {
            this.animController.startRecording();
            console.log('녹화 시작');
        }
    }
    
    // 키프레임 이벤트 처리
    handleKeyframeEvent(data) {
        // 예: 특정 이벤트에 따른 동작
        switch(data.event) {
            case 'footstep':
                // 발걸음 소리 재생
                break;
            case 'impact':
                // 충격 효과
                break;
        }
    }
    
    updateUI() {
        // UI 상태 업데이트
        const debugInfo = this.animController.getDebugInfo();
        console.log('애니메이션 상태:', debugInfo);
    }
}

// CSS 스타일 추가 제안
const animationControlStyles = `
<style>
.animation-advanced-controls {
    padding: 10px 0;
}

.timeline-container {
    margin: 15px 0;
}

.timeline-container canvas {
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-top: 10px;
}

.layer-controls, .blend-controls {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.layer-list {
    margin-top: 10px;
}

.animation-layer {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    align-items: center;
}

.animation-layer select {
    flex: 1;
}

.animation-layer input[type="range"] {
    width: 80px;
}

.animation-layer button {
    padding: 5px 10px;
    background: rgba(220, 53, 69, 0.8);
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.advanced-options {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.advanced-options button {
    margin-right: 10px;
    margin-bottom: 10px;
}
</style>
`;