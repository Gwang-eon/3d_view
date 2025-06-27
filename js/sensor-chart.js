// js/sensor-chart.js - 센서 데이터 차트 표시 모듈 (최적화 버전)

import { SensorDataLoader } from './sensor-data-loader.js';

export class SensorChartManager {
    constructor() {
        this.charts = [];
        this.isVisible = false;
        this.isAnimating = false;
        this.container = null;
        this.dataLoader = new SensorDataLoader();
        this.precomputedData = null;  // 미리 계산된 데이터
        this.currentModelName = null;
        
        // 차트 설정
        this.chartConfig = {
            animationDuration: 0,
            maxDataPoints: 50,  // 최대 표시 데이터 포인트
            updateInterval: 200,  // 200ms (초당 5회)
            batchSize: 5,  // 한 번에 업데이트할 프레임 수
            skipFrames: 2,  // 프레임 스킵
            dataPoints: 60,  // 표시할 데이터 포인트 수
            dangerThreshold: 0.8,
            warningThreshold: 0.5
        };
        
        // 시뮬레이션 설정
        this.simulationConfig = {
            normalRange: { min: -0.05, max: 0.05 },    // 정상 범위
            warningRange: { min: 0.5, max: 0.8 },      // 경고 범위
            dangerRange: { min: 0.8, max: 1.5 },       // 위험 범위
            transitionFrame: 20,  // 급격한 변화 시작 프레임
            maxFrame: 30        // 최대 프레임
        };
        
        // 데이터 저장소
        this.data = {
            tilt: { x: [], y: [], z: [] },
            crack: []
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
                <h3>센서 모니터링</h3>
                <div class="sensor-chart-status">
                    <span class="status-indicator danger">위험 감지</span>
                    <button class="sensor-chart-close">×</button>
                </div>
            </div>
            <div class="sensor-chart-body">
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
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // 닫기 버튼 이벤트
        const closeBtn = this.container.querySelector('.sensor-chart-close');
        closeBtn.addEventListener('click', () => this.hide());
    }
    
    /**
     * 차트 생성
     */
    createCharts() {
        // 기존 차트 제거 (중복 방지)
        this.charts.forEach(({ chart }) => {
            chart.destroy();
        });
        this.charts = [];
        
        // Chart.js 기본 설정
        Chart.defaults.color = 'rgba(255, 255, 255, 0.8)';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
        
        // 기울기 X축 차트
        this.createTiltChart('tilt-x-chart', 'X축 기울기', '#00ff88', 'x');
        
        // 기울기 Y축 차트
        this.createTiltChart('tilt-y-chart', 'Y축 기울기', '#00b4d8', 'y');
        
        // 기울기 Z축 차트
        this.createTiltChart('tilt-z-chart', 'Z축 기울기', '#ff6b35', 'z');
        
        // 균열 차트
        this.createCrackChart();
        
        console.log('✅ 차트 생성 완료:', this.charts.length + '개');
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
                animation: {
                    duration: 0  // 애니메이션 완전 비활성화
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false,  // 툴팁 비활성화로 성능 향상
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.parsed.y.toFixed(3)}°`;
                            }
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
                        ticks: {
                            stepSize: 0.5,
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '기울기 (도)'
                        },
                        min: -2,
                        max: 2,
                        ticks: {
                            stepSize: 0.5
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
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
                animation: {
                    duration: 0
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false,  // 툴팁 비활성화로 성능 향상
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.parsed.y.toFixed(2)}mm`;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            dangerLine: {
                                type: 'line',
                                yMin: 2.0,
                                yMax: 2.0,
                                borderColor: '#ff1744',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: '위험 임계값',
                                    enabled: true,
                                    position: 'end',
                                    backgroundColor: '#ff1744',
                                    color: 'white',
                                    font: {
                                        size: 10
                                    }
                                }
                            },
                            warningLine: {
                                type: 'line',
                                yMin: 1.0,
                                yMax: 1.0,
                                borderColor: '#ff6b35',
                                borderWidth: 1,
                                borderDash: [5, 5],
                                label: {
                                    content: '경고 임계값',
                                    enabled: true,
                                    position: 'end',
                                    backgroundColor: '#ff6b35',
                                    color: 'white',
                                    font: {
                                        size: 10
                                    }
                                }
                            }
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
                        ticks: {
                            stepSize: 0.5,
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '균열 폭 (mm)'
                        },
                        min: 0,
                        max: 3,
                        ticks: {
                            stepSize: 0.5
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                }
            }
        });
        
        this.charts.push({ chart, type: 'crack' });
    }
    
    /**
     * 시뮬레이션 시작 (최적화 버전)
     */
    async startSimulation(currentFrame = 0, maxFrame = 30, modelName = 'Default') {
        console.log(`🎬 센서 시뮬레이션 시작 (프레임: ${currentFrame}/${maxFrame})`);
        
        // 기존 애니메이션 중단
        this.stopAnimation();
        
        // 모델명 저장
        this.currentModelName = modelName;
        
        // 데이터 로드 또는 생성
        if (!this.precomputedData || this.precomputedData.modelName !== modelName) {
            console.log('📊 센서 데이터 생성 중...');
            this.precomputedData = {
                modelName: modelName,
                data: await this.dataLoader.generateFullDataset(modelName, maxFrame)
            };
            
            if (!this.precomputedData.data) {
                // 폴백: 기본 데이터 생성
                this.generateDefaultData(currentFrame, maxFrame);
            }
        }
        
        // 차트 초기화
        this.clearCharts();
        
        // 애니메이션 시작
        this.animateWithPrecomputedData(currentFrame);
        
        console.log('📊 센서 차트가 표시되었습니다. 닫기 버튼(×)을 클릭하면 차트를 닫을 수 있습니다.');
    }
    
    /**
     * 시뮬레이션 데이터 생성
     */
    generateSimulationData(currentFrame, maxFrame) {
        const fps = 30;
        const transitionFrame = this.simulationConfig.transitionFrame;
        
        // 시간 배열 생성 (초 단위)
        const times = [];
        for (let i = 0; i <= currentFrame; i++) {
            times.push(i / fps);
        }
        
        // 기울기 데이터 생성
        ['x', 'y', 'z'].forEach(axis => {
            this.data.tilt[axis] = times.map((time, index) => {
                const frame = index;
                let value;
                
                if (frame < transitionFrame) {
                    // 정상 구간: 미세한 변동
                    value = this.randomInRange(-0.05, 0.05);
                } else if (frame < currentFrame - 5) {
                    // 전환 구간: 점진적 증가
                    const progress = (frame - transitionFrame) / (currentFrame - transitionFrame - 5);
                    const range = this.interpolateRange(
                        this.simulationConfig.normalRange,
                        this.simulationConfig.warningRange,
                        progress
                    );
                    value = this.randomInRange(range.min, range.max);
                } else {
                    // 위험 구간: 급격한 증가
                    const multiplier = axis === 'x' ? 1.5 : axis === 'y' ? 1.2 : 1.0;
                    value = this.randomInRange(0.8, 1.5) * multiplier;
                }
                
                return { x: time, y: value };
            });
        });
        
        // 균열 데이터 생성
        this.data.crack = times.map((time, index) => {
            const frame = index;
            let value;
            
            if (frame < transitionFrame) {
                // 정상: 0에 가까운 값
                value = this.randomInRange(0, 0.1);
            } else if (frame < currentFrame - 3) {
                // 점진적 증가
                const progress = (frame - transitionFrame) / (currentFrame - transitionFrame - 3);
                value = this.interpolate(0.1, 1.0, progress) + this.randomInRange(-0.1, 0.1);
            } else {
                // 급격한 증가
                value = this.interpolate(1.0, 2.5, (frame - (currentFrame - 3)) / 3);
            }
            
            return { x: time, y: Math.max(0, value) };
        });
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
        
        // 차트 데이터 배열 초기화
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
            
            // 배치 데이터 추가
            const endIndex = Math.min(currentIndex + this.chartConfig.batchSize, maxIndex + 1);
            
            for (let i = currentIndex; i < endIndex; i += this.chartConfig.skipFrames) {
                const frame = dataset[i];
                if (!frame) continue;
                
                // 최대 데이터 포인트 체크
                if (chartData.crack.length >= this.chartConfig.maxDataPoints) {
                    // 오래된 데이터 제거
                    ['x', 'y', 'z'].forEach(axis => chartData.tilt[axis].shift());
                    chartData.crack.shift();
                }
                
                // 새 데이터 추가
                chartData.tilt.x.push({ x: frame.time, y: frame.tilt.x });
                chartData.tilt.y.push({ x: frame.time, y: frame.tilt.y });
                chartData.tilt.z.push({ x: frame.time, y: frame.tilt.z });
                chartData.crack.push({ x: frame.time, y: frame.crack });
            }
            
            // 차트 업데이트 (requestAnimationFrame 사용하지 않음)
            this.updateChartsDirectly(chartData);
            
            // 요약 정보 업데이트
            if (dataset[endIndex - 1]) {
                this.updateSummaryFromData(dataset[endIndex - 1]);
            }
            
            currentIndex = endIndex;
            
            // 다음 업데이트 예약
            if (this.isAnimating) {
                setTimeout(updateCharts, this.chartConfig.updateInterval);
            }
        };
        
        // 첫 업데이트
        updateCharts();
    }
    
    /**
     * 차트 직접 업데이트 (성능 최적화)
     */
    updateChartsDirectly(data) {
        this.charts.forEach(({ chart, axis, type }) => {
            if (type === 'tilt' && data.tilt[axis]) {
                const chartData = data.tilt[axis];
                chart.data.labels = chartData.map(d => d.x);
                chart.data.datasets[0].data = chartData.map(d => d.y);
            } else if (type === 'crack' && data.crack) {
                const chartData = data.crack;
                chart.data.labels = chartData.map(d => d.x);
                chart.data.datasets[0].data = chartData.map(d => d.y);
            }
            
            // 애니메이션 없이 업데이트
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
    }
    
    /**
     * 기본 데이터 생성 (폴백)
     */
    generateDefaultData(currentFrame, maxFrame) {
        // 기존 로직 유지
        this.generateSimulationData(currentFrame, maxFrame);
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
            chart.update('none');
        });
    }
    
    /**
     * 요약 정보 업데이트
     */
    updateSummary(currentIndex = -1) {
        const index = currentIndex === -1 ? this.data.crack.length - 1 : currentIndex;
        
        // 현재 프레임
        const frameEl = document.getElementById('current-frame');
        if (frameEl) {
            frameEl.textContent = Math.round(index * 30 / this.data.crack.length);
        }
        
        // 최대 기울기
        const maxTiltEl = document.getElementById('max-tilt');
        if (maxTiltEl && index >= 0) {
            const maxX = Math.abs(this.data.tilt.x[index]?.y || 0);
            const maxY = Math.abs(this.data.tilt.y[index]?.y || 0);
            const maxZ = Math.abs(this.data.tilt.z[index]?.y || 0);
            const maxTilt = Math.max(maxX, maxY, maxZ);
            maxTiltEl.textContent = maxTilt.toFixed(2) + '°';
            maxTiltEl.className = maxTilt > 0.8 ? 'value danger' : maxTilt > 0.5 ? 'value warning' : 'value';
        }
        
        // 균열 폭
        const crackEl = document.getElementById('crack-width');
        if (crackEl && index >= 0) {
            const crackWidth = this.data.crack[index]?.y || 0;
            crackEl.textContent = crackWidth.toFixed(2) + 'mm';
            crackEl.className = crackWidth > 2.0 ? 'value danger' : crackWidth > 1.0 ? 'value warning' : 'value';
        }
    }
    
    /**
     * 데이터 초기화
     */
    clearData() {
        this.data.tilt.x = [];
        this.data.tilt.y = [];
        this.data.tilt.z = [];
        this.data.crack = [];
        
        // 차트 초기화
        this.charts.forEach(({ chart }) => {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update('none');
        });
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
            // 애니메이션 중단
            this.isAnimating = false;
        }
    }
    
    /**
     * 보간 헬퍼 함수
     */
    interpolate(start, end, progress) {
        return start + (end - start) * progress;
    }
    
    interpolateRange(startRange, endRange, progress) {
        return {
            min: this.interpolate(startRange.min, endRange.min, progress),
            max: this.interpolate(startRange.max, endRange.max, progress)
        };
    }
    
    randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    /**
     * 정리
     */
    destroy() {
        // 차트 제거
        this.charts.forEach(({ chart }) => {
            chart.destroy();
        });
        this.charts = [];
        
        // 컨테이너 제거
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        console.log('🔚 SensorChartManager 정리 완료');
    }
}