import React from 'react';

export default class InjectionsList extends React.Component {
  renderRows() {
    const { injections } = this.props;
    return (<tbody>
    {injections.map(({
                       siteUrl, jsPath, cssPath, id,
                     }) =>
      <tr key={id}>
        <th scope="row">{id}</th>
        <td>{siteUrl}</td>
        <td>{jsPath}</td>
        <td>{cssPath}</td>
      </tr>)}</tbody>);
  }

  renderTable() {
    return (
      <table className="table">
        <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">siteUrl</th>
          <th scope="col">jsPath</th>
          <th scope="col">cssPath</th>
        </tr>
        </thead>
        {this.renderRows()}
      </table>
    );
  }

  render() {
    const { injections } = this.props;
    if (injections.length === 0) {
      return null;
    }
    return <div className="mt-3">
      {this.renderTable()}
    </div>;
  }
}
