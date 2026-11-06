import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import './style.css';
import { App } from './app';
import { connectHomeAssistant } from './lib/home-assistant';

connectHomeAssistant();

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
