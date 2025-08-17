import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import 'katex/dist/katex.min.css';

// Simple approach - rely on TipTap Mathematics extension only
console.log('KaTeX CSS loaded via import');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


