import React, { Component } from 'react';
import classNames from 'classnames';

export default class ToggleButton extends Component {
  state = { isActive: true };

  toggleButton = () => {
    this.setState({ isActive: !this.state.isActive });
  };

  render() {
    const btnClass = classNames({
      btn: true,
      'btn-sm': true,
      'btn-toggle': true,
      active: this.state.isActive,
    });
    return (
      <button type="button" className={btnClass} onClick={this.toggleButton}>
        <div className="handle"></div>
      </button>
    );
  }
}
