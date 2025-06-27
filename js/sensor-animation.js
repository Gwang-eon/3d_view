// js/sensor-animation.js - 센서 체크 기반 애니메이션 컨트롤러 (수정 버전)

import { AnimationController } from './animation.js';

export class SensorAnimationController extends AnimationController {
    constructor(viewer) {
        super(viewer);
        
        // 센서 표시 상태
        this.sensorsEnabled = true;
        
        // 재생 모드
        this.PLAY_MODES = {
            CRACK_DETECTION: 'crack_detection',  // 균열 감지까지
            FULL_COLLAPSE: 'full_collapse'       // 붕괴까지
        };
        
        // 기본 FPS 설정
        this.fps = 30;  // 모든 모델 30fps 기준
        
        // 모델별 프레임 설정 (완전한 설정)
        this.modelFrameSettings = {
            'Block_Retaining_Wall': {
                startFrame: 1,      // 시작 프레임
                crackFrame: 30,     // 균열 감지 프레임
                endFrame: null,     // 마지막 프레임 (자동 감지)
                fps: 30
            },
            'Cantilever_Retaining_Wall': {
                startFrame: 10,     // 특수: 10프레임부터 시작!
                crackFrame: 30,     // 균열 감지 프레임
                endFrame: 320,      // 마지막 프레임
                fps: 30
            },
            'mse_Retaining_Wall': {
                startFrame: 1,      // 시작 프레임
                crackFrame: 20,     // 균열 감지 프레임
                endFrame: null,     // 마지막 프레임 (자동 감지)
                fps: 30
            }
        };
        
        // 현재 모델명
        this.currentModelName = null;
        
        // UI 생성 여부
        this.sensorUICreated = false;
        
        // 재생 종료 시점
        this.playEndTime = null;
        this.playEndFrame = null;
        
        // 시작 시점
        this.playStartTime = 0;
        this.playStartFrame = 1;
        
        // 사용자 정의 균열 감지 프레임
        this.customCrackFrame = null;
    }
    
    /**
     * 애니메이션 설정 (오버라이드)
     */
    setAnimations(animations, model) {
        super.setAnimations(animations, model);
        
        // 애니메이션이 있을 때만 센서 UI 표시
        if (animations && animations.length > 0) {
            this.createSensorUI();
            this.updateModelSettings();
            this.updatePlayMode();
            this.setInitialFrame();  // 초기 프레임 설정 추가
        }
    }
    
    /**
     * 초기 프레임으로 이동
     */
    setInitialFrame() {
        if (!this.mixer || !this.currentModelName) return;
        
        const settings = this.getCurrentSettings();
        const startTime = this.frameToTime(settings.startFrame);
        
        // 시작 프레임으로 이동
        this.currentTime = startTime;
        this.mixer.setTime(startTime);
        
        // 모든 액션을 시작 시간으로 설정
        this.actions.forEach(action => {
            action.reset();
            action.enabled = true;
            action.play();
            action.time = startTime;
            action.paused = true;
        });
        
        // 믹서 강제 업데이트
        this.mixer.update(0);
        
        // 타임라인 업데이트
        this.updateTimeline();
        
        console.log(`🎬 초기 프레임 설정: ${settings.startFrame}프레임 (${startTime.toFixed(2)}초)`);
        
        // 특히 캔틸레버 옹벽의 경우 로그
        if (this.currentModelName === 'Cantilever_Retaining_Wall') {
            console.log('📍 캔틸레버 옹벽: 10프레임에서 시작');
        }
    }
    
    /**
     * 모델명 설정
     */
    setModelName(modelName) {
        this.currentModelName = modelName;
        this.customCrackFrame = null;  // 모델 변경 시 사용자 설정 초기화
        this.updateModelSettings();
        this.updateFrameInput();
    }
    
