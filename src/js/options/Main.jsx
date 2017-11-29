import React, { Component } from 'react';
import Header from './Header';
import Table from './Table';

export default class Main extends Component {
  render() {
    return (
      <div className='container'>
        <Header/>
        <Table/>
      </div>
    )
  }
}