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
    const cutUrl = url => (url && url.match('/') ? url.split('/').slice(-3).join('/') : url);
    const { injections } = this.props;
    console.log(injections);
    return (<tbody>
    {injections.sort((a, b) => (a.id > b.id ? -1 : 1)).map(({
                       siteUrl, jsPath, cssPath, id, state,
                     }) =>
      <tr key={id} className={state === 'active' ? 'table-success' : 'table-secondary'}>
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
          <th scope="col" className='text-center'>ID</th>
          <th scope="col" className='text-center'>siteUrl</th>
          <th scope="col" className='text-center'>jsPath</th>
          <th scope="col" className='text-center'>cssPath</th>
          <th scope="col" className='text-center'>actions</th>
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
