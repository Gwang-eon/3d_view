// js/plugins/MeasurementPlugin.js
// 측정 도구 플러그인 - 3D 공간에서 거리/각도 측정

import { Plugin } from '../PluginSystem.js';
import { getConfig, setConfig } from '../core/ConfigManager.js';

/**
 * 측정 도구 플러그인
 * - 점 간 거리 측정
 * - 각도 측정
 * - 면적 측정 (다각형)
 * - 측정 결과 저장/불러오기
 * - 측정값 표시 스타일 설정
 */
export class MeasurementPlugin extends Plugin {
    constructor(options = {}) {
        super('Measurement', '1.0.0', {
            displayName: '측정 도구',
            ...options
        });
        
        // 측정 상태
        this.measurementState = {
            isActive: false,
            mode: 'distance', // 'distance', 'angle', 'area'
            currentMeasurement: null,
            points: []
        };
        
        // 측정 데이터
        this.measurements = new Map();
        this.measurementCounter = 0;
        
        // Three.js 객체들
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'MeasurementGroup';
        
        // UI 요소들
        this.controls = new Map();
        
        // 이벤트 바인딩
        this.onMouseClick = this.onMouseClick.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }
    
    /**
     * 기본 설정
     */
    async getDefaultConfig() {
        return {
            ...await super.getDefaultConfig(),
            
            // 측정 설정
            measurement: {
                defaultMode: 'distance',
                units: 'meter', // 'meter', 'centimeter', 'millimeter', 'inch', 'foot'
                precision: 2, // 소수점 자릿수
                enableSnapping: true,
                snapDistance: 0.5
            },
            
            // 표시 설정
            display: {
                pointSize: 0.1,
                lineWidth: 2,
                fontSize: 14,
                fontFamily: 'Arial, sans-serif',
                
                colors: {
                    point: '#ff4444',
                    line: '#00ff00',
                    text: '#ffffff',
                    highlight: '#ffff00',
                    area: '#0088ff'
                },
                
                opacity: {
                    line: 0.8,
                    text: 1.0,
                    area: 0.3
                }
            },
            
            // 단축키
            shortcuts: {
                toggleMeasurement: 'KeyM',
                deleteLast: 'Backspace',
                clearAll: 'Delete',
                changeMode: 'Tab'
            },
            
            // UI 설정
            ui: {
                visible: true,
                position: 'right',
                collapsible: true,
                showMeasurementList: true,
                showSettings: true
            }
        };
    }
    
    /**
     * 의존성
     */
    getDependencies() {
        return ['sceneManager'];
    }
    
    /**
     * 초기화
     */
    async onInit() {
        // 측정 그룹을 씬에 추가
        const sceneManager = this.context.sceneManager;
        if (sceneManager && sceneManager.scene) {
            sceneManager.scene.add(this.measurementGroup);
        }
        
        console.log('[Measurement] 측정 도구 플러그인 초기화됨');
    }
    
    /**
     * UI 생성
     */
    async onCreateUI(container) {
        const content = container.querySelector('.plugin-content');
        if (!content) return;
        
        // 모드 선택 섹션
        this.createModeSection(content);
        
        // 측정 컨트롤 섹션
        this.createControlSection(content);
        
        // 측정 목록 섹션
        if (this.config.ui.showMeasurementList) {
            this.createMeasurementListSection(content);
        }
        
        // 설정 섹션
        if (this.config.ui.showSettings) {
            this.createSettingsSection(content);
        }
        
        // 액션 버튼들
        this.createActionButtons(content);
    }
    
    /**
     * 모드 선택 섹션
     */
    createModeSection(container) {
        const section = document.createElement('div');
        section.className = 'measurement-section mode-section';
        section.innerHTML = '<h4>측정 모드</h4>';
        
        const modeSelect = this.createSelect(
            '모드',
            [
                { value: 'distance', label: '거리 측정' },
                { value: 'angle', label: '각도 측정' },
                { value: 'area', label: '면적 측정' }
            ],
            this.config.measurement.defaultMode,
            (mode) => this.setMeasurementMode(mode)
        );
        
        section.appendChild(modeSelect);
        container.appendChild(section);
        this.controls.set('modeSelect', modeSelect);
    }
    
