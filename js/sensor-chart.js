// js/sensor-chart.js - 센서 데이터 차트 표시 모듈 (옹벽별 특성 반영)

import { SensorDataLoader } from './sensor-data-loader.js';

export class SensorChartManager {
    constructor() {
        this.charts = [];
        this.isVisible = false;
        this.isAnimating = false;
        this.container = null;
        this.dataLoader = new SensorDataLoader();
        this.precomputedData = null;
        this.currentModelName = null;
        
        // 차트 설정
        this.chartConfig = {
            animationDuration: 0,
            maxDataPoints: 100,  // 더 많은 데이터 포인트
            updateInterval: 100,  // 100ms (초당 10회)
            batchSize: 3,
            skipFrames: 1,  // 모든 프레임 사용
            dangerThreshold: 0.8,
            warningThreshold: 0.5
        };
        
        // 옹벽별 특성 설정
        this.modelCharacteristics = {
            'Block_Retaining_Wall': {
                name: '블록 옹벽',
                description: '블록 간 이음부 벌어짐 → 도미노식 붕괴',
                characteristics: {
                    initial: '미세한 진동 (블록 간 마찰)',
                    middle: '점진적 기울기 증가 (블록 이탈)',
                    final: '급격한 가속 (연쇄 붕괴)'
                },
                noise: 0.02,  // 초기 노이즈 레벨
                smoothness: 0.8  // 부드러운 변화
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
                smoothness: 0.5  // 계단식 변화
            },
            'mse_Retaining_Wall': {
                name: 'MSE 옹벽',
                description: '보강재 인장 → 급속 파단',
                characteristics: {
                    initial: '안정적 (보강재 하중 분산)',
                    middle: '선형 증가 (보강재 인장)',
                    final: '급속 붕괴 (보강재 파단)'
                },
                noise: 0.01,  // 낮은 노이즈
                smoothness: 0.9  // 매우 부드러운 변화
            }
        };
        
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        this.createContainer();
        this.createCharts();
        console.log('✅ SensorChartManager 초기화 완료');
    }
    
    /**
     * 컨테이너 생성
     */
    createContainer() {
        // 기존 컨테이너 제거
        const existing = document.getElementById('sensor-chart-container');
        if (existing) existing.remove();
        
        // 새 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'sensor-chart-container';
        this.container.className = 'sensor-chart-container';
        
        this.container.innerHTML = `
            <div class="sensor-chart-header">
                <h3>센서 모니터링 - <span id="model-name">모델</span></h3>
                <div class="sensor-chart-status">
                    <span class="status-indicator danger">위험 감지</span>
                    <button class="sensor-chart-close">×</button>
                </div>
            </div>
            <div class="sensor-chart-body">
                <div class="model-info" id="model-info">
                    <h4>옹벽 특성</h4>
                    <p id="model-description"></p>
                    <div class="characteristics-grid">
                        <div class="char-item">
                            <span class="char-label">초기:</span>
                            <span class="char-value" id="char-initial"></span>
                        </div>
                        <div class="char-item">
                            <span class="char-label">중기:</span>
                            <span class="char-value" id="char-middle"></span>
                        </div>
                        <div class="char-item">
                            <span class="char-label">말기:</span>
                            <span class="char-value" id="char-final"></span>
                        </div>
                    </div>
                </div>
                <div class="chart-grid">
                    <div class="chart-item">
                        <h4>기울기 센서 - X축</h4>
                        <canvas id="tilt-x-chart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h4>기울기 센서 - Y축</h4>
                        <canvas id="tilt-y-chart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h4>기울기 센서 - Z축</h4>
                        <canvas id="tilt-z-chart"></canvas>
                    </div>
                    <div class="chart-item">
                        <h4>균열 센서</h4>
                        <canvas id="crack-chart"></canvas>
                    </div>
                </div>
                <div class="sensor-summary">
                    <div class="summary-item">
                        <span class="label">현재 프레임:</span>
                        <span class="value" id="current-frame">0</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">최대 기울기:</span>
                        <span class="value danger" id="max-tilt">0.00°</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">균열 폭:</span>
                        <span class="value danger" id="crack-width">0.00mm</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">상태:</span>
                        <span class="value" id="current-phase">정상</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // 스타일 추가
        this.addAdditionalStyles();
        
        // 닫기 버튼 이벤트
        const closeBtn = this.container.querySelector('.sensor-chart-close');
        closeBtn.addEventListener('click', () => this.hide());
    }
    
    /**
     * 추가 스타일
     */
    addAdditionalStyles() {
        if (document.getElementById('sensor-chart-enhanced-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sensor-chart-enhanced-styles';
        style.textContent = `
            .model-info {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .model-info h4 {
                margin: 0 0 8px 0;
                color: #007bff;
                font-size: 14px;
            }
            
            .model-info p {
                margin: 0 0 12px 0;
                color: rgba(255, 255, 255, 0.7);
                font-size: 13px;
            }
            
            .characteristics-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
            }
            
            .char-item {
                background: rgba(0, 0, 0, 0.3);
                padding: 8px;
                border-radius: 6px;
                font-size: 12px;
            }
            
            .char-label {
                display: block;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 4px;
            }
            
            .char-value {
                display: block;
                color: rgba(255, 255, 255, 0.9);
                font-size: 11px;
                line-height: 1.3;
            }
            
            #model-name {
                color: #00ff88;
                font-weight: 600;
            }
            
