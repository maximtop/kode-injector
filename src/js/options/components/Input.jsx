import React, { Component } from 'react';

export default class Input extends Component {
  render() {
    return (
      <div>
        <form onSubmit={this.props.addData}>
          <div className="form-row">
            <div className="form-group col-4">
              <label htmlFor="site" />
              <input type="text" onChange={this.props.handleChange} className="form-control" id="site" placeholder="Site url"/>
            </div>
            <div className="form-group col-4">
              <label htmlFor="jsInput" />
              <input type="text" onChange={this.props.handleChange} className="form-control" id="jsInput" placeholder="JS file path"/>
            </div>
            <div className="form-group col-4">
              <label htmlFor="cssInput" />
              <input type="text" onChange={this.props.handleChange} className="form-control" id="cssInput" placeholder="CSS file path"/>
            </div>
          </div>
          <div className="row justify-content-center">
            <button type="submit" className="btn btn-primary">Add Site</button>
          </div>
        </form>
      </div>
    );
  }
}