    /**
     * 컨트롤 섹션
     */
    createControlSection(container) {
        const section = document.createElement('div');
        section.className = 'measurement-section control-section';
        section.innerHTML = '<h4>측정 컨트롤</h4>';
        
        // 측정 활성화 토글
        const toggleBtn = this.createButton(
            '측정 시작',
            () => this.toggleMeasurement(),
            { fullWidth: true }
        );
        toggleBtn.id = 'measurement-toggle';
        section.appendChild(toggleBtn);
        this.controls.set('toggleButton', toggleBtn);
        
        // 현재 측정 정보
        const infoDiv = document.createElement('div');
        infoDiv.className = 'current-measurement-info';
        infoDiv.style.marginTop = '12px';
        infoDiv.style.padding = '8px';
        infoDiv.style.background = 'rgba(0, 0, 0, 0.3)';
        infoDiv.style.borderRadius = '4px';
        infoDiv.style.fontSize = '12px';
        infoDiv.innerHTML = '<em>측정을 시작하려면 위 버튼을 클릭하세요</em>';
        section.appendChild(infoDiv);
        this.controls.set('measurementInfo', infoDiv);
        
        container.appendChild(section);
    }
    
    /**
     * 측정 목록 섹션
     */
    createMeasurementListSection(container) {
        const section = document.createElement('div');
        section.className = 'measurement-section list-section';
        section.innerHTML = '<h4>측정 결과</h4>';
        
        const listContainer = document.createElement('div');
        listContainer.className = 'measurement-list';
        listContainer.style.maxHeight = '200px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        listContainer.style.borderRadius = '4px';
        listContainer.style.padding = '8px';
        
        section.appendChild(listContainer);
        container.appendChild(section);
        this.controls.set('measurementList', listContainer);
        
        this.updateMeasurementList();
    }
    
    /**
     * 설정 섹션
     */
    createSettingsSection(container) {
        const section = document.createElement('div');
        section.className = 'measurement-section settings-section';
        
        const header = document.createElement('h4');
        header.textContent = '설정 ▼';
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        
        const settingsContent = document.createElement('div');
        settingsContent.className = 'settings-content';
        settingsContent.style.display = 'none';
        
        // 토글 기능
        header.addEventListener('click', () => {
            const isVisible = settingsContent.style.display !== 'none';
            settingsContent.style.display = isVisible ? 'none' : 'block';
            header.textContent = `설정 ${isVisible ? '▼' : '▲'}`;
        });
        
        // 단위 설정
        const unitSelect = this.createSelect(
            '단위',
            [
                { value: 'meter', label: '미터 (m)' },
                { value: 'centimeter', label: '센티미터 (cm)' },
                { value: 'millimeter', label: '밀리미터 (mm)' },
                { value: 'inch', label: '인치 (in)' },
                { value: 'foot', label: '피트 (ft)' }
            ],
            this.config.measurement.units,
            (unit) => this.setUnits(unit)
        );
        settingsContent.appendChild(unitSelect);
        
        // 정밀도 설정
        const precisionSlider = this.createSlider(
            '소수점 자릿수',
            0, 4, this.config.measurement.precision,
            (precision) => this.setPrecision(Math.round(precision)),
            { step: 1, decimals: 0 }
        );
        settingsContent.appendChild(precisionSlider);
        
        // 스냅 설정
        const snapToggle = this.createCheckbox(
            '스냅 활성화',
            this.config.measurement.enableSnapping,
            (enabled) => this.setSnapping(enabled)
        );
        settingsContent.appendChild(snapToggle);
        
        section.appendChild(header);
        section.appendChild(settingsContent);
        container.appendChild(section);
    }
    
