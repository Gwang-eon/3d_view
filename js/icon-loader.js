// js/icon-loader.js - SVG 아이콘 로더 모듈

class IconLoader {
    constructor() {
        this.iconPath = './icons/lucide/';
        this.cache = new Map();
        this.defaultSize = 24;
        this.defaultClass = 'lucide-icon';
        
        // 아이콘 별칭 매핑 (이모지 -> lucide 아이콘명)
        this.iconMap = {
            '🏠': 'home',
            '📍': 'map-pin',
            '📊': 'bar-chart-3',
            '⛶': 'maximize-2',
            '?': 'help-circle',
            '▶': 'play',
            '⏸': 'pause',
            '🎬': 'video',
            '×': 'x',
            '▼': 'chevron-down',
            '▲': 'chevron-up',
            '⚠️': 'alert-triangle',
            'ℹ️': 'info',
            '🔄': 'refresh-ccw',
            '👁️': 'eye',
            '🙈': 'eye-off',
            '⚙️': 'settings',
            '📐': 'ruler',
            '🔍': 'search',
            '💧': 'droplet',
            '🌡️': 'thermometer',
            '📏': 'move',
            '⚡': 'zap'
        };
    }
    
    /**
     * SVG 아이콘 로드 및 캐싱
     */
    async loadIcon(iconName) {
        // 캐시 확인
        if (this.cache.has(iconName)) {
            return this.cache.get(iconName);
        }
        
        try {
            const url = `${this.iconPath}${iconName}.svg`;
            console.log(`아이콘 로드 시도: ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`아이콘 로드 실패 (${response.status}): ${iconName}`);
                throw new Error(`아이콘 로드 실패: ${iconName}`);
            }
            
            const svgText = await response.text();
            
            // SVG 유효성 간단히 확인
            if (!svgText.includes('<svg') || !svgText.includes('</svg>')) {
                console.error(`유효하지 않은 SVG: ${iconName}`);
                throw new Error(`유효하지 않은 SVG: ${iconName}`);
            }
            
            this.cache.set(iconName, svgText);
            console.log(`아이콘 로드 성공: ${iconName}`);
            return svgText;
            
        } catch (error) {
            console.error(`아이콘 로드 오류 (${iconName}):`, error);
            return this.getFallbackIcon(iconName);
        }
    }
    
    /**
     * 아이콘 생성 및 삽입
     */
    async createIcon(iconName, options = {}) {
        const {
            size = this.defaultSize,
            className = '',
            color = '#ffffff', // 기본값을 흰색으로 변경
            strokeWidth = 2,
            title = ''
        } = options;
        
        // 이모지 매핑 확인
        const mappedName = this.iconMap[iconName] || iconName;
        
        // SVG 로드
        const svgText = await this.loadIcon(mappedName);
        
        // 임시 컨테이너로 파싱
        const temp = document.createElement('div');
        temp.innerHTML = svgText;
        const svg = temp.querySelector('svg');
        
        if (!svg) {
            return this.createFallbackElement(iconName);
        }
        
        // 속성 설정
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('class', `${this.defaultClass} ${className}`.trim());
        
        // 색상 강제 적용
        svg.style.stroke = color;
        svg.style.fill = 'none';
        
        // stroke 속성도 직접 설정
        svg.setAttribute('stroke', color);
        svg.setAttribute('fill', 'none');
        
        // 모든 path, circle, line 등의 자식 요소에도 적용
        const children = svg.querySelectorAll('path, circle, line, polyline, polygon, rect');
        children.forEach(child => {
            child.setAttribute('stroke', color);
            child.setAttribute('fill', 'none');
        });
        
        // stroke-width 조정
        if (strokeWidth !== 2) {
            svg.setAttribute('stroke-width', strokeWidth);
        }
        
        // 접근성
        if (title) {
            svg.setAttribute('aria-label', title);
            svg.setAttribute('role', 'img');
        }
        
        return svg;
    }
    
    /**
     * DOM 요소에 아이콘 삽입
     */
    async insertIcon(element, iconName, options = {}) {
        const icon = await this.createIcon(iconName, options);
        
        // 기존 내용 제거
        element.innerHTML = '';
        element.appendChild(icon);
        
        return icon;
    }
    
    /**
     * 모든 data-icon 속성을 가진 요소 자동 변환
     */
    async replaceAllIcons() {
        const elements = document.querySelectorAll('[data-icon]');
        
        for (const element of elements) {
            const iconName = element.dataset.icon;
            const size = element.dataset.iconSize || this.defaultSize;
            const title = element.dataset.iconTitle || '';
            
            // 색상 결정 로직 개선
            let color = element.dataset.iconColor;
            if (!color) {
                // 부모 요소 확인하여 컨텍스트별 색상 적용
                if (element.closest('.video-btn')) {
                    color = '#ffffff';
                } else if (element.closest('.header-btn')) {
                    color = '#ffffff';
                } else if (element.closest('.floating-toggle')) {
                    color = '#ffffff';
                } else if (element.closest('.timeline-btn')) {
                    color = '#ffffff';
                } else if (element.closest('.help-list')) {
                    color = 'rgba(255, 255, 255, 0.8)';
                } else {
                    color = '#ffffff'; // 기본값
                }
            }
            
            await this.insertIcon(element, iconName, {
                size: parseInt(size),
                color,
                title
            });
        }
    }
    
    /**
     * 이모지를 아이콘으로 변환
     */
    async replaceEmojis() {
        const textNodes = [];
        const walk = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walk.nextNode()) {
            if (node.nodeValue && this.containsEmoji(node.nodeValue)) {
                textNodes.push(node);
            }
        }
        
        for (const textNode of textNodes) {
            const parent = textNode.parentNode;
            if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
                await this.replaceTextNodeEmojis(textNode);
            }
        }
    }
    
    /**
     * 텍스트 노드의 이모지 변환
     */
    async replaceTextNodeEmojis(textNode) {
        const text = textNode.nodeValue;
        const parent = textNode.parentNode;
        
        // 이모지 패턴으로 분할
        const parts = text.split(/([🏠📍📊⛶❓▶⏸🎬×▼▲⚠️ℹ️🔄👁️🙈⚙️📐🔍💧🌡️📏⚡])/g);
        
        if (parts.length === 1) return;
        
        const fragment = document.createDocumentFragment();
        
        for (const part of parts) {
            if (this.iconMap[part]) {
                const span = document.createElement('span');
                span.className = 'icon-wrapper';
                const icon = await this.createIcon(part, {
                    size: parseInt(window.getComputedStyle(parent).fontSize) || 16
                });
                span.appendChild(icon);
                fragment.appendChild(span);
            } else if (part) {
                fragment.appendChild(document.createTextNode(part));
            }
        }
        
        parent.replaceChild(fragment, textNode);
    }
    
    /**
     * 이모지 포함 여부 확인
     */
    containsEmoji(text) {
        return Object.keys(this.iconMap).some(emoji => text.includes(emoji));
    }
    
    /**
     * 폴백 아이콘 생성
     */
    getFallbackIcon(iconName) {
        console.warn(`폴백 아이콘 사용: ${iconName}`);
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>`;
    }
    
    /**
     * 폴백 요소 생성
     */
    createFallbackElement(iconName) {
        console.warn(`폴백 요소 생성: ${iconName}`);
        const span = document.createElement('span');
        span.className = 'icon-fallback';
        span.textContent = '?';
        span.style.width = '24px';
        span.style.height = '24px';
        span.style.display = 'inline-flex';
        span.style.alignItems = 'center';
        span.style.justifyContent = 'center';
        span.style.fontSize = '16px';
        span.style.fontWeight = 'bold';
        span.style.color = '#ff6b35';
        span.style.background = 'rgba(255, 107, 53, 0.2)';
        span.style.borderRadius = '4px';
        span.style.border = '1px solid #ff6b35';
        return span;
    }
    
    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * 특정 요소의 아이콘 업데이트
     */
    async updateIcon(element, newIconName, options = {}) {
        await this.insertIcon(element, newIconName, options);
    }
    
    /**
     * 아이콘 프리로드
     */
    async preloadIcons(iconNames) {
        const promises = iconNames.map(name => this.loadIcon(name));
        await Promise.all(promises);
        console.log(`✅ ${iconNames.length}개 아이콘 프리로드 완료`);
    }
}

// 전역 인스턴스 생성 및 내보내기
const iconLoader = new IconLoader();

// 자동 초기화 (DOMContentLoaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await iconLoader.replaceAllIcons();
    });
} else {
    // 이미 로드된 경우
    iconLoader.replaceAllIcons();
}

export { iconLoader, IconLoader };