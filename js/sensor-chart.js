// js/sensor-chart.js - 완전히 새로운 센서 차트 매니저 (구조적 재설계)

import { SensorDataLoader } from './sensor-data-loader.js';

/**
 * 센서 차트 매니저 - 완전히 재설계된 버전
 * 
 * @class SensorChartManager
 * @description 옹벽 센서 데이터를 시각화하는 차트 시스템
 * 
 * 주요 기능:
 * - 실시간 센서 데이터 차트 표시
 * - 옹벽별 특성 반영 데이터 생성
 * - 애니메이션 동기화
 * - 안전한 에러 핸들링
 */
export class SensorChartManager {
    constructor() {
        // 상태 관리
        this.state = {
            isVisible: false,
            isAnimating: false,
            isInitialized: false,
            hasError: false,
            errorMessage: null
        };
        
        // 차트 인스턴스
        this.charts = new Map();
        this.container = null;
        
        // 데이터 관리
        this.dataLoader = new SensorDataLoader();
        this.precomputedData = null;
        this.currentModelName = null;
        
        // 애니메이션 제어
        this.animationId = null;
        this.animationCallbacks = new Set();
        
        // 설정
        this.config = {
            animation: {
                duration: 0,
                updateInterval: 100,
                batchSize: 3,
                skipFrames: 1
            },
            data: {
                maxDataPoints: 100,
                dangerThreshold: 0.8,
                warningThreshold: 0.5
            },
            ui: {
                autoHide: true,
                hideDelay: 5000
            }
        };
        
        // 옹벽별 특성
        this.modelCharacteristics = {
            'Block_Retaining_Wall': {
                name: '블록 옹벽',
                description: '블록 간 이음부 벌어짐 → 도미노식 붕괴',
                characteristics: {
                    initial: '미세한 진동 (블록 간 마찰)',
                    middle: '점진적 기울기 증가 (블록 이탈)',
                    final: '급격한 가속 (연쇄 붕괴)'
                },
                noise: 0.02,
                smoothness: 0.8
            },
            'Cantilever_Retaining_Wall': {
                name: '캔틸레버 옹벽',
                description: '하부 균열 → 전도/전단 파괴',
                characteristics: {
                    initial: '주기적 변동 (열팽창/수축)',
                    middle: '계단식 증가 (균열 진전)',
                    final: '갑작스런 전도 (구조 파괴)'
                },
                noise: 0.03,
                smoothness: 0.5
            },
            'mse_Retaining_Wall': {
                name: 'MSE 옹벽',
                description: '보강재 인장 → 급속 파단',
                characteristics: {
                    initial: '안정적 (보강재 하중 분산)',
                    middle: '선형 증가 (보강재 인장)',
                    final: '급속 붕괴 (보강재 파단)'
                },
                noise: 0.01,
                smoothness: 0.9
            }
        };
        
        // 바인딩
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        // 초기화
        this.init();
    }
    
    /**
     * 초기화
     * @returns {Promise<void>}
     */
    async init() {
        try {
            await this.createContainer();
            await this.setupEventListeners();
            this.state.isInitialized = true;
            console.log('✅ SensorChartManager 초기화 완료');
        } catch (error) {
            this.handleError('초기화 실패', error);
        }
    }
    
    /**
     * 컨테이너 생성
     * @returns {Promise<void>}
     */
    async createContainer() {
        // 기존 컨테이너 제거
        const existing = document.getElementById('sensor-chart-container');
        if (existing) {
            existing.remove();
        }
        
        // 새 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'sensor-chart-container';
        this.container.className = 'sensor-chart-container';
        
        // HTML 구조 생성
        this.container.innerHTML = `
            <div class="sensor-chart-header">
                <h3>센서 데이터 분석</h3>
                <div class="sensor-chart-status">
                    <div class="status-indicator" id="chart-status">정상</div>
                    <button class="sensor-chart-close" id="chart-close">×</button>
                </div>
            </div>
            <div class="sensor-chart-body">
                <div class="chart-grid">
                    <div class="chart-item">
                        <h4>기울기 X축</h4>
                        <canvas id="tilt-x-chart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h4>기울기 Y축</h4>
                        <canvas id="tilt-y-chart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h4>기울기 Z축</h4>
                        <canvas id="tilt-z-chart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h4>균열 폭</h4>
                        <canvas id="crack-chart"></canvas>
                    </div>
                </div>
                <div class="sensor-summary">
                    <div class="summary-item">
                        <span class="label">최대 기울기</span>
                        <span class="value" id="max-tilt">0.00°</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">균열 폭</span>
                        <span class="value" id="crack-width">0.0mm</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">현재 상태</span>
                        <span class="value" id="current-phase">정상</span>
                    </div>
                </div>
            </div>
        `;
        
        // 문서에 추가
        document.body.appendChild(this.container);
        
        // 차트 생성
        await this.createCharts();
    }
    