    /**
     * 액션 버튼들
     */
    createActionButtons(container) {
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'measurement-actions';
        buttonGroup.style.marginTop = '16px';
        buttonGroup.style.display = 'flex';
        buttonGroup.style.flexDirection = 'column';
        buttonGroup.style.gap = '8px';
        
        // 마지막 측정 삭제
        const deleteLastBtn = this.createButton('마지막 측정 삭제', () => {
            this.deleteLastMeasurement();
        }, { fullWidth: true });
        deleteLastBtn.style.marginBottom = '0';
        
        // 모든 측정 삭제
        const clearAllBtn = this.createButton('모든 측정 삭제', () => {
            this.clearAllMeasurements();
        }, { fullWidth: true });
        clearAllBtn.style.marginBottom = '0';
        clearAllBtn.style.background = '#d44';
        
        // 측정 결과 내보내기
        const exportBtn = this.createButton('결과 내보내기', () => {
            this.exportMeasurements();
        }, { fullWidth: true });
        exportBtn.style.marginBottom = '0';
        
        buttonGroup.appendChild(deleteLastBtn);
        buttonGroup.appendChild(clearAllBtn);
        buttonGroup.appendChild(exportBtn);
        container.appendChild(buttonGroup);
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 키보드 이벤트
        document.addEventListener('keydown', this.onKeyDown);
    }
    
    /**
     * 측정 모드 설정
     */
    setMeasurementMode(mode) {
        this.measurementState.mode = mode;
        this.config.measurement.defaultMode = mode;
        this.saveConfig();
        
        // 현재 측정 중이면 취소
        if (this.measurementState.isActive) {
            this.cancelCurrentMeasurement();
        }
        
        this.updateMeasurementInfo();
        console.log(`[Measurement] 모드 변경: ${mode}`);
    }
    
    /**
     * 측정 토글
     */
    toggleMeasurement() {
        if (this.measurementState.isActive) {
            this.stopMeasurement();
        } else {
            this.startMeasurement();
        }
    }
    
    /**
     * 측정 시작
     */
    startMeasurement() {
        this.measurementState.isActive = true;
        this.measurementState.points = [];
        
        // 이벤트 리스너 추가
        const canvas = this.context.sceneManager.renderer.domElement;
        canvas.addEventListener('click', this.onMouseClick);
        canvas.addEventListener('mousemove', this.onMouseMove);
        
        // UI 업데이트
        const toggleBtn = this.controls.get('toggleButton');
        if (toggleBtn) {
            toggleBtn.textContent = '측정 중지';
            toggleBtn.style.background = '#d44';
        }
        
        this.updateMeasurementInfo('측정할 점을 클릭하세요');
        
        console.log('[Measurement] 측정 시작');
    }
    
    /**
     * 측정 중지
     */
    stopMeasurement() {
        this.measurementState.isActive = false;
        
        // 이벤트 리스너 제거
        const canvas = this.context.sceneManager.renderer.domElement;
        canvas.removeEventListener('click', this.onMouseClick);
        canvas.removeEventListener('mousemove', this.onMouseMove);
        
        // 현재 측정 완료 처리
        this.finishCurrentMeasurement();
        
        // UI 업데이트
        const toggleBtn = this.controls.get('toggleButton');
        if (toggleBtn) {
            toggleBtn.textContent = '측정 시작';
            toggleBtn.style.background = '#444';
        }
        
        this.updateMeasurementInfo('측정이 중지되었습니다');
        
        console.log('[Measurement] 측정 중지');
    }
    
    /**
     * 마우스 클릭 처리
     */
    onMouseClick(event) {
        if (!this.measurementState.isActive) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // 마우스 좌표 계산
        this.updateMousePosition(event);
        
        // 레이캐스팅으로 교차점 찾기
        const intersections = this.getIntersections();
        
        if (intersections.length > 0) {
            const point = intersections[0].point.clone();
            this.addMeasurementPoint(point);
        }
    }
    
    /**
     * 마우스 이동 처리
     */
    onMouseMove(event) {
        if (!this.measurementState.isActive) return;
        
        this.updateMousePosition(event);
        this.updatePreview();
    }
    
