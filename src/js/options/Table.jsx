import React, { Component } from 'react'
// import ReactTable from 'react-table';

export default class Table extends Component {
  render () {
    const data = [
      {
        url: 'example.com',
        jsPath: '/script.js',
        cssPath: '/styles.css',
      },
      {
        url: 'example2.com',
        jsPath: '/script2.js',
        cssPath: '/styles2.css',
      }]
    const columns = [
      {
        Header: 'Site URL',
        accessor: 'url',
      }, {
        Header: 'JavaScript Path',
        accessor: 'jsPath',
      }, {
        Header: 'CSS Path',
        accessor: 'cssPath',
      }]
    
    const renderColumns = (columns) => {
      columns.forEach(column => column)
    }
    
    return (
      <div>
        <table class="table table-hover">
          <thead>
          <tr>
            
            <th scope="col">#</th>
            <th scope="col">First Name</th>
            <th scope="col">Last Name</th>
            <th scope="col">Username</th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <th scope="row">1</th>
            <td>Mark</td>
            <td>Otto</td>
            <td>@mdo</td>
          </tr>
          <tr>
            <th scope="row">2</th>
            <td>Jacob</td>
            <td>Thornton</td>
            <td>@fat</td>
          </tr>
          <tr>
            <th scope="row">3</th>
            <td colspan="2">Larry the Bird</td>
            <td>@twitter</td>
          </tr>
          </tbody>
        </table>
      </div>
    )
  }
}
