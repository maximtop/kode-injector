// import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import "../css/options.css";
import 'react-table/react-table.css';
import React from 'react';
import ReactDOM from 'react-dom';
import Index from './options/Index';
// import 'font-awesome/css/font-awesome.min.css'; // TODO resolve font-awesome including in webpack

ReactDOM.render(<Index />, document.getElementById('root'));
