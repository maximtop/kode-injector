import React from 'react';
import ToggleButton from './ToggleButton.jsx';

const PopUp = () => (
  <div className="container">
    <div className="row d-flex align-items-center">
      <div className="col">
        <div>Extension on/off</div>
      </div>
      <div className="col">
        <ToggleButton/>
      </div>
    </div>
  </div>
);

export default PopUp;