    /**
     * 키보드 이벤트 처리
     */
    onKeyDown(event) {
        if (!this.enabled) return;
        
        const shortcuts = this.config.shortcuts;
        
        switch (event.code) {
            case shortcuts.toggleMeasurement:
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.toggleMeasurement();
                }
                break;
                
            case shortcuts.deleteLast:
                if (this.measurementState.isActive) {
                    event.preventDefault();
                    this.removeLastPoint();
                }
                break;
                
            case shortcuts.clearAll:
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.clearAllMeasurements();
                }
                break;
                
            case shortcuts.changeMode:
                if (this.measurementState.isActive) {
                    event.preventDefault();
                    this.cycleMeasurementMode();
                }
                break;
                
            case 'Escape':
                if (this.measurementState.isActive) {
                    event.preventDefault();
                    this.cancelCurrentMeasurement();
                }
                break;
        }
    }
    
    /**
     * 마우스 위치 업데이트
     */
    updateMousePosition(event) {
        const canvas = this.context.sceneManager.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    /**
     * 레이캐스팅으로 교차점 찾기
     */
    getIntersections() {
        const camera = this.context.sceneManager.camera;
        const scene = this.context.sceneManager.scene;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        // 측정 그룹은 제외하고 교차점 계산
        const objects = scene.children.filter(child => 
            child !== this.measurementGroup && 
            child.visible
        );
        
        return this.raycaster.intersectObjects(objects, true);
    }
    
    /**
     * 측정점 추가
     */
    addMeasurementPoint(point) {
        // 스냅 처리
        if (this.config.measurement.enableSnapping) {
            point = this.snapPoint(point);
        }
        
        this.measurementState.points.push(point);
        
        // 점 시각화 추가
        this.addPointVisualization(point);
        
        // 모드별 처리
        switch (this.measurementState.mode) {
            case 'distance':
                this.handleDistanceMeasurement();
                break;
            case 'angle':
                this.handleAngleMeasurement();
                break;
            case 'area':
                this.handleAreaMeasurement();
                break;
        }
        
        this.updateMeasurementInfo();
    }
    
    /**
     * 점 스냅 처리
     */
    snapPoint(point) {
        const snapDistance = this.config.measurement.snapDistance;
        
        // 기존 측정점들과의 거리 확인
        for (const measurement of this.measurements.values()) {
            for (const existingPoint of measurement.points) {
                if (point.distanceTo(existingPoint) < snapDistance) {
                    return existingPoint.clone();
                }
            }
        }
        
        // 원점과의 거리 확인
        const origin = new THREE.Vector3(0, 0, 0);
        if (point.distanceTo(origin) < snapDistance) {
            return origin.clone();
        }
        
        return point;
    }
    
    /**
     * 점 시각화 추가
     */
    addPointVisualization(point) {
        const geometry = new THREE.SphereGeometry(this.config.display.pointSize, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: this.config.display.colors.point
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        sphere.userData.isMeasurementPoint = true;
        
        this.measurementGroup.add(sphere);
    }
    
    /**
     * 거리 측정 처리
     */
    handleDistanceMeasurement() {
        const points = this.measurementState.points;
        
        if (points.length === 2) {
            const distance = points[0].distanceTo(points[1]);
            this.completeMeasurement({
                type: 'distance',
                points: [...points],
                value: distance,
                unit: this.config.measurement.units
            });
        }
    }
    
    /**
     * 각도 측정 처리
     */
    handleAngleMeasurement() {
        const points = this.measurementState.points;
        
        if (points.length === 3) {
            const angle = this.calculateAngle(points[0], points[1], points[2]);
            this.completeMeasurement({
                type: 'angle',
                points: [...points],
                value: angle,
                unit: 'degree'
            });
        }
    }
    
    /**
     * 면적 측정 처리
     */
    handleAreaMeasurement() {
        const points = this.measurementState.points;
        
        // 최소 3점 필요, 엔터키나 우클릭으로 완료
        if (points.length >= 3) {
            // 임시로 면적 표시 (완료는 별도 처리)
            this.updateAreaPreview(points);
        }
    }
    
    /**
     * 각도 계산
     */
    calculateAngle(point1, point2, point3) {
        const v1 = new THREE.Vector3().subVectors(point1, point2);
        const v2 = new THREE.Vector3().subVectors(point3, point2);
        
        const angle = v1.angleTo(v2);
        return THREE.MathUtils.radToDeg(angle);
    }
    
    /**
     * 면적 계산 (다각형)
     */
    calculatePolygonArea(points) {
        if (points.length < 3) return 0;
        
        // 3D 다각형의 면적 계산 (벡터 외적 사용)
        let area = 0;
        const n = points.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const cross = new THREE.Vector3().crossVectors(points[i], points[j]);
            area += cross.length();
        }
        
        return area * 0.5;
    }
    
    /**
     * 측정 완료
     */
    completeMeasurement(measurementData) {
        const id = `measurement_${++this.measurementCounter}`;
        
        // 측정 데이터 저장
        const measurement = {
            id: id,
            ...measurementData,
            timestamp: Date.now(),
            formattedValue: this.formatValue(measurementData.value, measurementData.unit)
        };
        
        this.measurements.set(id, measurement);
        
        // 시각화 추가
        this.addMeasurementVisualization(measurement);
        
        // UI 업데이트
        this.updateMeasurementList();
        
        // 현재 측정 초기화
        this.measurementState.points = [];
        
        console.log(`[Measurement] 측정 완료: ${measurement.formattedValue}`);
    }
    
    /**
     * 측정값 포맷팅
     */
    formatValue(value, unit) {
        const convertedValue = this.convertUnits(value, 'meter', unit);
        const precision = this.config.measurement.precision;
        
        let unitSymbol = '';
        switch (unit) {
            case 'meter': unitSymbol = 'm'; break;
            case 'centimeter': unitSymbol = 'cm'; break;
            case 'millimeter': unitSymbol = 'mm'; break;
            case 'inch': unitSymbol = 'in'; break;
            case 'foot': unitSymbol = 'ft'; break;
            case 'degree': unitSymbol = '°'; break;
        }
        
        return `${convertedValue.toFixed(precision)} ${unitSymbol}`;
    }
    
    /**
     * 단위 변환
     */
    convertUnits(value, fromUnit, toUnit) {
        // meter를 기준으로 변환
        const toMeter = {
            meter: 1,
            centimeter: 100,
            millimeter: 1000,
            inch: 39.3701,
            foot: 3.28084
        };
        
        if (fromUnit === toUnit) return value;
        
        // meter로 변환 후 목표 단위로 변환
        const meterValue = value / toMeter[fromUnit];
        return meterValue * toMeter[toUnit];
    }
    
    /**
     * 측정 시각화 추가
     */
    addMeasurementVisualization(measurement) {
        switch (measurement.type) {
            case 'distance':
                this.addDistanceVisualization(measurement);
                break;
            case 'angle':
                this.addAngleVisualization(measurement);
                break;
            case 'area':
                this.addAreaVisualization(measurement);
                break;
        }
    }
    
    /**
     * 거리 시각화
     */
    addDistanceVisualization(measurement) {
        const points = measurement.points;
        
        // 선 그리기
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.config.display.colors.line,
            opacity: this.config.display.opacity.line,
            transparent: true
        });
        
        const line = new THREE.Line(geometry, material);
        line.userData.measurementId = measurement.id;
        this.measurementGroup.add(line);
        
        // 텍스트 라벨 추가
        this.addTextLabel(
            measurement.formattedValue,
            new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5)
        );
    }
    
    /**
     * 각도 시각화
     */
    addAngleVisualization(measurement) {
        const points = measurement.points;
        const center = points[1]; // 중심점
        
        // 각도 호 그리기
        const radius = Math.min(
            center.distanceTo(points[0]),
            center.distanceTo(points[2])
        ) * 0.3;
        
        const arcGeometry = this.createArcGeometry(points[0], center, points[2], radius);
        const arcMaterial = new THREE.LineBasicMaterial({
            color: this.config.display.colors.line,
            opacity: this.config.display.opacity.line,
            transparent: true
        });
        
        const arc = new THREE.Line(arcGeometry, arcMaterial);
        arc.userData.measurementId = measurement.id;
        this.measurementGroup.add(arc);
        
        // 텍스트 라벨
        const labelPosition = center.clone().add(
            new THREE.Vector3().addVectors(
                new THREE.Vector3().subVectors(points[0], center).normalize(),
                new THREE.Vector3().subVectors(points[2], center).normalize()
            ).normalize().multiplyScalar(radius * 1.5)
        );
        
        this.addTextLabel(measurement.formattedValue, labelPosition);
    }
    
    /**
     * 호 지오메트리 생성
     */
    createArcGeometry(point1, center, point2, radius) {
        const v1 = new THREE.Vector3().subVectors(point1, center).normalize();
        const v2 = new THREE.Vector3().subVectors(point2, center).normalize();
        
        const angle = v1.angleTo(v2);
        const segments = Math.max(8, Math.floor(angle / (Math.PI / 16)));
        
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentAngle = angle * t;
            
            const rotationAxis = new THREE.Vector3().crossVectors(v1, v2).normalize();
            const rotatedVector = v1.clone().applyAxisAngle(rotationAxis, currentAngle);
            
            points.push(center.clone().add(rotatedVector.multiplyScalar(radius)));
        }
        
        return new THREE.BufferGeometry().setFromPoints(points);
    }
    
    /**
     * 면적 시각화
     */
    addAreaVisualization(measurement) {
        const points = measurement.points;
        
        // 면 생성
        const shape = new THREE.Shape();
        
        // 2D 평면으로 투영 (간단한 구현)
        shape.moveTo(points[0].x, points[0].z);
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].z);
        }
        
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: this.config.display.colors.area,
            opacity: this.config.display.opacity.area,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.measurementId = measurement.id;
        this.measurementGroup.add(mesh);
        
        // 외곽선
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: this.config.display.colors.line
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.userData.measurementId = measurement.id;
        this.measurementGroup.add(edges);
        
        // 중심점에 라벨
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        
        this.addTextLabel(measurement.formattedValue, center);
    }
    
    /**
     * 텍스트 라벨 추가
     */
    addTextLabel(text, position) {
        // Canvas를 사용한 텍스트 텍스처 생성
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = 256;
        canvas.height = 64;
        
        context.font = `${this.config.display.fontSize}px ${this.config.display.fontFamily}`;
        context.fillStyle = this.config.display.colors.text;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // 텍스처 생성
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: this.config.display.opacity.text
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.scale.setScalar(1);
        sprite.userData.isMeasurementLabel = true;
        
        this.measurementGroup.add(sprite);
    }
    
    /**
     * 미리보기 업데이트
     */
    updatePreview() {
        // 현재 마우스 위치의 교차점 표시
        const intersections = this.getIntersections();
        
        if (intersections.length > 0) {
            // 마우스 커서 변경 등
        }
    }
    
    /**
     * 면적 미리보기 업데이트
     */
    updateAreaPreview(points) {
        // 임시 면적 시각화 (완료 전)
    }
    
    /**
     * 측정 정보 업데이트
     */
    updateMeasurementInfo(message) {
        const infoDiv = this.controls.get('measurementInfo');
        if (!infoDiv) return;
        
        if (message) {
            infoDiv.innerHTML = message;
            return;
        }
        
        const mode = this.measurementState.mode;
        const pointCount = this.measurementState.points.length;
        
        let info = '';
        
        switch (mode) {
            case 'distance':
                info = pointCount === 0 ? '시작점을 클릭하세요' :
                       pointCount === 1 ? '끝점을 클릭하세요' :
                       '거리 측정 완료';
                break;
                
            case 'angle':
                info = pointCount === 0 ? '첫 번째 점을 클릭하세요' :
                       pointCount === 1 ? '중심점을 클릭하세요' :
                       pointCount === 2 ? '세 번째 점을 클릭하세요' :
                       '각도 측정 완료';
                break;
                
            case 'area':
                info = pointCount < 3 ? `점 ${pointCount}/3+ (최소 3개 점 필요)` :
                       `다각형 ${pointCount}개 점 (Enter로 완료)`;
                break;
        }
        
        infoDiv.innerHTML = info;
    }
    
    /**
     * 측정 목록 업데이트
     */
    updateMeasurementList() {
        const listContainer = this.controls.get('measurementList');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        if (this.measurements.size === 0) {
            listContainer.innerHTML = '<em>측정 결과가 없습니다</em>';
            return;
        }
        
        this.measurements.forEach((measurement, id) => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.style.padding = '8px';
            item.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            item.style.cursor = 'pointer';
            
            const typeIcon = {
                distance: '📏',
                angle: '📐',
                area: '📐'
            }[measurement.type];
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${typeIcon} ${measurement.formattedValue}</span>
                    <button class="delete-measurement" data-id="${id}" 
                            style="background: none; border: none; color: #ff4444; cursor: pointer; font-size: 16px;">
                        ×
                    </button>
                </div>
            `;
            
            // 클릭으로 측정 하이라이트
            item.addEventListener('click', () => {
                this.highlightMeasurement(id);
            });
            
            // 삭제 버튼
            const deleteBtn = item.querySelector('.delete-measurement');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMeasurement(id);
            });
            
            listContainer.appendChild(item);
        });
    }
    
    /**
     * 측정 하이라이트
     */
    highlightMeasurement(id) {
        // 모든 측정 객체의 원래 색상으로 복원
        this.measurementGroup.children.forEach(child => {
            if (child.material) {
                if (child.material.color) {
                    child.material.color.setHex(
                        parseInt(this.config.display.colors.line.replace('#', '0x'))
                    );
                }
            }
        });
        
        // 선택된 측정 하이라이트
        this.measurementGroup.children.forEach(child => {
            if (child.userData.measurementId === id && child.material && child.material.color) {
                child.material.color.setHex(
                    parseInt(this.config.display.colors.highlight.replace('#', '0x'))
                );
            }
        });
    }
    
    /**
     * 측정 삭제
     */
    deleteMeasurement(id) {
        // 측정 데이터 삭제
        this.measurements.delete(id);
        
        // 시각화 객체 삭제
        const objectsToRemove = this.measurementGroup.children.filter(
            child => child.userData.measurementId === id
        );
        
        objectsToRemove.forEach(obj => {
            this.measurementGroup.remove(obj);
            if (obj.material) obj.material.dispose();
            if (obj.geometry) obj.geometry.dispose();
        });
        
        // UI 업데이트
        this.updateMeasurementList();
        
        console.log(`[Measurement] 측정 삭제: ${id}`);
    }
    
    /**
     * 마지막 측정 삭제
     */
    deleteLastMeasurement() {
        if (this.measurements.size === 0) return;
        
        // 가장 최근 측정 찾기
        let lastMeasurement = null;
        let lastTimestamp = 0;
        
        this.measurements.forEach((measurement, id) => {
            if (measurement.timestamp > lastTimestamp) {
                lastTimestamp = measurement.timestamp;
                lastMeasurement = id;
            }
        });
        
        if (lastMeasurement) {
            this.deleteMeasurement(lastMeasurement);
        }
    }
    
    /**
     * 모든 측정 삭제
     */
    clearAllMeasurements() {
        if (this.measurements.size === 0) return;
        
        if (!confirm('모든 측정 결과를 삭제하시겠습니까?')) return;
        
        // 모든 측정 데이터 삭제
        this.measurements.clear();
        
        // 모든 시각화 객체 삭제
        while (this.measurementGroup.children.length > 0) {
            const child = this.measurementGroup.children[0];
            this.measurementGroup.remove(child);
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
        }
        
        // UI 업데이트
        this.updateMeasurementList();
        
        console.log('[Measurement] 모든 측정 삭제됨');
    }
    
    /**
     * 현재 측정 취소
     */
    cancelCurrentMeasurement() {
        this.measurementState.points = [];
        
        // 임시 시각화 제거
        const tempObjects = this.measurementGroup.children.filter(
            child => child.userData.isMeasurementPoint && !child.userData.measurementId
        );
        
        tempObjects.forEach(obj => {
            this.measurementGroup.remove(obj);
        });
        
        this.updateMeasurementInfo('측정이 취소되었습니다');
    }
    
    /**
     * 마지막 점 제거
     */
    removeLastPoint() {
        if (this.measurementState.points.length === 0) return;
        
        this.measurementState.points.pop();
        
        // 마지막 점 시각화 제거
        const pointObjects = this.measurementGroup.children.filter(
            child => child.userData.isMeasurementPoint && !child.userData.measurementId
        );
        
        if (pointObjects.length > 0) {
            const lastPoint = pointObjects[pointObjects.length - 1];
            this.measurementGroup.remove(lastPoint);
        }
        
        this.updateMeasurementInfo();
    }
    
    /**
     * 측정 모드 순환
     */
    cycleMeasurementMode() {
        const modes = ['distance', 'angle', 'area'];
        const currentIndex = modes.indexOf(this.measurementState.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        
        this.setMeasurementMode(modes[nextIndex]);
        
        // UI 업데이트
        const modeSelect = this.controls.get('modeSelect')?.querySelector('select');
        if (modeSelect) {
            modeSelect.value = modes[nextIndex];
        }
    }
    
    /**
     * 현재 측정 완료
     */
    finishCurrentMeasurement() {
        const points = this.measurementState.points;
        
        if (points.length >= 3 && this.measurementState.mode === 'area') {
            const area = this.calculatePolygonArea(points);
            this.completeMeasurement({
                type: 'area',
                points: [...points],
                value: area,
                unit: 'meter'
            });
        }
        
        this.measurementState.points = [];
    }
    
    /**
     * 설정 변경 메서드들
     */
    setUnits(unit) {
        this.config.measurement.units = unit;
        this.saveConfig();
        
        // 기존 측정값들 재포맷
        this.measurements.forEach(measurement => {
            if (measurement.type !== 'angle') {
                measurement.unit = unit;
                measurement.formattedValue = this.formatValue(measurement.value, unit);
            }
        });
        
        this.updateMeasurementList();
    }
    
    setPrecision(precision) {
        this.config.measurement.precision = precision;
        this.saveConfig();
        
        // 기존 측정값들 재포맷
        this.measurements.forEach(measurement => {
            measurement.formattedValue = this.formatValue(measurement.value, measurement.unit);
        });
        
        this.updateMeasurementList();
    }
    
    setSnapping(enabled) {
        this.config.measurement.enableSnapping = enabled;
        this.saveConfig();
    }
    
    /**
     * 측정 결과 내보내기
     */
    exportMeasurements() {
        if (this.measurements.size === 0) {
            alert('내보낼 측정 결과가 없습니다.');
            return;
        }
        
        const data = {
            exportTime: new Date().toISOString(),
            measurements: Array.from(this.measurements.values()),
            config: this.config.measurement
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `measurements_${Date.now()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        console.log('[Measurement] 측정 결과 내보내기 완료');
    }
    
    /**
     * 플러그인 비활성화
     */
    onDisable() {
        this.stopMeasurement();
    }
    
    /**
     * 정리
     */
    onDestroy() {
        // 이벤트 리스너 제거
        document.removeEventListener('keydown', this.onKeyDown);
        
        const canvas = this.context.sceneManager?.renderer?.domElement;
        if (canvas) {
            canvas.removeEventListener('click', this.onMouseClick);
            canvas.removeEventListener('mousemove', this.onMouseMove);
        }
        
        // 측정 그룹 제거
        if (this.measurementGroup.parent) {
            this.measurementGroup.parent.remove(this.measurementGroup);
        }
        
        // 리소스 정리
        this.clearAllMeasurements();
        this.controls.clear();
        this.measurements.clear();
        
        console.log('[Measurement] 측정 도구 정리 완료');
    }
}

export default MeasurementPlugin;