    /**
     * 모델 설정 업데이트
     */
    updateModelSettings() {
        if (!this.currentModelName) return;
        
        const settings = this.modelFrameSettings[this.currentModelName];
        if (settings) {
            // 시작 프레임과 시간 설정
            this.playStartFrame = settings.startFrame;
            this.playStartTime = (settings.startFrame - 1) / settings.fps;
            
            // FPS 설정
            this.fps = settings.fps;
            
            // 마지막 프레임이 없으면 duration에서 계산
            if (!settings.endFrame && this.duration) {
                settings.endFrame = Math.round(this.duration * settings.fps);
            }
            
            console.log(`📋 모델 설정: ${this.currentModelName}`);
            console.log(`  - 시작: ${settings.startFrame}프레임 (${this.playStartTime.toFixed(2)}초)`);
            console.log(`  - 균열: ${settings.crackFrame}프레임`);
            console.log(`  - 종료: ${settings.endFrame || '자동'}프레임`);
        }
    }
    
    /**
     * 현재 모델의 설정 가져오기
     */
    getCurrentSettings() {
        return this.modelFrameSettings[this.currentModelName] || {
            startFrame: 1,
            crackFrame: 30,
            endFrame: null,
            fps: 30
        };
    }
    
    /**
     * 균열 감지 시점 가져오기 (초 단위)
     */
    getCrackEndTime() {
        const settings = this.getCurrentSettings();
        
        // 사용자 정의 프레임이 있는 경우
        if (this.customCrackFrame) {
            return (this.customCrackFrame - 1) / settings.fps;
        }
        
        // 기본 설정 사용
        return (settings.crackFrame - 1) / settings.fps;
    }
    
    /**
     * 현재 균열 감지 프레임 가져오기
     */
    getCurrentCrackFrame() {
        if (this.customCrackFrame) {
            return this.customCrackFrame;
        }
        
        const settings = this.getCurrentSettings();
        return settings.crackFrame;
    }
    