            @media (max-width: 768px) {
                .characteristics-grid {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 차트 생성
     */
    createCharts() {
        // 기존 차트 제거
        this.charts.forEach(({ chart }) => {
            chart.destroy();
        });
        this.charts = [];
        
        // Chart.js 기본 설정
        Chart.defaults.color = 'rgba(255, 255, 255, 0.8)';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
        
        // 기울기 차트들
        this.createTiltChart('tilt-x-chart', 'X축 기울기', '#00ff88', 'x');
        this.createTiltChart('tilt-y-chart', 'Y축 기울기', '#00b4d8', 'y');
        this.createTiltChart('tilt-z-chart', 'Z축 기울기', '#ff6b35', 'z');
        
        // 균열 차트
        this.createCrackChart();
    }
    
    /**
     * 기울기 차트 생성
     */
    createTiltChart(canvasId, label, color, axis) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(3)}°`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: '시간 (초)'
                        },
                        min: 0,
                        max: 1,
                        ticks: {
                            stepSize: 0.5,
                            callback: (value) => value.toFixed(1)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '기울기 (도)'
                        },
                        min: -2.5,
                        max: 2.5,
                        ticks: { stepSize: 0.5 },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
        
        this.charts.push({ chart, axis, type: 'tilt' });
    }
    
    /**
     * 균열 차트 생성
     */
    createCrackChart() {
        const ctx = document.getElementById('crack-chart');
        if (!ctx) return;
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '균열 폭',
                    data: [],
                    borderColor: '#ff1744',
                    backgroundColor: '#ff174420',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(2)}mm`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: '시간 (초)'
                        },
                        min: 0,
                        max: 1,
                        ticks: {
                            stepSize: 0.5,
                            callback: (value) => value.toFixed(1)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '균열 폭 (mm)'
                        },
                        min: 0,
                        max: 4,
                        ticks: { stepSize: 0.5 },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
        
