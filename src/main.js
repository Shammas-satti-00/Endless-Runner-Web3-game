import './styles.css';
import { Game } from './game/Game';
const root = document.getElementById('game-root');
if (!root)
    throw new Error('Missing #game-root');
const game = new Game(root);
void game.init();
