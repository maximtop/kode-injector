import React, { Component } from 'react';
import ToggleButton from './ToggleButton.jsx';

class PopUp extends Component {
    render() {
        return (
            <div className="container">
                <div className="row d-flex align-items-center">
                    <div className="col">
                        <div>Extension on/off</div>
                    </div>
                    <div className="col">
                        <ToggleButton
                            toogleExtensionState={this.props.toggleExtensionState}
                            isActivated={this.props.isActivated}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

export default PopUp;