    /**
     * 차트 생성
     * @returns {Promise<void>}
     */
    async createCharts() {
        if (!window.Chart) {
            throw new Error('Chart.js가 로드되지 않았습니다');
        }
        
        const chartConfigs = [
            { id: 'tilt-x-chart', type: 'tilt', axis: 'x', color: '#ff6b35' },
            { id: 'tilt-y-chart', type: 'tilt', axis: 'y', color: '#00ff88' },
            { id: 'tilt-z-chart', type: 'tilt', axis: 'z', color: '#00d4ff' },
            { id: 'crack-chart', type: 'crack', axis: null, color: '#ff1744' }
        ];
        
        for (const config of chartConfigs) {
            const canvas = document.getElementById(config.id);
            if (!canvas) {
                console.warn(`캔버스를 찾을 수 없습니다: ${config.id}`);
                continue;
            }
            
            const chart = new Chart(canvas, this.createChartConfig(config));
            this.charts.set(config.id, {
                chart,
                type: config.type,
                axis: config.axis,
                color: config.color
            });
        }
        
        console.log(`✅ ${this.charts.size}개 차트 생성 완료`);
    }
    
    /**
     * 차트 설정 생성
     * @param {Object} config - 차트 설정
     * @returns {Object} Chart.js 설정 객체
     */
    createChartConfig(config) {
        const isTimeChart = config.type === 'tilt' || config.type === 'crack';
        
        return {
            type: 'line',
            data: {
                datasets: [{
                    label: this.getChartLabel(config),
                    data: [],
                    borderColor: config.color,
                    backgroundColor: config.color + '20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        type: isTimeChart ? 'linear' : 'category',
                        display: true,
                        title: {
                            display: true,
                            text: '시간 (초)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: this.getYAxisLabel(config),
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        };
    }
    
    /**
     * 차트 라벨 생성
     * @param {Object} config - 차트 설정
     * @returns {string} 차트 라벨
     */
    getChartLabel(config) {
        if (config.type === 'tilt') {
            return `기울기 ${config.axis.toUpperCase()}축`;
        } else if (config.type === 'crack') {
            return '균열 폭';
        }
        return '센서 데이터';
    }
    
    /**
     * Y축 라벨 생성
     * @param {Object} config - 차트 설정
     * @returns {string} Y축 라벨
     */
    getYAxisLabel(config) {
        if (config.type === 'tilt') {
            return '각도 (°)';
        } else if (config.type === 'crack') {
            return '폭 (mm)';
        }
        return '값';
    }
    
    /**
     * 이벤트 리스너 설정
     * @returns {Promise<void>}
     */
    async setupEventListeners() {
        // 닫기 버튼
        const closeBtn = document.getElementById('chart-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isVisible) {
                this.hide();
            }
        });
        
        // 브라우저 탭 변경 감지
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // 윈도우 리사이즈
        window.addEventListener('resize', this.handleResize);
        
        // 컨테이너 클릭 시 전파 방지
        if (this.container) {
            this.container.addEventListener('click', (e) => e.stopPropagation());
        }
    }
    
    /**
     * 시뮬레이션 시작
     * @param {number} startFrame - 시작 프레임
     * @param {number} maxFrame - 최대 프레임
     * @param {string} modelName - 모델명
     * @returns {Promise<void>}
     */
    async startSimulation(startFrame = 0, maxFrame = 30, modelName = 'Block_Retaining_Wall') {
        try {
            this.currentModelName = modelName;
            console.log(`📊 센서 시뮬레이션 시작: ${modelName} (${startFrame} → ${maxFrame})`);
            
            // 데이터 생성
            await this.generateData(maxFrame, modelName);
            
            // 차트 표시
            this.show();
            
            // 애니메이션 시작
            await this.animateToFrame(maxFrame);
            
        } catch (error) {
            this.handleError('시뮬레이션 시작 실패', error);
        }
    }
    
    /**
     * 데이터 생성
     * @param {number} maxFrame - 최대 프레임
     * @param {string} modelName - 모델명
     * @returns {Promise<void>}
     */
    async generateData(maxFrame, modelName) {
        try {
            const fps = 30;
            const dataset = [];
            const characteristics = this.modelCharacteristics[modelName] || this.modelCharacteristics['Block_Retaining_Wall'];
            
            for (let frame = 0; frame <= maxFrame; frame++) {
                const time = frame / fps;
                const progress = frame / maxFrame;
                
                // 옹벽별 특성 반영 데이터 생성
                const data = this.generateFrameData(frame, maxFrame, characteristics);
                data.time = time;
                data.frame = frame;
                
                dataset.push(data);
            }
            
            this.precomputedData = {
                modelName,
                data: dataset,
                maxFrame,
                fps
            };
            
            console.log(`✅ ${dataset.length}개 프레임 데이터 생성 완료`);
            
        } catch (error) {
            throw new Error(`데이터 생성 실패: ${error.message}`);
        }
    }
    
    /**
     * 프레임별 데이터 생성
     * @param {number} frame - 현재 프레임
     * @param {number} maxFrame - 최대 프레임
     * @param {Object} characteristics - 옹벽 특성
     * @returns {Object} 프레임 데이터
     */
    generateFrameData(frame, maxFrame, characteristics) {
        const progress = frame / maxFrame;
        const noise = characteristics.noise || 0.02;
        const smoothness = characteristics.smoothness || 0.8;
        
        // 기본 패턴
        let tiltBase = Math.pow(progress, 2) * 2;
        let crackBase = Math.pow(progress, 1.5) * 3;
        
        // 모델별 특성 적용
        if (characteristics.name.includes('블록')) {
            // 블록 옹벽: 계단식 증가
            tiltBase += Math.floor(progress * 5) * 0.3;
            crackBase += Math.floor(progress * 4) * 0.5;
        } else if (characteristics.name.includes('캔틸레버')) {
            // 캔틸레버: 급격한 변화
            tiltBase *= (progress > 0.7) ? 2 : 1;
            crackBase *= (progress > 0.8) ? 3 : 1;
        } else if (characteristics.name.includes('MSE')) {
            // MSE: 선형 증가 후 급격한 변화
            tiltBase = progress < 0.8 ? progress * 1.5 : progress * 4;
            crackBase = progress < 0.8 ? progress * 2 : progress * 5;
        }
        
        // 노이즈 추가
        const randomNoise = () => (Math.random() - 0.5) * noise;
        
        // 부드러움 적용
        const smooth = (value, target) => value * smoothness + target * (1 - smoothness);
        
        return {
            tilt: {
                x: smooth(tiltBase + randomNoise(), tiltBase),
                y: smooth(tiltBase * 0.8 + randomNoise(), tiltBase * 0.8),
                z: smooth(tiltBase * 0.6 + randomNoise(), tiltBase * 0.6)
            },
            crack: smooth(crackBase + randomNoise(), crackBase),
            phase: crackBase > 2.0 ? 'danger' : crackBase > 1.0 ? 'warning' : 'normal'
        };
    }
    
    /**
     * 특정 프레임까지 애니메이션
     * @param {number} targetFrame - 목표 프레임
     * @returns {Promise<void>}
     */
    async animateToFrame(targetFrame) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.precomputedData) {
                    throw new Error('미리 계산된 데이터가 없습니다');
                }
                
                const dataset = this.precomputedData.data;
                const maxIndex = Math.min(targetFrame, dataset.length - 1);
                
                let currentIndex = 0;
                this.state.isAnimating = true;
                
                const updateCharts = () => {
                    try {
                        if (!this.state.isAnimating || currentIndex > maxIndex) {
                            this.state.isAnimating = false;
                            this.updateSummary(maxIndex);
                            resolve();
                            return;
                        }
                        
                        // 배치 처리
                        const endIndex = Math.min(currentIndex + this.config.animation.batchSize, maxIndex + 1);
                        
                        for (let i = currentIndex; i < endIndex; i++) {
                            if (i < dataset.length) {
                                this.addDataPoint(dataset[i]);
                            }
                        }
                        
                        currentIndex = endIndex;
                        
                        if (this.state.isAnimating) {
                            this.animationId = setTimeout(updateCharts, this.config.animation.updateInterval);
                        }
                        
                    } catch (error) {
                        this.state.isAnimating = false;
                        reject(error);
                    }
                };
                
                updateCharts();
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 데이터 포인트 추가
     * @param {Object} frameData - 프레임 데이터
     */
    addDataPoint(frameData) {
        try {
            this.charts.forEach((chartInfo, chartId) => {
                const { chart, type, axis } = chartInfo;
                let value;
                
                if (type === 'tilt' && axis && frameData.tilt) {
                    value = frameData.tilt[axis];
                } else if (type === 'crack') {
                    value = frameData.crack;
                } else {
                    return;
                }
                
                // 데이터 포인트 추가
                const dataPoint = { x: frameData.time, y: value };
                chart.data.datasets[0].data.push(dataPoint);
                
                // 최대 데이터 포인트 제한
                if (chart.data.datasets[0].data.length > this.config.data.maxDataPoints) {
                    chart.data.datasets[0].data.shift();
                }
                
                // 차트 업데이트
                chart.update('none');
            });
            
            // 요약 정보 업데이트
            this.updateSummaryFromData(frameData);
            
        } catch (error) {
            console.error('데이터 포인트 추가 오류:', error);
        }
    }
    
    /**
     * 요약 정보 업데이트 (프레임 인덱스 기반)
     * @param {number} frameIndex - 프레임 인덱스
     */
    updateSummary(frameIndex) {
        try {
            if (!this.precomputedData || !this.precomputedData.data) {
                console.warn('미리 계산된 데이터가 없습니다');
                return;
            }
            
            const dataset = this.precomputedData.data;
            if (frameIndex >= 0 && frameIndex < dataset.length) {
                this.updateSummaryFromData(dataset[frameIndex]);
            }
        } catch (error) {
            console.error('요약 업데이트 오류:', error);
        }
    }
    
    /**
     * 요약 정보 업데이트 (데이터 기반)
     * @param {Object} frameData - 프레임 데이터
     */
    updateSummaryFromData(frameData) {
        try {
            if (!frameData) return;
            
            // 최대 기울기 계산
            const maxTilt = Math.max(
                Math.abs(frameData.tilt?.x || 0),
                Math.abs(frameData.tilt?.y || 0),
                Math.abs(frameData.tilt?.z || 0)
            );
            
            // UI 요소 업데이트
            this.updateElement('max-tilt', `${maxTilt.toFixed(2)}°`, maxTilt > this.config.data.dangerThreshold);
            this.updateElement('crack-width', `${(frameData.crack || 0).toFixed(1)}mm`, frameData.crack > 2.0);
            this.updateElement('current-phase', this.getPhaseText(frameData.phase), frameData.phase === 'danger');
            
            // 상태 표시기 업데이트
            this.updateStatusIndicator(frameData.phase);
            
        } catch (error) {
            console.error('요약 데이터 업데이트 오류:', error);
        }
    }
    
    /**
     * UI 요소 업데이트
     * @param {string} id - 요소 ID
     * @param {string} text - 표시할 텍스트
     * @param {boolean} isDanger - 위험 상태 여부
     */
    updateElement(id, text, isDanger = false) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
            element.className = isDanger ? 'value danger' : 'value';
        }
    }
    
    /**
     * 상태 텍스트 생성
     * @param {string} phase - 상태
     * @returns {string} 상태 텍스트
     */
    getPhaseText(phase) {
        const phaseMap = {
            'normal': '정상',
            'warning': '경고',
            'danger': '위험'
        };
        return phaseMap[phase] || '정상';
    }
    
    /**
     * 상태 표시기 업데이트
     * @param {string} phase - 상태
     */
    updateStatusIndicator(phase) {
        const indicator = document.getElementById('chart-status');
        if (indicator) {
            indicator.textContent = this.getPhaseText(phase);
            indicator.className = `status-indicator ${phase || 'normal'}`;
        }
    }
    
    /**
     * 차트 표시
     */
    show() {
        try {
            if (this.container) {
                this.container.classList.add('show');
                this.state.isVisible = true;
                console.log('📊 센서 차트 표시');
                
                // 리사이즈 이벤트 발생 (차트 크기 조정)
                setTimeout(() => this.handleResize(), 100);
            }
        } catch (error) {
            this.handleError('차트 표시 실패', error);
        }
    }
    
    /**
     * 차트 숨기기
     */
    hide() {
        try {
            if (this.container) {
                this.container.classList.remove('show');
                this.state.isVisible = false;
                this.stopAnimation();
                console.log('📊 센서 차트 숨김');
            }
        } catch (error) {
            this.handleError('차트 숨기기 실패', error);
        }
    }
    
    /**
     * 애니메이션 중단
     */
    stopAnimation() {
        try {
            this.state.isAnimating = false;
            if (this.animationId) {
                clearTimeout(this.animationId);
                this.animationId = null;
            }
        } catch (error) {
            console.error('애니메이션 중단 오류:', error);
        }
    }
    
    /**
     * 차트 초기화
     */
    clearCharts() {
        try {
            this.charts.forEach(({ chart }) => {
                if (chart && chart.data && chart.data.datasets[0]) {
                    chart.data.datasets[0].data = [];
                    chart.update('none');
                }
            });
            console.log('📊 차트 데이터 초기화');
        } catch (error) {
            console.error('차트 초기화 오류:', error);
        }
    }
    
    /**
     * 가시성 상태 확인 (메서드 버전)
     * @returns {boolean} 가시성 상태
     */
    isVisible() {
        return this.state.isVisible;
    }
    
    /**
     * 애니메이션과 동기화
     * @param {Object} animationController - 애니메이션 컨트롤러
     */
    syncWithAnimation(animationController) {
        try {
            if (!animationController) {
                console.warn('애니메이션 컨트롤러가 없습니다');
                return;
            }
            
            console.log('📊 애니메이션과 동기화 시작');
            
            // 애니메이션 상태에 따라 차트 업데이트
            // 실제 구현은 animationController의 인터페이스에 따라 달라짐
            
        } catch (error) {
            this.handleError('애니메이션 동기화 실패', error);
        }
    }
    
    /**
     * 리사이즈 처리
     */
    handleResize() {
        try {
            if (this.state.isVisible) {
                this.charts.forEach(({ chart }) => {
                    if (chart && typeof chart.resize === 'function') {
                        chart.resize();
                    }
                });
            }
        } catch (error) {
            console.error('리사이즈 처리 오류:', error);
        }
    }
    
    /**
     * 브라우저 탭 변경 처리
     */
    handleVisibilityChange() {
        try {
            if (document.hidden && this.state.isAnimating) {
                this.stopAnimation();
            }
        } catch (error) {
            console.error('가시성 변경 처리 오류:', error);
        }
    }
    
    /**
     * 에러 처리
     * @param {string} message - 에러 메시지
     * @param {Error} error - 에러 객체
     */
    handleError(message, error = null) {
        this.state.hasError = true;
        this.state.errorMessage = error ? error.message : message;
        
        console.error(`📊 SensorChartManager 오류: ${message}`, error);
        
        // 애니메이션 중단
        this.stopAnimation();
        
        // 에러 상태 UI 업데이트
        const indicator = document.getElementById('chart-status');
        if (indicator) {
            indicator.textContent = '오류';
            indicator.className = 'status-indicator danger';
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        try {
            console.log('🔚 SensorChartManager 정리 시작');
            
            // 애니메이션 중단
            this.stopAnimation();
            
            // 이벤트 리스너 제거
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            window.removeEventListener('resize', this.handleResize);
            
            // 차트 정리
            this.charts.forEach(({ chart }) => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            this.charts.clear();
            
            // 컨테이너 제거
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            
            // 상태 초기화
            this.state = {
                isVisible: false,
                isAnimating: false,
                isInitialized: false,
                hasError: false,
                errorMessage: null
            };
            
            console.log('✅ SensorChartManager 정리 완료');
            
        } catch (error) {
            console.error('정리 중 오류:', error);
        }
    }
    
    /**
     * 현재 상태 정보 반환 (디버깅용)
     * @returns {Object} 상태 정보
     */
    getStatus() {
        return {
            ...this.state,
            chartsCount: this.charts.size,
            hasData: !!this.precomputedData,
            currentModel: this.currentModelName
        };
    }
}