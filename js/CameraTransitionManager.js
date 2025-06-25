// CameraTransitionManager.js - 개선된 버전
export class CameraTransitionManager {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.isTransitioning = false;
        this.transitionDuration = 1.5;
        this.easeType = 'easeInOutCubic';
        
        // 전환 큐 추가
        this.transitionQueue = [];
        this.currentTransition = null;
        
        // 원래 controls 설정 저장
        this.originalControlsSettings = {
            enabled: true,
            enableDamping: controls.enableDamping
        };
    }
    
    // 이징 함수들
    easingFunctions = {
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
    
    // 카메라 전환 - 개선된 버전
    transitionTo(targetPosition, targetRotation, targetFov, options = {}) {
        const transition = {
            targetPosition,
            targetRotation,
            targetFov,
            options,
            promise: null
        };
        
        // Promise 생성
        transition.promise = new Promise((resolve, reject) => {
            transition.resolve = resolve;
            transition.reject = reject;
        });
        
        // 현재 전환 중이면 큐에 추가
        if (this.isTransitioning) {
            // 급한 전환인 경우 현재 전환 취소
            if (options.priority === 'high') {
                this.cancelCurrentTransition();
                this.executeTransition(transition);
            } else {
                this.transitionQueue.push(transition);
            }
        } else {
            this.executeTransition(transition);
        }
        
        return transition.promise;
    }
    
    // 전환 실행
    executeTransition(transition) {
        const {
            targetPosition,
            targetRotation,
            targetFov,
            options,
            resolve,
            reject
        } = transition;
        
        const {
            duration = this.transitionDuration,
            easeType = this.easeType,
            lookAt = null,
            onUpdate = null,
            onComplete = null,
            disableControls = true,
            maintainUp = true
        } = options;
        
        this.isTransitioning = true;
        this.currentTransition = transition;
        
        // 전환 중 컨트롤 비활성화 옵션
        if (disableControls && this.controls) {
            this.controls.enabled = false;
        }
        
        // 시작 상태 저장
        const startState = {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
            fov: this.camera.fov,
            up: this.camera.up.clone(),
            controlsTarget: this.controls ? this.controls.target.clone() : new THREE.Vector3()
        };
        
        // 타겟 설정
        const endPosition = targetPosition.clone();
        let endQuaternion;
        let endControlsTarget = startState.controlsTarget.clone();
        
        if (lookAt) {
            // lookAt 포인트가 주어진 경우
            endControlsTarget = lookAt.clone();
            
            // 임시 카메라로 목표 회전 계산
            const tempCamera = this.camera.clone();
            tempCamera.position.copy(endPosition);
            
            // up 벡터 유지 옵션
            if (maintainUp) {
                tempCamera.up.copy(this.camera.up);
            }
            
            tempCamera.lookAt(lookAt);
            endQuaternion = tempCamera.quaternion.clone();
        } else if (targetRotation) {
            endQuaternion = targetRotation.clone();
        } else {
            endQuaternion = startState.quaternion.clone();
        }
        
        const startTime = performance.now();
        const ease = this.easingFunctions[easeType] || this.easingFunctions.easeInOutCubic;
        
        // 애니메이션 프레임 ID 저장 (취소용)
        let animationId;
        
        const animate = () => {
            const currentTime = performance.now();
            const elapsed = (currentTime - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = ease(progress);
            
            // 위치 보간
            this.camera.position.lerpVectors(startState.position, endPosition, easeProgress);
            
            // 회전 보간 (Quaternion slerp)
            this.camera.quaternion.slerpQuaternions(startState.quaternion, endQuaternion, easeProgress);
            
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
            
            // 콜백 실행
            if (onUpdate) {
                onUpdate(progress, easeProgress);
            }
            
            if (progress < 1) {
                animationId = requestAnimationFrame(animate);
            } else {
                // 전환 완료
                this.completeTransition(onComplete, resolve);
            }
        };
        
        // 애니메이션 ID 저장
        transition.animationId = animationId;
        
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
    
    // GLTF 카메라로 전환 - 개선된 버전
    transitionToGLTFCamera(gltfCamera, options = {}) {
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
        const lookAt = position.clone().add(direction.multiplyScalar(10));
        
        // FOV 처리
        let fov = this.camera.fov;
        if (gltfCamera.isPerspectiveCamera) {
            fov = gltfCamera.fov;
        }
        
        return this.transitionTo(
            position,
            quaternion,
            fov,
            {
                ...options,
                lookAt: lookAt
            }
        );
    }
    
    // 모델을 중심으로 하는 궤도 카메라 이동 - 개선된 버전
    orbitAroundModel(model, options = {}) {
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
                easeType: 'easeInOutSine'
            }
        );
    }
    
    // 특정 오브젝트에 포커스 - 개선된 버전
    focusOnObject(object, options = {}) {
        const {
            distance = 'auto',
            offset = new THREE.Vector3(0, 0, 0),
            duration = 1.5,
            padding = 1.5,
            minDistance = 5,
            maxDistance = 100
        } = options;
        
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 자동 거리 계산
        let cameraDistance = distance;
        if (distance === 'auto') {
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            cameraDistance = Math.abs(maxDim / Math.sin(fov / 2)) * padding;
            
            // 거리 제한
            cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance));
        }
        
        // 현재 카메라 방향 유지 옵션
        const currentDirection = new THREE.Vector3();
        this.camera.getWorldDirection(currentDirection);
        
        // 카메라 위치 계산
        const direction = currentDirection.normalize();
        const targetPosition = center.clone()
            .sub(direction.multiplyScalar(cameraDistance))
            .add(offset);
        
        return this.transitionTo(
            targetPosition,
            null,
            this.camera.fov,
            {
                duration,
                lookAt: center,
                easeType: 'easeOutCubic'
            }
        );
    }
    
    // 부드러운 줌 인/아웃
    smoothZoom(factor, options = {}) {
        const {
            duration = 0.5,
            maintainTarget = true
        } = options;
        
        if (!this.controls) return Promise.resolve();
        
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const newDistance = currentDistance * factor;
        
        // 현재 방향 유지하면서 거리만 조정
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target).normalize();
        
        const newPosition = this.controls.target.clone()
            .add(direction.multiplyScalar(newDistance));
        
        return this.transitionTo(
            newPosition,
            null,
            this.camera.fov,
            {
                duration,
                lookAt: maintainTarget ? this.controls.target : null,
                easeType: 'easeOutQuad'
            }
        );
    }
    
    // 현재 상태 저장
    saveState() {
        return {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
            fov: this.camera.fov,
            controlsTarget: this.controls ? this.controls.target.clone() : null
        };
    }
    
    // 저장된 상태로 복원
    restoreState(state, options = {}) {
        return this.transitionTo(
            state.position,
            state.quaternion,
            state.fov,
            {
                ...options,
                lookAt: state.controlsTarget
            }
        );
    }
    
    // 프리셋 뷰
    setPresetView(preset, model, options = {}) {
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        const presets = {
            'front': { x: 0, y: 0, z: 1 },
            'back': { x: 0, y: 0, z: -1 },
            'left': { x: -1, y: 0, z: 0 },
            'right': { x: 1, y: 0, z: 0 },
            'top': { x: 0, y: 1, z: 0 },
            'bottom': { x: 0, y: -1, z: 0 },
            'isometric': { x: 1, y: 1, z: 1 }
        };
        
        const direction = presets[preset] || presets.front;
        const distance = maxDim * 2;
        
        const position = center.clone().add(
            new THREE.Vector3(direction.x, direction.y, direction.z)
                .normalize()
                .multiplyScalar(distance)
        );
        
        return this.transitionTo(position, null, this.camera.fov, {
            ...options,
            lookAt: center,
            duration: options.duration || 1.0
        });
    }
    
    // 디버그 정보
    getDebugInfo() {
        return {
            isTransitioning: this.isTransitioning,
            queueLength: this.transitionQueue.length,
            currentEasing: this.easeType,
            duration: this.transitionDuration
        };
    }
}