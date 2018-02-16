import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import { render } from 'react-dom';
import '../css/popup.css';
import PopUp from './popup/PopUp';

render(
  <PopUp/>,
  window.document.getElementById('app-container'),
);
