import React from 'react';

export default class InjectionsList extends React.Component {
  toggleState = id => (e) => {
    e.preventDefault();
    this.props.toggleInjectionState({ id });
  };

  removeInjection = id => (e) => {
    e.preventDefault();
    this.props.removeInjection({ id });
  };

  renderActions(state, id) {
    const wording = state === 'active' ? 'TURN OFF' : 'TURN ON';
    return <div><a href="#" onClick={this.toggleState(id)}>{wording}</a>, <a href="#" onClick={this.removeInjection(id)}>Remove</a></div>;
  }

  renderRows() {
    const cutUrl = url => url || url.match('/') ? url.split('/').slice(-3).join('/') : url;
    const { injections } = this.props;
    console.log(injections);
    return (<tbody>
    {injections.map(({
                       siteUrl, jsPath, cssPath, id, state,
                     }) =>
      <tr key={id}>
        <th scope="row">{id}</th>
        <td>{siteUrl}</td>
        <td><a href={jsPath} target="_blank">{cutUrl(jsPath)}</a></td>
        <td><a href={cssPath} target="_blank">{cutUrl(cssPath)}</a></td>
        <td>{this.renderActions(state, id)}</td>
      </tr>)}</tbody>);
  }

  renderTable() {
    return (
      <table className="table">
        <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">siteUrl</th>
          <th scope="col">jsPath</th>
          <th scope="col">cssPath</th>
          <th scope="col">actions</th>
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
