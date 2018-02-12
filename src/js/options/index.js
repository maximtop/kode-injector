import React from 'react';
import NewInjectionFormContainer from './containers/NewInjectionForm';
import InjectionsListContainer from './containers/InjectionsList';

const App = () => (
  <div className="col-5">
    <InjectionsListContainer />
    <NewInjectionFormContainer />
  </div>
);

export default App;
