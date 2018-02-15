import React from 'react';
import NewInjectionFormContainer from './containers/NewInjectionForm';
import InjectionsListContainer from './containers/InjectionsList';
import Header from './components/Header';

const App = () => (
  <div className="col-5">
    <Header/>
    <InjectionsListContainer />
    <NewInjectionFormContainer />
  </div>
);

export default App;
