import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-table/react-table.css';
import React from 'react';
import ReactDOM from 'react-dom';
import '../css/options.css';
import Index from './options/Index';
// import 'font-awesome/css/font-awesome.min.css'; // TODO resolve font-awesome including in webpack

const config = {
  'stackoverflow.com': {
    active: true,
    jsFilePath: 'file:///home/maxim/Documents/test.js',
    cssFilePath: 'file:///home/maxim/Documents/test.css',
  },
  'www.darty.com': {
    active: true,
    jsFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d%27achat-Notification-DAR_ACCOMP/index.js',
    cssFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d\'achat-Notification-DAR_ACCOMP/style.css',
  },
  'm.darty.com': {
    active: true,
    jsFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d%27achat-Notification-DAR_ACCOMP/index.js',
    cssFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d\'achat-Notification-DAR_ACCOMP/style.css',
  },
};

const updateConfig = (site, jsFilePath, cssFilePath) => {
  config[site] = { active: true, jsFilePath, cssFilePath };
};

ReactDOM.render(<Index />, document.getElementById('root'));
