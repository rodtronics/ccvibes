import { Engine } from './engine.js';
import { UI } from './ui.js';

window.addEventListener('load', () => {
    Engine.init();
    const ui = new UI();
    ui.init();
});
