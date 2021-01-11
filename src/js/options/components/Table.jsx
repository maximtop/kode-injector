import React, { Component } from 'react';
import ReactTable from 'react-table';

export default class Table extends Component {
    render() {
        const { data } = this.props;
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
            }, {
                Header: 'Action',
            }];

        return (
            <ReactTable
                data={data}
                columns={columns}
                showPagination={false}
                minRows={0}
            />
        );
    }
}
