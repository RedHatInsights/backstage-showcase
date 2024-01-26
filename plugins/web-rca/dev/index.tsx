import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { webRcaPlugin, WebRcaPage } from '../src/plugin';

createDevApp()
  .registerPlugin(webRcaPlugin)
  .addPage({
    element: <WebRcaPage />,
    title: 'Root Page',
    path: '/web-rca',
  })
  .render();
