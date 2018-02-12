import { connect } from 'react-redux'; // eslint-disable-line
import Component from '../components/NewInjectionForm.jsx';
import * as actionCreators from '../actions';

const mapStateToProps = (state) => {
  return {};
};

const Container = connect(
  mapStateToProps,
  actionCreators,
)(Component);

export default Container;
