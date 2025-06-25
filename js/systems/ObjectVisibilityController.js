// js/systems/ObjectVisibilityController.js
// 객체 표시/숨김 제어 시스템 - 완전한 가시성 관리

import { getConfig, setConfig } from '../core/ConfigManager.js';

/**
 * 객체 가시성 제어 시스템
 * - 모델 내 개별 객체 표시/숨김
 * - 그룹별 관리 시스템
 * - 레이어 기반 제어
 * - 애니메이션 효과
 * - 상태 저장/복원
 * - 필터링 시스템
 * - 하이라이트 기능
 */
export class ObjectVisibilityController {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        
        // 객체 관리
        this.objects = new Map(); // name -> object
        this.groups = new Map(); // groupName -> Set<objectName>
        this.layers = new Map(); // layerName -> Set<objectName>
        
        // 가시성 상태
        this.visibilityStates = new Map(); // objectName -> boolean
        this.groupStates = new Map(); // groupName -> boolean
        this.layerStates = new Map(); // layerName -> boolean
        
        // 애니메이션 관리
        this.animations = new Map();
        this.animationQueue = [];
        this.animationId = null;
        
        // 필터링
        this.filters = new Map();
        this.activeFilters = new Set();
        
        // 하이라이트 시스템
        this.highlightedObjects = new Set();
        this.originalMaterials = new Map();
        this.highlightMaterial = null;
        
        // 설정
        this.config = {
            enableAnimations: getConfig('objectVisibility.enableAnimations', true),
            animationDuration: getConfig('objectVisibility.animationDuration', 300),
            fadeInEasing: getConfig('objectVisibility.fadeInEasing', 'easeOut'),
            fadeOutEasing: getConfig('objectVisibility.fadeOutEasing', 'easeIn'),
            enableGrouping: getConfig('objectVisibility.enableGrouping', true),
            enableLayers: getConfig('objectVisibility.enableLayers', true),
            enableMaterialPreservation: getConfig('objectVisibility.enableMaterialPreservation', true),
            enableHighlight: getConfig('objectVisibility.enableHighlight', true),
            highlightColor: getConfig('objectVisibility.highlightColor', '#ffff00'),
            highlightEmissive: getConfig('objectVisibility.highlightEmissive', 0.3)
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 초기화
        this.init();
        
        console.log('[ObjectVisibilityController] 초기화됨');
    }
    
    /**
     * 초기화
     */
    init() {
        // 하이라이트 머티리얼 생성
        this.createHighlightMaterial();
        
        // 애니메이션 시스템 시작
        this.startAnimationSystem();
        
        // 기본 필터 등록
        this.registerDefaultFilters();
    }
    
    /**
     * 하이라이트 머티리얼 생성
     */
    createHighlightMaterial() {
        if (!this.config.enableHighlight) return;
        
        this.highlightMaterial = new THREE.MeshPhongMaterial({
            color: this.config.highlightColor,
            emissive: this.config.highlightColor,
            emissiveIntensity: this.config.highlightEmissive,
            transparent: true,
            opacity: 0.8
        });
    }
    
    /**
     * 애니메이션 시스템 시작
     */
    startAnimationSystem() {
        if (!this.config.enableAnimations) return;
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.updateAnimations();
        };
        
