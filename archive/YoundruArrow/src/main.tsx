import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './styles.css';

const root = document.getElementById('root')!;
if (root.querySelector('main')) hydrateRoot(root, <React.StrictMode><App /></React.StrictMode>);
else createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