    /**
     * 센서 활성화/비활성화
     */
    setSensorsEnabled(enabled) {
        this.sensorsEnabled = enabled;
        this.showSensors(enabled);
        this.updatePlayMode();
        
        console.log(`📍 센서 ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 재생 모드 업데이트
     */
    updatePlayMode() {
        const settings = this.getCurrentSettings();
        
        if (this.sensorsEnabled) {
            // 센서 활성화: 균열 감지까지만 재생
            this.playEndTime = this.getCrackEndTime();
            this.playEndFrame = this.getCurrentCrackFrame();
            console.log(`🎯 재생 모드: 균열 감지까지 (${this.playStartFrame} → ${this.playEndFrame}프레임)`);
        } else {
            // 센서 비활성화: 끝까지 재생
            this.playEndTime = null;
            this.playEndFrame = settings.endFrame;
            console.log(`🎯 재생 모드: 전체 붕괴 (${this.playStartFrame} → ${this.playEndFrame || '끝'}프레임)`);
        }
    }
    
    /**
     * 프레임을 시간으로 변환
     */
    frameToTime(frame) {
        const settings = this.getCurrentSettings();
        return (frame - 1) / settings.fps;
    }
    
    /**
     * 시간을 프레임으로 변환
     */
    timeToFrame(time) {
        const settings = this.getCurrentSettings();
        return Math.round(time * settings.fps) + 1;
    }
    
    /**
     * 재생 (오버라이드)
     */
    play() {
        if (!this.mixer || this.actions.size === 0) return;
        
        const settings = this.getCurrentSettings();
        const endTime = this.playEndTime || this.duration;
        
        // 현재 위치가 종료 지점이면 시작 프레임으로 이동
        if (this.currentTime >= endTime - 0.01) {
            this.currentTime = this.playStartTime;
            this.mixer.setTime(this.playStartTime);
            
            console.log(`🔄 시작 프레임으로 이동: ${settings.startFrame}프레임`);
            
            // 모든 액션 리셋
            this.actions.forEach(action => {
                action.reset();
                action.enabled = true;
                action.setEffectiveTimeScale(1);
                action.setEffectiveWeight(1);
                action.play();
                action.time = this.playStartTime;
            });
            
            // 타임라인 업데이트
            this.updateTimeline();
            
            // 다음 프레임에서 실제 재생 시작
            setTimeout(() => {
                this.playFromStart();
            }, 50);
            
            return;
        }
        
        // 일반 재생
        this.playFromStart();
    }
    
    /**
     * 실제 재생 시작
     */
    playFromStart() {
        // 기본 재생 로직
        super.play();
        
        // 재생 정보 로그
        const currentFrame = this.timeToFrame(this.currentTime);
        const endFrame = this.playEndFrame || this.timeToFrame(this.duration);
        
        if (this.sensorsEnabled) {
            console.log(`▶️ 재생: ${currentFrame} → ${endFrame}프레임 (균열 감지 모드)`);
        } else {
            console.log(`▶️ 재생: ${currentFrame} → ${endFrame}프레임 (전체 붕괴 모드)`);
        }
    }
    
    /**
     * 업데이트 루프 수정 (오버라이드)
     */
    startUpdateLoop() {
        if (this.animationLoopId) {
            cancelAnimationFrame(this.animationLoopId);
        }
        
        const animate = () => {
            this.animationLoopId = requestAnimationFrame(animate);
            
            if (this.mixer && !this.isSeeking) {
                const delta = this.clock.getDelta();
                
                if (this.isPlaying && delta > 0) {
                    this.mixer.update(delta);
                    this.currentTime = Math.min(this.currentTime + delta, this.duration);
                    
                    // 타임라인 업데이트
                    this.updateTimeline();
                    
                    // 재생 종료 체크
                    let shouldStop = false;
                    const currentFrame = this.timeToFrame(this.currentTime);
                    
                    if (this.sensorsEnabled && this.playEndTime && this.currentTime >= this.playEndTime) {
                        // 균열 감지 시점에서 정지
                        shouldStop = true;
                        console.log(`⏸️ 균열 감지 프레임 도달: ${currentFrame}프레임`);
                        this.showCrackDetectionAlert();
                    } else if (!this.sensorsEnabled && this.currentTime >= this.duration - 0.01) {
                        // 전체 재생 완료
                        shouldStop = true;
                        console.log(`🏁 붕괴 애니메이션 완료: ${currentFrame}프레임`);
                    }
                    
                    if (shouldStop) {
                        this.pause();
                        this.onAnimationComplete();
                    }
                }
            }
        };
        
        this.clock.start();
        animate();
        
        console.log('✅ 센서 기반 애니메이션 루프 시작');
    }
    
    /**
     * 특정 시간으로 이동 (오버라이드)
     */
    seek(time) {
        const settings = this.getCurrentSettings();
        
        // 시작 시간보다 이전으로는 이동 불가
        const clampedTime = Math.max(this.playStartTime, Math.min(time, this.duration));
        
        // 부모 클래스의 seek 호출
        super.seek(clampedTime);
        
        // 프레임 정보 로그
        const frame = this.timeToFrame(clampedTime);
        console.log(`🎯 이동: ${frame}프레임 (${clampedTime.toFixed(2)}초)`);
    }
    
    /**
     * 정지 (오버라이드)
     */
    stop() {
        if (!this.mixer) return;
        
        // 시작 프레임으로 이동
        const settings = this.getCurrentSettings();
        this.currentTime = this.playStartTime;
        
        // 부모 클래스의 stop 호출
        super.stop();
        
        // 시작 프레임으로 정확히 설정
        this.mixer.setTime(this.playStartTime);
        
        console.log(`⏹️ 정지: ${settings.startFrame}프레임으로 이동`);
    }
    
    /**
     * 센서(핫스팟 + 3D 모델) 표시/숨김 - 개별 센서 제어
     */
    showSensors(show) {
        // 1. 핫스팟 표시/숨김
        if (this.viewer.app && this.viewer.app.hotspotManager) {
            const hotspots = this.viewer.app.hotspotManager.sprites;
            hotspots.forEach(sprite => {
                sprite.visible = show;
            });
        }
        
        // 2. 3D 센서 모델 표시/숨김 - 개별 센서 오브젝트 제어
        if (this.viewer.currentModel) {
            const sensorNames = [];
            let sensorCount = 0;
            
            // 모델 순회하며 센서 관련 오브젝트 찾기
            this.viewer.currentModel.traverse((child) => {
                if (child.name) {
                    const name = child.name.toLowerCase();
                    
                    // 센서 관련 이름 패턴 매칭
                    // crack_sensor.001, crack_sensor.002, tilt_sensor.001, tilt_sensor.002
                    // base, base.001, sensor.001, sensor.002 등
                    const isSensor = (
                        // crack_sensor로 시작하는 경우
                        name.startsWith('crack_sensor') ||
                        // tilt_sensor로 시작하는 경우
                        name.startsWith('tilt_sensor') ||
                        // sensor로 시작하고 번호가 붙은 경우 (sensor.001 등)
                        /^sensor\.\d+$/.test(name) ||
                        // 정확히 sensor인 경우
                        name === 'sensor' ||
                        // base로 시작하는 경우 (base, base.001 등)
                        /^base(\.\d+)?$/.test(name) ||
                        // _sensor로 끝나는 경우
                        name.endsWith('_sensor')
                    );
                    
                    if (isSensor) {
                        child.visible = show;
                        sensorCount++;
                        sensorNames.push(child.name);
                        
                        // 하위 오브젝트도 모두 표시/숨김
                        child.traverse((subChild) => {
                            subChild.visible = show;
                        });
                    }
                }
            });
            
            if (sensorCount > 0) {
                console.log(`${show ? '👁️' : '🙈'} ${sensorCount}개 센서 ${show ? '표시' : '숨김'}`);
                if (show && sensorNames.length <= 10) {
                    console.log('센서 목록:', sensorNames.join(', '));
                }
            } else {
                console.warn('⚠️ 센서 오브젝트를 찾을 수 없습니다.');
                // 디버깅을 위해 모든 오브젝트 이름 출력
                console.log('=== 모델 내 오브젝트 목록 ===');
                const allObjects = [];
                this.viewer.currentModel.traverse((child) => {
                    if (child.name) {
                        allObjects.push({
                            name: child.name,
                            type: child.type,
                            visible: child.visible
                        });
                    }
                });
                console.table(allObjects);
            }
        }
        
        console.log(show ? '👁️ 센서 표시 완료' : '🙈 센서 숨김 완료');
    }
    
    /**
     * 균열 감지 알림
     */
    showCrackDetectionAlert() {
        // 알림 UI 생성
        const alert = document.createElement('div');
        alert.className = 'crack-detection-alert';
        const frame = this.getCurrentCrackFrame();
        
        alert.innerHTML = `
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
                <h4>균열 감지!</h4>
                <p>센서가 위험 수준의 균열을 감지했습니다.</p>
                <p style="font-size: 12px; opacity: 0.8;">
                    ${frame}프레임 / ${this.playEndTime?.toFixed(2)}초
                </p>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            alert.classList.add('fade-out');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }
    
    /**
     * 센서 UI 생성
     */
    createSensorUI() {
        if (this.sensorUICreated) return;
        
        // 기존 UI가 있으면 제거
        const existingUI = document.querySelector('.sensor-control');
        if (existingUI) {
            existingUI.remove();
        }
        
        // 타임라인 컨테이너 찾기
        const timelineContainer = document.getElementById('animation-timeline');
        if (!timelineContainer) return;
        
        // 센서 컨트롤 UI HTML
        const sensorHTML = `
            <div class="sensor-control">
                <label class="sensor-checkbox">
                    <input type="checkbox" id="sensor-toggle" checked>
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">
                        <span class="sensor-icon">📡</span>
                        센서 표시
                    </span>
                </label>
                <div class="sensor-info">
                    <span class="info-text" id="sensor-info-text">균열 감지 모드</span>
                    <div class="frame-control" style="display: inline-block; margin-left: 10px;">
                        <input type="number" id="crack-frame" min="1" max="999" 
                               placeholder="프레임" 
                               title="균열 감지 프레임 설정"
                               style="width: 70px; padding: 2px 6px; background: rgba(255, 255, 255, 0.1); 
                                      border: 1px solid rgba(255, 255, 255, 0.2); color: white; 
                                      border-radius: 4px; text-align: center;">
                    </div>
                </div>
            </div>
        `;
        
        // 타임라인 앞에 추가
        timelineContainer.insertAdjacentHTML('afterbegin', sensorHTML);
        
        // 이벤트 리스너 추가
        const sensorToggle = document.getElementById('sensor-toggle');
        sensorToggle.addEventListener('change', (e) => {
            this.setSensorsEnabled(e.target.checked);
            this.updateSensorInfo(e.target.checked);
        });
        
        // 프레임 입력 이벤트
        const frameInput = document.getElementById('crack-frame');
        
        // 프레임 입력
        frameInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const settings = this.getCurrentSettings();
            
            if (!isNaN(value) && value >= settings.startFrame) {
                this.customCrackFrame = value;
                this.updatePlayMode();
                this.updateSensorInfo(this.sensorsEnabled);
            }
        });
        
