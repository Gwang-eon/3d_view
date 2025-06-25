// CameraTransitionManager.js - 완전한 카메라 전환 관리자
import { CONFIG } from './config.js';

export class CameraTransitionManager {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.isTransitioning = false;
        this.currentTransition = null;
        this.transitionQueue = [];
        
        // 원본 컨트롤 설정 저장
        this.originalControlsSettings = {
            enabled: controls.enabled,
            enableDamping: controls.enableDamping,
            dampingFactor: controls.dampingFactor,
            rotateSpeed: controls.rotateSpeed,
            zoomSpeed: controls.zoomSpeed,
            panSpeed: controls.panSpeed
        };
        
        // 현재 카메라 프로필
        this.currentProfile = 'default';
        
        // 이징 함수들
        this.easingFunctions = {
            linear: (t) => t,
            easeInQuad: (t) => t * t,
            easeOutQuad: (t) => t * (2 - t),
            easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeInCubic: (t) => t * t * t,
            easeOutCubic: (t) => (--t) * t * t + 1,
            easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
            easeOutElastic: (t) => {
                const p = 0.3;
                return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
            }
        };
    }
    
    // 카메라 프로필 적용
    applyProfile(profileName) {
        const profile = CONFIG.cameraProfiles[profileName] || CONFIG.cameraProfiles.default;
        
        Object.assign(this.controls, profile);
        this.currentProfile = profileName;
        this.controls.update();
        
        console.log(`[CameraTransition] 프로필 적용: ${profileName}`, profile);
    }
    
    // 거리 기반 적응형 속도 계산
    calculateAdaptiveSpeed() {
        if (!CONFIG.adaptiveSpeed.enabled) return 1;
        
        const distance = this.camera.position.distanceTo(this.controls.target);
        const { minDistance, maxDistance, speedMultiplier } = CONFIG.adaptiveSpeed;
        
        // 거리에 따른 속도 배수 계산
        let multiplier = 1;
        if (distance <= minDistance) {
            multiplier = speedMultiplier.min;
        } else if (distance >= maxDistance) {
            multiplier = speedMultiplier.max;
        } else {
            // 선형 보간
            const t = (distance - minDistance) / (maxDistance - minDistance);
            multiplier = speedMultiplier.min + (speedMultiplier.max - speedMultiplier.min) * t;
        }
        
        // 현재 속도에 배수 적용
        this.controls.rotateSpeed = this.originalControlsSettings.rotateSpeed * multiplier;
        this.controls.zoomSpeed = this.originalControlsSettings.zoomSpeed * multiplier;
        this.controls.panSpeed = this.originalControlsSettings.panSpeed * multiplier;
        
        return multiplier;
    }
    
    // GLTF 카메라로 전환 - 개선된 버전
    async transitionToGLTFCamera(gltfCamera, options = {}) {
        // GLTF 카메라 프로필 적용
        this.applyProfile('gltf');
        
        // GLTF 카메라의 월드 매트릭스 업데이트
        gltfCamera.updateMatrixWorld(true);
        
        // 월드 위치와 회전 계산
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        
        gltfCamera.matrixWorld.decompose(position, quaternion, scale);
        
        // 카메라가 바라보는 방향 계산
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(quaternion);
        
        // 적절한 타겟 설정 (카메라 앞 일정 거리)
        const targetDistance = options.targetDistance || 10;
        const lookAt = position.clone().add(direction.multiplyScalar(targetDistance));
        
        // FOV 처리
        let fov = this.camera.fov;
        if (gltfCamera.isPerspectiveCamera) {
            fov = gltfCamera.fov;
        }
        
        // 모델 중심점 찾기 (전환 완료 후 타겟으로 사용)
        let modelCenter = new THREE.Vector3(0, 0, 0);
        if (options.model) {
            const box = new THREE.Box3().setFromObject(options.model);
            modelCenter = box.getCenter(new THREE.Vector3());
        }
        
        return this.transitionTo(
            position,
            quaternion,
            fov,
            {
                ...options,
                lookAt: lookAt,
                onComplete: () => {
                    // 전환 완료 후 컨트롤 타겟을 모델 중심으로 설정
                    this.controls.target.copy(modelCenter);
                    this.controls.update();
                    
                    // 적응형 속도 업데이트
                    this.calculateAdaptiveSpeed();
                    
                    if (options.onComplete) {
                        options.onComplete();
                    }
                }
            }
        );
    }
    
    // 프리셋 뷰 설정 - 개선된 버전
    async setPresetView(viewName, model, options = {}) {
        if (!model) {
            console.warn('[CameraTransition] 모델이 없어 프리셋 뷰를 설정할 수 없습니다.');
            return;
        }
        
        // 프리셋에 따른 프로필 선택
        const profileMap = {
            'front': 'default',
            'back': 'default',
            'left': 'default',
            'right': 'default',
            'top': 'overview',
            'bottom': 'overview',
            'isometric': 'overview'
        };
        
        this.applyProfile(profileMap[viewName] || 'default');
        
        // 모델의 바운딩 박스 계산
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        let position;
        switch (viewName) {
            case 'front':
                position = new THREE.Vector3(center.x, center.y, center.z + distance);
                break;
            case 'back':
                position = new THREE.Vector3(center.x, center.y, center.z - distance);
                break;
            case 'left':
                position = new THREE.Vector3(center.x - distance, center.y, center.z);
                break;
            case 'right':
                position = new THREE.Vector3(center.x + distance, center.y, center.z);
                break;
            case 'top':
                position = new THREE.Vector3(center.x, center.y + distance, center.z);
                break;
            case 'bottom':
                position = new THREE.Vector3(center.x, center.y - distance, center.z);
                break;
            case 'isometric':
                position = new THREE.Vector3(
                    center.x + distance * 0.7,
                    center.y + distance * 0.7,
                    center.z + distance * 0.7
                );
                break;
            default:
                position = new THREE.Vector3(center.x, center.y, center.z + distance);
        }
        
        return this.transitionTo(position, null, this.camera.fov, {
            ...options,
            lookAt: center,
            onComplete: () => {
                // 컨트롤 타겟을 모델 중심으로 설정
                this.controls.target.copy(center);
                this.controls.update();
                
                // 적응형 속도 업데이트
                this.calculateAdaptiveSpeed();
                
                if (options.onComplete) {
                    options.onComplete();
                }
            }
        });
    }
    
    // 메인 전환 함수 - 개선된 버전
    transitionTo(targetPosition, targetQuaternion, targetFov, options = {}) {
        const {
            duration = CONFIG.cameraTransition.defaultDuration,
            easeType = CONFIG.cameraTransition.defaultEaseType,
            lookAt = null,
            disableControls = CONFIG.cameraTransition.disableControlsDuringTransition,
            onStart = null,
            onUpdate = null,
            onComplete = null
        } = options;
        
        return new Promise((resolve, reject) => {
            const transition = {
                targetPosition,
                targetQuaternion,
                targetFov,
                duration,
                easeType,
                lookAt,
                disableControls,
                onStart,
                onUpdate,
                onComplete,
                resolve,
                reject
            };
            
            if (this.isTransitioning) {
                this.transitionQueue.push(transition);
                console.log('[CameraTransition] 전환 대기열에 추가됨');
                return;
            }
            
            this.executeTransition(transition);
        });
    }
    
    // 전환 실행 - 개선된 버전
    executeTransition(transition) {
        const {
            targetPosition,
            targetQuaternion,
            targetFov,
            duration,
            easeType,
            lookAt,
            disableControls,
            onStart,
            onUpdate,
            onComplete,
            resolve,
            reject
        } = transition;
        
        this.isTransitioning = true;
        this.currentTransition = transition;
        
        // 시작 상태 저장
        const startState = {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
            fov: this.camera.fov,
            controlsTarget: this.controls.target.clone()
        };
        
        // 컨트롤 비활성화
        if (disableControls && this.controls) {
            this.controls.enabled = false;
        }
        
        // 종료 상태 계산
        const endPosition = targetPosition.clone();
        let endQuaternion = targetQuaternion ? targetQuaternion.clone() : null;
        let endControlsTarget = lookAt ? lookAt.clone() : this.controls.target.clone();
        
        // lookAt이 지정된 경우 쿼터니언 계산
        if (lookAt && !targetQuaternion) {
            const tempCamera = this.camera.clone();
            tempCamera.position.copy(endPosition);
            tempCamera.lookAt(lookAt);
            endQuaternion = tempCamera.quaternion.clone();
        }
        
        // 시작 콜백
        if (onStart) onStart();
        
        const startTime = performance.now();
        const easingFunction = this.easingFunctions[easeType] || this.easingFunctions.linear;
        
        const animate = () => {
            const currentTime = performance.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            const easeProgress = easingFunction(progress);
            
            // 위치 보간
            this.camera.position.lerpVectors(startState.position, endPosition, easeProgress);
            
            // 회전 보간 (Quaternion slerp)
            if (endQuaternion) {
                this.camera.quaternion.slerpQuaternions(startState.quaternion, endQuaternion, easeProgress);
            }
            
            // FOV 보간
            if (targetFov !== undefined && targetFov !== startState.fov) {
                this.camera.fov = startState.fov + (targetFov - startState.fov) * easeProgress;
                this.camera.updateProjectionMatrix();
            }
            
            // OrbitControls target 업데이트
            if (this.controls && lookAt) {
                this.controls.target.lerpVectors(startState.controlsTarget, endControlsTarget, easeProgress);
                this.controls.update();
            }
            
            // 적응형 속도 업데이트
            this.calculateAdaptiveSpeed();
            
            // 콜백 실행
            if (onUpdate) {
                onUpdate(progress, easeProgress);
            }
            
            if (progress < 1) {
                transition.animationId = requestAnimationFrame(animate);
            } else {
                // 전환 완료
                this.completeTransition(onComplete, resolve);
            }
        };
        
        animate();
    }
    
    // 전환 완료 처리
    completeTransition(onComplete, resolve) {
        this.isTransitioning = false;
        this.currentTransition = null;
        
        // 컨트롤 재활성화
        if (this.controls) {
            this.controls.enabled = this.originalControlsSettings.enabled;
            this.controls.update();
        }
        
        if (onComplete) onComplete();
        if (resolve) resolve();
        
        // 큐에 다음 전환이 있으면 실행
        if (this.transitionQueue.length > 0) {
            const nextTransition = this.transitionQueue.shift();
            this.executeTransition(nextTransition);
        }
    }
    
    // 즉시 카메라 위치 설정 (전환 없이)
    setImmediate(position, quaternion, fov) {
        if (position) this.camera.position.copy(position);
        if (quaternion) this.camera.quaternion.copy(quaternion);
        if (fov !== undefined) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
        this.controls.update();
        this.calculateAdaptiveSpeed();
    }
    
    // 오브젝트에 포커스
    async focusOnObject(object, options = {}) {
        const {
            padding = 1.5,
            minDistance = 5,
            maxDistance = 50
        } = options;
        
        // 근접 촬영 프로필 적용
        this.applyProfile('closeup');
        
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let distance = maxDim * padding / (2 * Math.tan(fov / 2));
        
        // 거리 제한
        distance = Math.max(minDistance, Math.min(maxDistance, distance));
        
        // 현재 카메라 방향 유지하면서 거리만 조정
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target).normalize();
        
        const newPosition = center.clone().add(direction.multiplyScalar(distance));
        
        return this.transitionTo(newPosition, null, this.camera.fov, {
            ...options,
            lookAt: center
        });
    }
    
    // 부드러운 줌
    smoothZoom(factor, options = {}) {
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const newDistance = currentDistance * factor;
        
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target).normalize();
        
        const newPosition = this.controls.target.clone().add(direction.multiplyScalar(newDistance));
        
        return this.transitionTo(newPosition, null, this.camera.fov, options);
    }
    
    // 모델을 중심으로 하는 궤도 카메라 이동
    async orbitAroundModel(model, options = {}) {
        const {
            radius = 20,
            height = 10,
            angle = 0,
            duration = 2,
            lookAtCenter = true,
            adjustRadius = true
        } = options;
        
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 자동 반경 조정
        let finalRadius = radius;
        if (adjustRadius) {
            const maxDim = Math.max(size.x, size.y, size.z);
            finalRadius = maxDim * 1.5;
        }
        
        // 목표 위치 계산
        const targetPosition = new THREE.Vector3(
            center.x + finalRadius * Math.cos(angle),
            center.y + height,
            center.z + finalRadius * Math.sin(angle)
        );
        
        return this.transitionTo(
            targetPosition,
            null,
            this.camera.fov,
            {
                duration,
                lookAt: lookAtCenter ? center : null,
                ...options
            }
        );
    }
    
    // 현재 카메라 상태 저장
    saveState(name) {
        const state = {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
            fov: this.camera.fov,
            controlsTarget: this.controls.target.clone(),
            profile: this.currentProfile
        };
        
        if (!this.savedStates) this.savedStates = {};
        this.savedStates[name] = state;
        
        return state;
    }
    
    // 저장된 카메라 상태로 복원
    restoreState(name, options = {}) {
        if (!this.savedStates || !this.savedStates[name]) {
            console.warn(`[CameraTransition] 저장된 상태를 찾을 수 없습니다: ${name}`);
            return Promise.reject(new Error('State not found'));
        }
        
        const state = this.savedStates[name];
        
        // 프로필 복원
        this.applyProfile(state.profile);
        
        return this.transitionTo(state.position, state.quaternion, state.fov, {
            ...options,
            lookAt: state.controlsTarget
        });
    }
    
    // 현재 전환 취소
    cancelCurrentTransition() {
        if (this.currentTransition) {
            if (this.currentTransition.animationId) {
                cancelAnimationFrame(this.currentTransition.animationId);
            }
            
            // 컨트롤 재활성화
            if (this.controls) {
                this.controls.enabled = this.originalControlsSettings.enabled;
            }
            
            if (this.currentTransition.reject) {
                this.currentTransition.reject(new Error('Transition cancelled'));
            }
            
            this.isTransitioning = false;
            this.currentTransition = null;
        }
    }
    
    // 모든 전환 취소
    cancelAllTransitions() {
        this.cancelCurrentTransition();
        this.transitionQueue = [];
    }
    
    // 전환 속도 설정
    setTransitionDuration(duration) {
        this.transitionDuration = duration;
    }
    
    // 이징 타입 설정
    setEaseType(easeType) {
        this.easeType = easeType;
    }
}