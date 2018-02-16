import React from 'react';
import NewInjectionFormContainer from './containers/NewInjectionForm';
import InjectionsListContainer from './containers/InjectionsList';
import Header from './components/Header.jsx';

const App = () => (
  <div className="row justify-content-center">
    <div className="col-10">
      <Header/>
      <InjectionsListContainer/>
      <NewInjectionFormContainer/>
    </div>
  </div>
);

export default App;
