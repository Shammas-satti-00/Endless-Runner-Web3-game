export class InputController {
    listeners = new Set();
    pointerStart = null;
    constructor() {
        window.addEventListener('keydown', this.onKeyDown, { passive: false });
        window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
        window.addEventListener('pointerup', this.onPointerUp, { passive: true });
        document.querySelectorAll('[data-action]').forEach((button) => {
            button.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
                const action = button.dataset.action;
                if (action)
                    this.emit(action);
            });
        });
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    onKeyDown = (event) => {
        if (event.repeat)
            return;
        const keyMap = {
            ArrowLeft: 'left', KeyA: 'left',
            ArrowRight: 'right', KeyD: 'right',
            ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
            ArrowDown: 'slide', KeyS: 'slide', KeyC: 'slide', ShiftLeft: 'slide', ShiftRight: 'slide',
            Escape: 'pause', KeyP: 'pause',
        };
        const action = keyMap[event.code];
        if (!action)
            return;
        event.preventDefault();
        this.emit(action);
    };
    onPointerDown = (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('button, input, a, [role="dialog"]'))
            return;
        this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    };
    onPointerUp = (event) => {
        const start = this.pointerStart;
        this.pointerStart = null;
        if (!start)
            return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const elapsed = performance.now() - start.time;
        if (elapsed > 650 || Math.max(Math.abs(dx), Math.abs(dy)) < 34)
            return;
        if (Math.abs(dx) > Math.abs(dy) * 1.12)
            this.emit(dx < 0 ? 'left' : 'right');
        else if (dy < -25)
            this.emit('jump');
        else if (dy > 25)
            this.emit('slide');
    };
    emit(action) {
        this.listeners.forEach((listener) => listener(action));
    }
}