        animate();
    }
    
    /**
     * 기본 필터 등록
     */
    registerDefaultFilters() {
        // 재질별 필터
        this.registerFilter('material', (object) => {
            if (object.material && object.material.name) {
                return object.material.name;
            }
            return 'default';
        });
        
        // 크기별 필터
        this.registerFilter('size', (object) => {
            const bbox = new THREE.Box3().setFromObject(object);
            const size = bbox.getSize(new THREE.Vector3());
            const volume = size.x * size.y * size.z;
            
            if (volume > 100) return 'large';
            if (volume > 10) return 'medium';
            return 'small';
        });
        
        // 타입별 필터 (이름 기반)
        this.registerFilter('type', (object) => {
            const name = object.name.toLowerCase();
            if (name.includes('wall')) return 'wall';
            if (name.includes('block')) return 'block';
            if (name.includes('foundation')) return 'foundation';
            if (name.includes('reinforcement')) return 'reinforcement';
            return 'other';
        });
    }
    
    /**
     * 모델 스캔 및 객체 등록
     */
    scanModel(model) {
        if (!model) return;
        
        console.log('[ObjectVisibilityController] 모델 스캔 시작...');
        
        // 기존 데이터 정리
        this.clear();
        
        let objectCount = 0;
        
        // 모델 순회하여 객체 등록
        model.traverse((child) => {
            if (child.isMesh && child.name) {
                this.registerObject(child);
                objectCount++;
            }
        });
        
        // 자동 그룹 생성
        this.createAutoGroups();
        
        // 자동 레이어 생성
        this.createAutoLayers();
        
        // 통계 출력
        console.log(`[ObjectVisibilityController] 스캔 완료: ${objectCount}개 객체, ${this.groups.size}개 그룹, ${this.layers.size}개 레이어`);
        
        this.emit('model:scanned', {
            objectCount,
            groupCount: this.groups.size,
            layerCount: this.layers.size
        });
    }
    
    /**
     * 객체 등록
     */
    registerObject(object) {
        const name = object.name;
        
        // 중복 확인
        if (this.objects.has(name)) {
            console.warn(`[ObjectVisibilityController] 중복 객체명: ${name}`);
            return;
        }
        
        // 객체 등록
        this.objects.set(name, object);
        this.visibilityStates.set(name, object.visible);
        
        // 원본 머티리얼 저장
        if (object.material) {
            this.originalMaterials.set(name, object.material.clone());
        }
        
        console.log(`[ObjectVisibilityController] 객체 등록: ${name}`);
    }
    
    /**
     * 자동 그룹 생성
     */
    createAutoGroups() {
        if (!this.config.enableGrouping) return;
        
        const groups = new Map();
        
        // 이름 패턴 기반 그룹화
        this.objects.forEach((object, name) => {
            // 언더스코어 기준 그룹화
            const parts = name.split('_');
            if (parts.length > 1) {
                const groupName = parts[0];
                if (!groups.has(groupName)) {
                    groups.set(groupName, new Set());
                }
                groups.get(groupName).add(name);
            }
            
            // 숫자 패턴 제거하여 그룹화
            const baseName = name.replace(/\d+$/, '');
            if (baseName !== name) {
                if (!groups.has(baseName)) {
                    groups.set(baseName, new Set());
                }
                groups.get(baseName).add(name);
            }
        });
        
        // 그룹 등록 (최소 2개 객체가 있는 그룹만)
        groups.forEach((objects, groupName) => {
            if (objects.size >= 2) {
                this.groups.set(groupName, objects);
                this.groupStates.set(groupName, true);
            }
        });
        
        console.log(`[ObjectVisibilityController] ${this.groups.size}개 그룹 자동 생성됨`);
    }
    
    /**
     * 자동 레이어 생성
     */
    createAutoLayers() {
        if (!this.config.enableLayers) return;
        
        const materialLayers = new Map();
        const heightLayers = new Map();
        
        // 재질별 레이어
        this.objects.forEach((object, name) => {
            const material = object.material;
            if (material && material.name) {
                const layerName = `Material_${material.name}`;
                if (!materialLayers.has(layerName)) {
                    materialLayers.set(layerName, new Set());
                }
                materialLayers.get(layerName).add(name);
            }
        });
        
        // 높이별 레이어
        const heightBands = [0, 2, 5, 10, 20]; // 미터 단위
        this.objects.forEach((object, name) => {
            const bbox = new THREE.Box3().setFromObject(object);
            const center = bbox.getCenter(new THREE.Vector3());
            const height = center.y;
            
            let layerName = 'Height_0-2m';
            for (let i = 0; i < heightBands.length - 1; i++) {
                if (height >= heightBands[i] && height < heightBands[i + 1]) {
                    layerName = `Height_${heightBands[i]}-${heightBands[i + 1]}m`;
                    break;
                } else if (height >= heightBands[heightBands.length - 1]) {
                    layerName = `Height_${heightBands[heightBands.length - 1]}m+`;
                    break;
                }
            }
            
            if (!heightLayers.has(layerName)) {
                heightLayers.set(layerName, new Set());
            }
            heightLayers.get(layerName).add(name);
        });
        
        // 레이어 등록
        materialLayers.forEach((objects, layerName) => {
            this.layers.set(layerName, objects);
            this.layerStates.set(layerName, true);
        });
        
        heightLayers.forEach((objects, layerName) => {
            this.layers.set(layerName, objects);
            this.layerStates.set(layerName, true);
        });
        
        console.log(`[ObjectVisibilityController] ${this.layers.size}개 레이어 자동 생성됨`);
    }
    
    /**
     * 객체 가시성 설정
     */
    setObjectVisibility(objectName, visible, animated = true) {
        const object = this.objects.get(objectName);
        if (!object) {
            console.warn(`[ObjectVisibilityController] 객체를 찾을 수 없음: ${objectName}`);
            return false;
        }
        
        const wasVisible = this.visibilityStates.get(objectName);
        if (wasVisible === visible) return true; // 이미 같은 상태
        
        this.visibilityStates.set(objectName, visible);
        
        if (animated && this.config.enableAnimations) {
            this.animateVisibility(object, visible);
        } else {
            object.visible = visible;
        }
        
        this.emit('object:visibility:change', { objectName, visible, animated });
        console.log(`[ObjectVisibilityController] ${objectName}: ${visible ? '표시' : '숨김'}`);
        
        return true;
    }
    
    /**
     * 그룹 가시성 설정
     */
    setGroupVisibility(groupName, visible, animated = true) {
        const group = this.groups.get(groupName);
        if (!group) {
            console.warn(`[ObjectVisibilityController] 그룹을 찾을 수 없음: ${groupName}`);
            return false;
        }
        
        this.groupStates.set(groupName, visible);
        
        // 그룹 내 모든 객체에 적용
        const promises = [];
        group.forEach(objectName => {
            promises.push(this.setObjectVisibility(objectName, visible, animated));
        });
        
        this.emit('group:visibility:change', { groupName, visible, animated, objectCount: group.size });
        console.log(`[ObjectVisibilityController] 그룹 ${groupName}: ${visible ? '표시' : '숨김'} (${group.size}개 객체)`);
        
        return Promise.all(promises);
    }
    
    /**
     * 레이어 가시성 설정
     */
    setLayerVisibility(layerName, visible, animated = true) {
        const layer = this.layers.get(layerName);
        if (!layer) {
            console.warn(`[ObjectVisibilityController] 레이어를 찾을 수 없음: ${layerName}`);
            return false;
        }
        
        this.layerStates.set(layerName, visible);
        
        // 레이어 내 모든 객체에 적용
        const promises = [];
        layer.forEach(objectName => {
            promises.push(this.setObjectVisibility(objectName, visible, animated));
        });
        
        this.emit('layer:visibility:change', { layerName, visible, animated, objectCount: layer.size });
        console.log(`[ObjectVisibilityController] 레이어 ${layerName}: ${visible ? '표시' : '숨김'} (${layer.size}개 객체)`);
        
        return Promise.all(promises);
    }
    
    /**
     * 가시성 애니메이션
     */
    animateVisibility(object, visible) {
        const animationId = `${object.name}_visibility`;
        
        // 기존 애니메이션 중지
        if (this.animations.has(animationId)) {
            this.animations.get(animationId).stop = true;
            this.animations.delete(animationId);
        }
        
        const startTime = performance.now();
        const duration = this.config.animationDuration;
        const startOpacity = object.material ? object.material.opacity : 1;
        const targetOpacity = visible ? 1 : 0;
        const easing = visible ? this.config.fadeInEasing : this.config.fadeOutEasing;
        
        // 투명도 애니메이션을 위한 머티리얼 설정
        if (object.material && !object.material.transparent) {
            object.material.transparent = true;
        }
        
        const animation = {
            object,
            startTime,
            duration,
            startOpacity,
            targetOpacity,
            easing,
            visible,
            stop: false
        };
        
        this.animations.set(animationId, animation);
        
        // 즉시 visible 설정 (투명도는 애니메이션으로 처리)
        if (visible) {
            object.visible = true;
        }
    }
    
    /**
     * 애니메이션 업데이트
     */
    updateAnimations() {
        const currentTime = performance.now();
        const completedAnimations = [];
        
        this.animations.forEach((animation, id) => {
            if (animation.stop) {
                completedAnimations.push(id);
                return;
            }
            
            const elapsed = currentTime - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            
            // 이징 함수 적용
            const easedProgress = this.applyEasing(progress, animation.easing);
            
            // 투명도 보간
            const currentOpacity = animation.startOpacity + (animation.targetOpacity - animation.startOpacity) * easedProgress;
            
            if (animation.object.material) {
                animation.object.material.opacity = currentOpacity;
            }
            
            // 애니메이션 완료 처리
            if (progress >= 1) {
                if (!animation.visible) {
                    animation.object.visible = false;
                }
                
                // 투명도 복원
                if (animation.object.material) {
                    animation.object.material.opacity = animation.targetOpacity;
                }
                
                completedAnimations.push(id);
                this.emit('animation:complete', { objectName: animation.object.name, visible: animation.visible });
            }
        });
        
        // 완료된 애니메이션 제거
        completedAnimations.forEach(id => {
            this.animations.delete(id);
        });
    }
    
    /**
     * 이징 함수 적용
     */
    applyEasing(t, easing) {
        switch (easing) {
            case 'linear': return t;
            case 'easeIn': return t * t;
            case 'easeOut': return 1 - (1 - t) * (1 - t);
            case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
            default: return t;
        }
    }
    
    /**
     * 필터 등록
     */
    registerFilter(name, filterFunction) {
        this.filters.set(name, filterFunction);
        console.log(`[ObjectVisibilityController] 필터 등록: ${name}`);
    }
    
    /**
     * 필터 적용
     */
    applyFilter(filterName, filterValue, visible = false) {
        const filterFunction = this.filters.get(filterName);
        if (!filterFunction) {
            console.warn(`[ObjectVisibilityController] 필터를 찾을 수 없음: ${filterName}`);
            return;
        }
        
        this.objects.forEach((object, name) => {
            const value = filterFunction(object);
            if (value === filterValue) {
                this.setObjectVisibility(name, visible, true);
            }
        });
        
        if (visible) {
            this.activeFilters.add(`${filterName}:${filterValue}`);
        } else {
            this.activeFilters.delete(`${filterName}:${filterValue}`);
        }
        
        this.emit('filter:applied', { filterName, filterValue, visible });
    }
    
    /**
     * 모든 필터 초기화
     */
    clearFilters() {
        this.activeFilters.clear();
        this.showAll(true);
        this.emit('filters:cleared');
    }
    
    /**
     * 객체 하이라이트
     */
    highlightObject(objectName, highlight = true) {
        if (!this.config.enableHighlight) return;
        
        const object = this.objects.get(objectName);
        if (!object) return;
        
        if (highlight) {
            if (!this.highlightedObjects.has(objectName)) {
                // 원본 머티리얼 저장
                if (object.material) {
                    this.originalMaterials.set(objectName, object.material);
                }
                
                // 하이라이트 머티리얼 적용
                object.material = this.highlightMaterial;
                this.highlightedObjects.add(objectName);
                
                this.emit('object:highlighted', { objectName });
            }
        } else {
            if (this.highlightedObjects.has(objectName)) {
                // 원본 머티리얼 복원
                const originalMaterial = this.originalMaterials.get(objectName);
                if (originalMaterial) {
                    object.material = originalMaterial;
                }
                
                this.highlightedObjects.delete(objectName);
                this.emit('object:unhighlighted', { objectName });
            }
        }
    }
    
    /**
     * 모든 하이라이트 제거
     */
    removeAllHighlights() {
        this.highlightedObjects.forEach(objectName => {
            this.highlightObject(objectName, false);
        });
    }
    
    /**
     * 모든 객체 표시
     */
    showAll(animated = true) {
        this.objects.forEach((object, name) => {
            this.setObjectVisibility(name, true, animated);
        });
        
        this.emit('all:shown');
    }
    
    /**
     * 모든 객체 숨김
     */
    hideAll(animated = true) {
        this.objects.forEach((object, name) => {
            this.setObjectVisibility(name, false, animated);
        });
        
        this.emit('all:hidden');
    }
    
    /**
     * 가시성 반전
     */
    invertVisibility(animated = true) {
        this.objects.forEach((object, name) => {
            const currentState = this.visibilityStates.get(name);
            this.setObjectVisibility(name, !currentState, animated);
        });
        
        this.emit('visibility:inverted');
    }
    
    /**
     * 상태 저장
     */
    saveState() {
        const state = {
            timestamp: Date.now(),
            objects: Object.fromEntries(this.visibilityStates),
            groups: Object.fromEntries(this.groupStates),
            layers: Object.fromEntries(this.layerStates),
            activeFilters: Array.from(this.activeFilters),
            highlighted: Array.from(this.highlightedObjects)
        };
        
        return state;
    }
    
    /**
     * 상태 복원
     */
    restoreState(state, animated = true) {
        if (!state) return;
        
        // 객체 상태 복원
        if (state.objects) {
            Object.entries(state.objects).forEach(([name, visible]) => {
                this.setObjectVisibility(name, visible, animated);
            });
        }
        
        // 그룹 상태 복원
        if (state.groups) {
            Object.entries(state.groups).forEach(([name, visible]) => {
                this.groupStates.set(name, visible);
            });
        }
        
        // 레이어 상태 복원
        if (state.layers) {
            Object.entries(state.layers).forEach(([name, visible]) => {
                this.layerStates.set(name, visible);
            });
        }
        
        // 필터 복원
        if (state.activeFilters) {
            this.activeFilters.clear();
            state.activeFilters.forEach(filter => {
                this.activeFilters.add(filter);
            });
        }
        
        // 하이라이트 복원
        if (state.highlighted) {
            this.removeAllHighlights();
            state.highlighted.forEach(objectName => {
                this.highlightObject(objectName, true);
            });
        }
        
        this.emit('state:restored', state);
    }
    
    /**
     * 통계 정보
     */
    getStatistics() {
        const totalObjects = this.objects.size;
        const visibleObjects = Array.from(this.visibilityStates.values()).filter(v => v).length;
        const hiddenObjects = totalObjects - visibleObjects;
        
        return {
            totalObjects,
            visibleObjects,
            hiddenObjects,
            groups: this.groups.size,
            layers: this.layers.size,
            activeFilters: this.activeFilters.size,
            highlightedObjects: this.highlightedObjects.size,
            runningAnimations: this.animations.size
        };
    }
    
    /**
     * 객체가 속한 그룹 목록
     */
    getObjectGroups(objectName) {
        const groups = [];
        this.groups.forEach((objects, groupName) => {
            if (objects.has(objectName)) {
                groups.push(groupName);
            }
        });
        return groups;
    }
    
    /**
     * 객체가 속한 레이어 목록
     */
    getObjectLayers(objectName) {
        const layers = [];
        this.layers.forEach((objects, layerName) => {
            if (objects.has(objectName)) {
                layers.push(layerName);
            }
        });
        return layers;
    }
    
    /**
     * 앱 참조 설정 (의존성 주입)
     */
    setApp(app) {
        this.app = app;
    }
    
    /**
     * 정리
     */
    clear() {
        // 애니메이션 중지
        this.animations.forEach(animation => {
            animation.stop = true;
        });
        this.animations.clear();
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // 하이라이트 제거
        this.removeAllHighlights();
        
        // 데이터 정리
        this.objects.clear();
        this.groups.clear();
        this.layers.clear();
        this.visibilityStates.clear();
        this.groupStates.clear();
        this.layerStates.clear();
        this.activeFilters.clear();
        this.originalMaterials.clear();
        
        this.emit('cleared');
        console.log('[ObjectVisibilityController] 데이터 정리됨');
    }
    
    /**
     * 소멸자
     */
    destroy() {
        this.clear();
        
        // 이벤트 리스너 정리
        this.events.clear();
        
        // 머티리얼 정리
        if (this.highlightMaterial) {
            this.highlightMaterial.dispose();
        }
        
        console.log('[ObjectVisibilityController] 소멸됨');
    }
    
    /**
     * 이벤트 시스템
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }
    
    emit(event, ...args) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[ObjectVisibilityController] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[ObjectVisibilityController] 디버그 정보');
        console.log('통계:', this.getStatistics());
        console.log('그룹:', Array.from(this.groups.keys()));
        console.log('레이어:', Array.from(this.layers.keys()));
        console.log('활성 필터:', Array.from(this.activeFilters));
        console.log('실행 중인 애니메이션:', this.animations.size);
        console.log('하이라이트된 객체:', Array.from(this.highlightedObjects));
        console.groupEnd();
    }
}

export default ObjectVisibilityController;