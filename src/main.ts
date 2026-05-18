import { App } from './app/App';
import './ui/styles.css';
const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root');
const app = new App(root);
app.start();
