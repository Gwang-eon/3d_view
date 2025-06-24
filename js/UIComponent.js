// js/UIComponent.js
// UI 컴포넌트 베이스 클래스
export class UIComponent {
    constructor(id, container) {
        this.id = id;
        this.container = container;
        this.element = null;
        this.eventHandlers = new Map();
    }
    
    create() {
        // 서브클래스에서 구현
        throw new Error('create() must be implemented by subclass');
    }
    
    mount() {
        if (!this.element) {
            this.element = this.create();
        }
        this.container.appendChild(this.element);
        this.bindEvents();
        return this;
    }
    
    unmount() {
        this.unbindEvents();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
    
    bindEvents() {
        this.eventHandlers.forEach((handlers, eventType) => {
            handlers.forEach(handler => {
                this.element.addEventListener(eventType, handler);
            });
        });
    }
    
    unbindEvents() {
        this.eventHandlers.forEach((handlers, eventType) => {
            handlers.forEach(handler => {
                this.element.removeEventListener(eventType, handler);
            });
        });
    }
    
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
        return this;
    }
    
    show() {
        if (this.element) this.element.style.display = 'block';
    }
    
    hide() {
        if (this.element) this.element.style.display = 'none';
    }
}

// 슬라이더 컴포넌트
export class SliderComponent extends UIComponent {
    constructor(id, container, options = {}) {
        super(id, container);
        this.options = {
            label: 'Slider',
            min: 0,
            max: 100,
            step: 1,
            value: 50,
            unit: '',
            ...options
        };
    }
    
    create() {
        const div = document.createElement('div');
        div.className = 'control-group';
        div.innerHTML = `
            <label>${this.options.label}: <span id="${this.id}-display">${this.options.value}${this.options.unit}</span></label>
            <input type="range" 
                   id="${this.id}" 
                   min="${this.options.min}" 
                   max="${this.options.max}" 
                   step="${this.options.step}" 
                   value="${this.options.value}">
        `;
        
        const slider = div.querySelector('input');
        const display = div.querySelector('span');
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            display.textContent = value.toFixed(1) + this.options.unit;
            if (this.options.onChange) {
                this.options.onChange(value);
            }
        });
        
        return div;
    }
    
    getValue() {
        const input = this.element.querySelector('input');
        return parseFloat(input.value);
    }
    
    setValue(value) {
        const input = this.element.querySelector('input');
        const display = this.element.querySelector('span');
        input.value = value;
        display.textContent = value.toFixed(1) + this.options.unit;
    }
}

// 버튼 그룹 컴포넌트
export class ButtonGroupComponent extends UIComponent {
    constructor(id, container, buttons = []) {
        super(id, container);
        this.buttons = buttons;
    }
    
    create() {
        const div = document.createElement('div');
        div.className = 'control-group';
        div.id = this.id;
        
        this.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.id = button.id;
            btn.textContent = button.text;
            btn.onclick = button.onClick;
            div.appendChild(btn);
        });
        
        return div;
    }
}

// 선택 박스 컴포넌트
export class SelectComponent extends UIComponent {
    constructor(id, container, options = {}) {
        super(id, container);
        this.options = {
            label: 'Select',
            options: [],
            onChange: null,
            ...options
        };
    }
    
    create() {
        const div = document.createElement('div');
        div.className = 'control-group';
        
        const label = document.createElement('label');
        label.textContent = this.options.label + ':';
        div.appendChild(label);
        
        const select = document.createElement('select');
        select.id = this.id;
        
        this.options.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            select.appendChild(option);
        });
        
        if (this.options.onChange) {
            select.addEventListener('change', (e) => {
                this.options.onChange(e.target.value);
            });
        }
        
        div.appendChild(select);
        return div;
    }
    
    addOption(value, text) {
        const select = this.element.querySelector('select');
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    }
    
    clearOptions() {
        const select = this.element.querySelector('select');
        select.innerHTML = '';
    }
}