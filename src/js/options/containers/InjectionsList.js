import { connect } from 'react-redux'; // eslint-disable-line
import Component from '../components/InjectionsList.jsx';
import * as actionCreators from '../actions';
import { injectionsSelector } from '../selectors';

const Container = connect(
    (state) => {
        const props = {
            injections: injectionsSelector(state),
        };
        return props;
    },
    actionCreators,
)(Component);

export default Container;