        this.charts.push({ chart, type: 'crack' });
    }
    
    /**
     * 시뮬레이션 시작 (옹벽별 특성 반영)
     */
    async startSimulation(currentFrame = 0, maxFrame = 30, modelName = 'Default') {
        console.log(`🎬 센서 시뮬레이션 시작 (프레임: ${currentFrame}/${maxFrame}, 모델: ${modelName})`);
        
        // 기존 애니메이션 중단
        this.stopAnimation();
        
        // 모델명 저장
        this.currentModelName = modelName;
        
        // 모델 정보 업데이트
        this.updateModelInfo(modelName);
        
        // 데이터 로드
        if (!this.dataLoader.dataCache) {
            await this.dataLoader.loadData();
        }
        
        // 센서 모드는 최대 30프레임까지만 표시
        const sensorMaxFrame = Math.min(maxFrame, 30);
        
        // 옹벽별 특성을 반영한 데이터 생성
        this.precomputedData = {
            modelName: modelName,
            data: await this.generateCharacteristicData(modelName, sensorMaxFrame)
        };
        
        console.log('📊 생성된 데이터 확인:', {
            frames: this.precomputedData.data.length,
            firstFrame: this.precomputedData.data[0],
            lastFrame: this.precomputedData.data[this.precomputedData.data.length - 1]
        });
        
        // 차트 초기화
        this.clearCharts();
        
        // 애니메이션 시작 - currentFrame이 0이면 처음부터, 아니면 해당 프레임까지 빠르게 진행
        const targetFrame = Math.min(currentFrame, sensorMaxFrame);
        
        if (targetFrame === 0) {
            this.animateWithPrecomputedData(sensorMaxFrame);
        } else {
            // 현재 프레임까지의 데이터를 즉시 표시
            this.showDataUpToFrame(targetFrame);
            // 이후 애니메이션 계속 (필요한 경우)
            if (targetFrame < sensorMaxFrame) {
                this.animateFromFrame(targetFrame, sensorMaxFrame);
            }
        }
    }
    
    /**
     * 특정 프레임까지의 데이터를 즉시 표시
     */
    showDataUpToFrame(targetFrame) {
        const dataset = this.precomputedData.data;
        if (!dataset || dataset.length === 0) return;
        
        const chartData = {
            tilt: { x: [], y: [], z: [] },
            crack: []
        };
        
        // targetFrame까지의 모든 데이터를 차트에 추가
        for (let i = 0; i <= targetFrame && i < dataset.length; i++) {
            const frame = dataset[i];
            
            // 최대 데이터 포인트 체크
            if (chartData.crack.length >= this.chartConfig.maxDataPoints) {
                ['x', 'y', 'z'].forEach(axis => chartData.tilt[axis].shift());
                chartData.crack.shift();
            }
            
            chartData.tilt.x.push({ x: frame.time, y: frame.tilt.x });
            chartData.tilt.y.push({ x: frame.time, y: frame.tilt.y });
            chartData.tilt.z.push({ x: frame.time, y: frame.tilt.z });
            chartData.crack.push({ x: frame.time, y: frame.crack });
        }
        
        // 차트 업데이트
        this.updateChartsDirectly(chartData);
        
        // 요약 업데이트
        if (dataset[targetFrame]) {
            this.updateSummaryFromData(dataset[targetFrame]);
        }
    }
    
    /**
     * 특정 프레임부터 애니메이션 시작
     */
    animateFromFrame(startFrame, maxFrame) {
        const dataset = this.precomputedData.data;
        if (!dataset || dataset.length === 0) return;
        
        let currentIndex = startFrame + 1;
        const maxIndex = Math.min(maxFrame, dataset.length - 1);
        this.isAnimating = true;
        
        // 현재 차트 데이터 구성
        const chartData = {
            tilt: { x: [], y: [], z: [] },
            crack: []
        };
        
        // startFrame까지의 데이터로 초기화
        for (let i = Math.max(0, startFrame - this.chartConfig.maxDataPoints + 1); i <= startFrame && i < dataset.length; i++) {
            const frame = dataset[i];
            chartData.tilt.x.push({ x: frame.time, y: frame.tilt.x });
            chartData.tilt.y.push({ x: frame.time, y: frame.tilt.y });
            chartData.tilt.z.push({ x: frame.time, y: frame.tilt.z });
            chartData.crack.push({ x: frame.time, y: frame.crack });
        }
        
        const updateCharts = () => {
            if (!this.isAnimating || currentIndex > maxIndex) {
                this.updateSummary(maxIndex);
                this.isAnimating = false;
                return;
            }
            
            const endIndex = Math.min(currentIndex + this.chartConfig.batchSize, maxIndex + 1);
            
            for (let i = currentIndex; i < endIndex; i += this.chartConfig.skipFrames) {
                const frame = dataset[i];
                if (!frame) continue;
                
                if (chartData.crack.length >= this.chartConfig.maxDataPoints) {
                    ['x', 'y', 'z'].forEach(axis => chartData.tilt[axis].shift());
                    chartData.crack.shift();
                }
                
                chartData.tilt.x.push({ x: frame.time, y: frame.tilt.x });
                chartData.tilt.y.push({ x: frame.time, y: frame.tilt.y });
                chartData.tilt.z.push({ x: frame.time, y: frame.tilt.z });
                chartData.crack.push({ x: frame.time, y: frame.crack });
            }
            
            this.updateChartsDirectly(chartData);
            
            if (dataset[endIndex - 1]) {
                this.updateSummaryFromData(dataset[endIndex - 1]);
            }
            
            currentIndex = endIndex;
            
            if (this.isAnimating) {
                setTimeout(updateCharts, this.chartConfig.updateInterval);
            }
        };
        
        updateCharts();
    }
    
    /**
     * 모델 정보 업데이트
     */
    updateModelInfo(modelName) {
        const characteristics = this.modelCharacteristics[modelName];
        if (!characteristics) return;
        
        // 모델명
        const modelNameEl = document.getElementById('model-name');
        if (modelNameEl) {
            modelNameEl.textContent = characteristics.name;
        }
        
        // 설명
        const descEl = document.getElementById('model-description');
        if (descEl) {
            descEl.textContent = characteristics.description;
        }
        
        // 특성
        const charInitial = document.getElementById('char-initial');
        if (charInitial) {
            charInitial.textContent = characteristics.characteristics.initial;
        }
        
        const charMiddle = document.getElementById('char-middle');
        if (charMiddle) {
            charMiddle.textContent = characteristics.characteristics.middle;
        }
        
        const charFinal = document.getElementById('char-final');
        if (charFinal) {
            charFinal.textContent = characteristics.characteristics.final;
        }
    }
    
    /**
     * 옹벽 특성을 반영한 데이터 생성
     */
    async generateCharacteristicData(modelName, maxFrame) {
        const modelData = this.dataLoader.dataCache?.[modelName];
        const characteristics = this.modelCharacteristics[modelName];
        
        if (!modelData || !characteristics) {
            return this.generateDefaultDataset(maxFrame);
        }
        
        const fps = modelData.fps || 30;
        const dataset = [];
        
        // 시나리오 전환점
        const normalEnd = 15;
        const warningEnd = 23;
        
        for (let frame = 0; frame <= maxFrame; frame++) {
            const time = frame / fps;
            let phase = 'normal';
            
            // 시나리오 결정
            let scenario;
            if (frame < normalEnd) {
                scenario = modelData.scenarios.normal;
                phase = 'normal';
            } else if (frame < warningEnd) {
                scenario = modelData.scenarios.warning;
                phase = 'warning';
            } else {
                scenario = modelData.scenarios.danger;
                phase = 'danger';
            }
            
            // 옹벽별 특성 적용
            let data;
            switch (modelName) {
                case 'Block_Retaining_Wall':
                    // 블록 옹벽: 점진적 S자 곡선
                    data = this.generateBlockWallData(frame, maxFrame, scenario, characteristics);
                    break;
                    
                case 'Cantilever_Retaining_Wall':
                    // 캔틸레버: 진동 → 계단식 → 급상승
                    data = this.generateCantileverData(frame, maxFrame, scenario, characteristics);
                    break;
                    
                case 'mse_Retaining_Wall':
                    // MSE: 선형 → 급붕괴
                    data = this.generateMSEData(frame, maxFrame, scenario, characteristics);
                    break;
                    
                default:
                    // 기본 패턴
                    data = this.generateDefaultPattern(frame, maxFrame, scenario);
            }
            
            // 완전한 frameData 구성
            const frameData = {
                frame: frame,
                time: time,
                tilt: {
                    x: data.tilt?.x || 0,
                    y: data.tilt?.y || 0,
                    z: data.tilt?.z || 0
                },
                crack: data.crack || 0,
                phase: phase
            };
            
            dataset.push(frameData);
        }
        
        console.log(`📊 ${modelName} 데이터셋 생성 완료:`, dataset.length, '프레임');
        return dataset;
    }
    
    /**
     * 블록 옹벽 데이터 생성
     */
    generateBlockWallData(frame, maxFrame, scenario, characteristics) {
        const progress = frame / maxFrame;
        const data = { tilt: {}, crack: 0 };
        
        if (frame < 15) {
            // 초기: 미세한 진동
            data.tilt.x = Math.sin(frame * 0.5) * 0.05 + this.randomNoise(characteristics.noise);
            data.tilt.y = Math.cos(frame * 0.3) * 0.03 + this.randomNoise(characteristics.noise);
            data.tilt.z = Math.sin(frame * 0.4) * 0.02 + this.randomNoise(characteristics.noise);
            data.crack = Math.abs(this.randomNoise(0.05));
        } else if (frame < 23) {
            // 중기: 점진적 증가 (S자 곡선)
            const midProgress = (frame - 15) / 8;
            const sCurve = this.sigmoidCurve(midProgress);
            data.tilt.x = 0.05 + sCurve * 0.45;
            data.tilt.y = 0.03 + sCurve * 0.35;
            data.tilt.z = 0.02 + sCurve * 0.25;
            data.crack = sCurve * 0.8 + this.randomNoise(0.05);
        } else {
            // 말기: 지수적 증가
            const finalProgress = (frame - 23) / 7;
            const expValue = Math.pow(finalProgress, 1.5);
            data.tilt.x = 0.5 + expValue * 0.8;
            data.tilt.y = 0.38 + expValue * 0.6;
            data.tilt.z = 0.27 + expValue * 0.45;
            data.crack = 0.8 + expValue * 1.5;
        }
        
        return data;
    }
    
    /**
     * 캔틸레버 옹벽 데이터 생성
     */
    generateCantileverData(frame, maxFrame, scenario, characteristics) {
        const data = { tilt: {}, crack: 0 };
        
        if (frame < 10) {
            // 10프레임 전까지는 대기 상태
            data.tilt.x = this.randomNoise(0.01);
            data.tilt.y = this.randomNoise(0.01);
            data.tilt.z = this.randomNoise(0.01);
            data.crack = 0;
        } else if (frame < 18) {
            // 초기: 주기적 진동 (10-18프레임)
            const normalizedFrame = (frame - 10) / 8;
            data.tilt.x = Math.sin(normalizedFrame * Math.PI * 2) * 0.08 + this.randomNoise(characteristics.noise);
            data.tilt.y = Math.cos(normalizedFrame * Math.PI * 1.5) * 0.06 + this.randomNoise(characteristics.noise);
            data.tilt.z = Math.sin(normalizedFrame * Math.PI * 1.8) * 0.04 + this.randomNoise(characteristics.noise);
            data.crack = Math.abs(Math.sin(normalizedFrame * Math.PI) * 0.15);
        } else if (frame < 25) {
            // 중기: 계단식 증가 (18-25프레임)
            const midProgress = (frame - 18) / 7;
            const steps = Math.floor(midProgress * 4);
            const stepValue = steps * 0.15;
            data.tilt.x = 0.1 + stepValue + Math.sin(frame * 0.3) * 0.05;
            data.tilt.y = 0.08 + stepValue * 0.8 + Math.cos(frame * 0.2) * 0.04;
            data.tilt.z = 0.05 + stepValue * 0.6 + this.randomNoise(characteristics.noise);
            data.crack = 0.2 + stepValue * 1.2;
        } else {
            // 말기: 급격한 전도 (25-30프레임)
            const finalProgress = (frame - 25) / 5;
            // 28프레임 이후 급격한 상승
            const suddenSpike = frame >= 28 ? Math.pow((frame - 28) / 2, 2) : 0;
            data.tilt.x = 0.7 + finalProgress * 0.3 + suddenSpike * 0.5;
            data.tilt.y = 0.56 + finalProgress * 0.25 + suddenSpike * 0.4;
            data.tilt.z = 0.41 + finalProgress * 0.2 + suddenSpike * 0.3;
            data.crack = 1.3 + finalProgress * 0.5 + suddenSpike * 0.8;
        }
        
        return data;
    }
    
    /**
     * MSE 옹벽 데이터 생성
     */
    generateMSEData(frame, maxFrame, scenario, characteristics) {
        const data = { tilt: {}, crack: 0 };
        
        if (frame < 10) {
            // 초기: 매우 안정적
            data.tilt.x = this.randomNoise(characteristics.noise);
            data.tilt.y = this.randomNoise(characteristics.noise);
            data.tilt.z = this.randomNoise(characteristics.noise * 0.5);
            data.crack = this.randomNoise(0.02);
        } else if (frame < 15) {
            // 중기: 선형 증가 시작
            const midProgress = (frame - 10) / 5;
            data.tilt.x = midProgress * 0.3 + this.randomNoise(characteristics.noise);
            data.tilt.y = midProgress * 0.25 + this.randomNoise(characteristics.noise);
            data.tilt.z = midProgress * 0.2 + this.randomNoise(characteristics.noise);
            data.crack = midProgress * 0.8;
        } else {
            // 말기: 급속 파단
            const finalProgress = (frame - 15) / 15;
            
            // 20프레임에서 급격한 변화
            const breakPoint = frame >= 20 ? Math.pow((frame - 20) / 10, 2) * 3 : 0;
            
            data.tilt.x = 0.3 + finalProgress * 0.7 + breakPoint;
            data.tilt.y = 0.25 + finalProgress * 0.6 + breakPoint * 0.8;
            data.tilt.z = 0.2 + finalProgress * 0.5 + breakPoint * 0.6;
            data.crack = 0.8 + finalProgress * 1.2 + breakPoint * 1.5;
        }
        
        return data;
    }
    
    /**
     * 기본 패턴 생성
     */
    generateDefaultPattern(frame, maxFrame, scenario) {
        const progress = frame / maxFrame;
        const data = { tilt: {}, crack: 0 };
        
        data.tilt.x = Math.sin(progress * Math.PI) * 1.5;
        data.tilt.y = Math.sin(progress * Math.PI * 0.8) * 1.2;
        data.tilt.z = Math.sin(progress * Math.PI * 0.6) * 0.9;
        data.crack = progress * progress * 3;
        
        return data;
    }
    
    /**
     * 시그모이드 곡선 (S자 곡선)
     */
    sigmoidCurve(x) {
        return 1 / (1 + Math.exp(-10 * (x - 0.5)));
    }
    
    /**
     * 랜덤 노이즈 생성
     */
    randomNoise(amplitude) {
        return (Math.random() - 0.5) * 2 * amplitude;
    }
    
    /**
     * 미리 계산된 데이터로 애니메이션
     */
    animateWithPrecomputedData(targetFrame) {
        const dataset = this.precomputedData.data;
        if (!dataset || dataset.length === 0) return;
        
        let currentIndex = 0;
        const maxIndex = Math.min(targetFrame, dataset.length - 1);
        this.isAnimating = true;
        
        const chartData = {
            tilt: { x: [], y: [], z: [] },
            crack: []
        };
        
        const updateCharts = () => {
            if (!this.isAnimating || currentIndex > maxIndex) {
                this.updateSummary(maxIndex);
                this.isAnimating = false;
                return;
            }
            
            const endIndex = Math.min(currentIndex + this.chartConfig.batchSize, maxIndex + 1);
            
            for (let i = currentIndex; i < endIndex; i += this.chartConfig.skipFrames) {
                const frame = dataset[i];
                if (!frame) continue;
                
                if (chartData.crack.length >= this.chartConfig.maxDataPoints) {
                    ['x', 'y', 'z'].forEach(axis => chartData.tilt[axis].shift());
                    chartData.crack.shift();
                }
                
                chartData.tilt.x.push({ x: frame.time, y: frame.tilt.x });
                chartData.tilt.y.push({ x: frame.time, y: frame.tilt.y });
                chartData.tilt.z.push({ x: frame.time, y: frame.tilt.z });
                chartData.crack.push({ x: frame.time, y: frame.crack });
            }
            
            this.updateChartsDirectly(chartData);
            
            if (dataset[endIndex - 1]) {
                this.updateSummaryFromData(dataset[endIndex - 1]);
            }
            
            currentIndex = endIndex;
            
            if (this.isAnimating) {
                setTimeout(updateCharts, this.chartConfig.updateInterval);
            }
        };
        
        updateCharts();
    }
    
    /**
     * 차트 직접 업데이트
     */
    updateChartsDirectly(data) {
        // 디버깅: 데이터 확인
        if (data.tilt.x.length > 0) {
            console.log('📈 차트 업데이트:', {
                dataPoints: data.tilt.x.length,
                firstTime: data.tilt.x[0].x.toFixed(2),
                lastTime: data.tilt.x[data.tilt.x.length - 1].x.toFixed(2),
                maxTiltX: Math.max(...data.tilt.x.map(d => Math.abs(d.y))).toFixed(3)
            });
        }
        
        this.charts.forEach(({ chart, axis, type }) => {
            if (type === 'tilt' && data.tilt[axis]) {
                const chartData = data.tilt[axis];
                chart.data.labels = chartData.map(d => d.x);
                chart.data.datasets[0].data = chartData.map(d => d.y);
                
                // x축 범위 동적 조정
                if (chartData.length > 0) {
                    const minX = Math.floor(chartData[0].x * 2) / 2;
                    const maxX = Math.ceil(chartData[chartData.length - 1].x * 2) / 2;
                    chart.options.scales.x.min = minX;
                    chart.options.scales.x.max = maxX;
                }
            } else if (type === 'crack' && data.crack) {
                const chartData = data.crack;
                chart.data.labels = chartData.map(d => d.x);
                chart.data.datasets[0].data = chartData.map(d => d.y);
                
                // x축 범위 동적 조정
                if (chartData.length > 0) {
                    const minX = Math.floor(chartData[0].x * 2) / 2;
                    const maxX = Math.ceil(chartData[chartData.length - 1].x * 2) / 2;
                    chart.options.scales.x.min = minX;
                    chart.options.scales.x.max = maxX;
                }
            }
            
            chart.update('none');
        });
    }
    
    /**
     * 데이터 기반 요약 업데이트
     */
    updateSummaryFromData(frameData) {
        // 현재 프레임
        const frameEl = document.getElementById('current-frame');
        if (frameEl) {
            frameEl.textContent = frameData.frame;
        }
        
        // 최대 기울기
        const maxTiltEl = document.getElementById('max-tilt');
        if (maxTiltEl) {
            const maxTilt = Math.max(
                Math.abs(frameData.tilt.x),
                Math.abs(frameData.tilt.y),
                Math.abs(frameData.tilt.z)
            );
            maxTiltEl.textContent = maxTilt.toFixed(2) + '°';
            maxTiltEl.className = maxTilt > 0.8 ? 'value danger' : maxTilt > 0.5 ? 'value warning' : 'value';
        }
        
        // 균열 폭
        const crackEl = document.getElementById('crack-width');
        if (crackEl) {
            const crackWidth = frameData.crack;
            crackEl.textContent = crackWidth.toFixed(2) + 'mm';
            crackEl.className = crackWidth > 2.0 ? 'value danger' : crackWidth > 1.0 ? 'value warning' : 'value';
        }
        
        // 상태
        const phaseEl = document.getElementById('current-phase');
        if (phaseEl && frameData.phase) {
            let phaseText = '정상';
            let phaseClass = 'value';
            
            if (frameData.phase === 'warning') {
                phaseText = '경고';
                phaseClass = 'value warning';
            } else if (frameData.phase === 'danger') {
                phaseText = '위험';
                phaseClass = 'value danger';
            }
            
            phaseEl.textContent = phaseText;
            phaseEl.className = phaseClass;
        }
    }
    
    /**
     * 기본 데이터셋 생성 (폴백)
     */
    async generateDefaultDataset(maxFrame) {
        const fps = 30;
        const dataset = [];
        
        for (let frame = 0; frame <= maxFrame; frame++) {
            const time = frame / fps;
            const progress = frame / maxFrame;
            
            dataset.push({
                frame: frame,
                time: time,
                tilt: {
                    x: Math.sin(time * 2) * 0.5 * progress,
                    y: Math.cos(time * 1.5) * 0.4 * progress,
                    z: Math.sin(time * 3) * 0.3 * progress
                },
                crack: Math.max(0, progress * 2.5 - 0.5)
            });
        }
        
        return dataset;
    }
    
    /**
     * 애니메이션 중단
     */
    stopAnimation() {
        this.isAnimating = false;
    }
    
    /**
     * 차트 초기화
     */
    clearCharts() {
        this.charts.forEach(({ chart }) => {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            // x축 범위 초기화
            chart.options.scales.x.min = 0;
            chart.options.scales.x.max = 1;
            chart.update('none');
        });
        console.log('📊 차트 초기화 완료');
    }
    
    /**
     * 표시
     */
    show() {
        if (this.container) {
            this.container.classList.add('show');
            this.isVisible = true;
        }
    }
    
    /**
     * 숨기기
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('show');
            this.isVisible = false;
            this.isAnimating = false;
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        this.charts.forEach(({ chart }) => {
            chart.destroy();
        });
        this.charts = [];
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        console.log('🔚 SensorChartManager 정리 완료');
    }
}