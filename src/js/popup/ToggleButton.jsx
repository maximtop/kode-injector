import React, { Component } from 'react';
import classNames from 'classnames';

export default class ToggleButton extends Component {
  state = { isActivated: this.props.isActivated };

  toggleButton = () => {
      const { isActivated } = this.state;
      console.log(isActivated);
      this.setState({ isActivated: !isActivated });
      this.props.toogleExtensionState(!isActivated);
  };

  render() {
      const btnClass = classNames({
          btn: true,
          'btn-sm': true,
          'btn-toggle': true,
          active: this.state.isActivated,
      });
      return (
          <button type="button" className={btnClass} onClick={this.toggleButton}>
              <div className="handle"></div>
          </button>
      );
  }
}
