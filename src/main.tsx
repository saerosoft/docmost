import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import './noteDetail.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<React.StrictMode><MantineProvider theme={createTheme({ primaryColor: 'teal', defaultRadius: 'sm', fontFamily: 'Inter, Pretendard, system-ui, sans-serif' })}><App/></MantineProvider></React.StrictMode>);