        // Enter 키로 확정
        frameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
        
        // 포커스 아웃 시 유효성 검사
        frameInput.addEventListener('blur', (e) => {
            const value = parseInt(e.target.value);
            const settings = this.getCurrentSettings();
            
            if (isNaN(value) || value < settings.startFrame) {
                e.target.value = '';
                this.customCrackFrame = null;
                this.updatePlayMode();
                this.updateSensorInfo(this.sensorsEnabled);
            }
        });
        
        // 초기 설정
        this.updateFrameInput();
        this.updateSensorInfo(true);
        
        this.sensorUICreated = true;
        
        // CSS 추가
        this.addSensorStyles();
    }
    
    /**
     * 프레임 입력 업데이트
     */
    updateFrameInput() {
        const frameInput = document.getElementById('crack-frame');
        if (frameInput) {
            const currentFrame = this.getCurrentCrackFrame();
            const settings = this.getCurrentSettings();
            
            frameInput.placeholder = `${currentFrame}`;
            frameInput.min = settings.startFrame;
            
            if (!this.customCrackFrame) {
                frameInput.value = '';
            } else {
                frameInput.value = this.customCrackFrame;
            }
        }
    }
    
    /**
     * 센서 정보 업데이트
     */
    updateSensorInfo(enabled) {
        const infoText = document.getElementById('sensor-info-text');
        if (infoText) {
            const settings = this.getCurrentSettings();
            
            if (enabled) {
                const frame = this.getCurrentCrackFrame();
                const time = this.getCrackEndTime();
                
                infoText.innerHTML = `균열 감지: <strong>${frame}프레임</strong> (${time.toFixed(2)}초)`;
                infoText.style.color = '#00ff88';
            } else {
                const endFrame = settings.endFrame || this.timeToFrame(this.duration);
                infoText.innerHTML = `전체 붕괴: <strong>${endFrame}프레임</strong>`;
                infoText.style.color = '#ff6b35';
            }
        }
    }
    
    /**
     * 타임라인 업데이트 (오버라이드)
     */
    updateTimeline() {
        super.updateTimeline();
        
        // 프레임 정보 추가 표시 (옵션)
        if (this.viewer.app && this.viewer.app.ui) {
            const currentFrame = this.timeToFrame(this.currentTime);
            const settings = this.getCurrentSettings();
            
            // 현재 프레임이 시작 프레임 이전이면 시작 프레임으로 표시
            const displayFrame = Math.max(currentFrame, settings.startFrame);
            
            // 타임라인에 프레임 정보 표시 (커스텀 속성으로)
            const timeline = document.getElementById('animation-timeline');
            if (timeline) {
                timeline.setAttribute('data-current-frame', displayFrame);
            }
        }
    }
    
    /**
     * 센서 스타일 추가
     */
    addSensorStyles() {
        if (document.getElementById('sensor-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sensor-styles';
        style.textContent = `
            .sensor-control {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                margin-right: 16px;
            }
            
            .sensor-checkbox {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }
            
            .sensor-checkbox input {
                display: none;
            }
            
            .checkbox-custom {
                width: 44px;
                height: 24px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                position: relative;
                transition: background 0.3s ease;
                margin-right: 12px;
            }
            
            .checkbox-custom::after {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                top: 2px;
                left: 2px;
                transition: transform 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .sensor-checkbox input:checked + .checkbox-custom {
                background: #00ff88;
            }
            
            .sensor-checkbox input:checked + .checkbox-custom::after {
                transform: translateX(20px);
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: white;
            }
            
            .sensor-icon {
                font-size: 18px;
            }
            
            .sensor-info {
                display: flex;
                align-items: center;
                font-size: 13px;
                color: #999;
            }
            
            .sensor-info strong {
                color: #fff;
                font-weight: 600;
            }
            
            .frame-control {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .frame-control input[type="number"] {
                -webkit-appearance: none;
                -moz-appearance: textfield;
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
                font-size: 13px;
            }
            
            .frame-control input[type="number"]::-webkit-inner-spin-button,
            .frame-control input[type="number"]::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            
            .frame-control input[type="number"]:focus {
                outline: none;
                border-color: rgba(255, 255, 255, 0.4);
                background: rgba(255, 255, 255, 0.15);
            }
            
            /* 균열 감지 알림 스타일 */
            .crack-detection-alert {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, rgba(255, 50, 50, 0.95), rgba(255, 100, 50, 0.95));
                color: white;
                padding: 16px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .crack-detection-alert.fade-out {
                animation: fadeOut 0.3s ease-out forwards;
            }
            
            .alert-icon {
                font-size: 24px;
                animation: pulse 1s ease-in-out infinite;
            }
            
            .alert-content h4 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .alert-content p {
                margin: 0;
                font-size: 13px;
                opacity: 0.9;
                line-height: 1.4;
            }
            
            /* 타임라인 프레임 표시 (옵션) */
            #animation-timeline[data-current-frame]::after {
                content: attr(data-current-frame) "f";
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
                font-family: monospace;
                pointer-events: none;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes fadeOut {
                to {
                    opacity: 0;
                    transform: translateX(20px);
                }
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 정리
     */
    destroy() {
        // UI 제거
        const sensorControl = document.querySelector('.sensor-control');
        if (sensorControl) {
            sensorControl.remove();
        }
        
        // 스타일 제거
        const style = document.getElementById('sensor-styles');
        if (style) {
            style.remove();
        }
        
        // 상위 클래스 정리
        super.destroy();
        
        console.log('🔚 SensorAnimationController 정리 완료');
    }
    
    /**
     * 디버그: 모델 구조 확인
     */
    debugModelStructure() {
        if (!this.viewer.currentModel) {
            console.log('모델이 로드되지 않았습니다.');
            return;
        }
        
        console.log('=== 모델 구조 디버깅 ===');
        const sensorObjects = [];
        
        this.viewer.currentModel.traverse((child) => {
            if (child.name) {
                const nameLower = child.name.toLowerCase();
                if (nameLower.includes('sensor') || 
                    nameLower.includes('crack') || 
                    nameLower.includes('tilt')) {
                    sensorObjects.push({
                        name: child.name,
                        type: child.type,
                        visible: child.visible,
                        parent: child.parent ? child.parent.name : 'root'
                    });
                }
            }
        });
        
        console.table(sensorObjects);
        console.log(`총 ${sensorObjects.length}개의 센서 관련 오브젝트 발견`);
    }
}