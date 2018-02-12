import React from 'react';
import { Field, reduxForm } from 'redux-form';

class NewInjectionForm extends React.Component {
  addInjection = (values) => {
    this.props.addInjection(values);
    this.props.reset();
  };

  // TODO change file paths to choose file input
  render() {
    return <form action="" className="form-inline" onSubmit={this.props.handleSubmit(this.addInjection)}>
      <div className="form-group mx-3">
        <label htmlFor="siteUrl" className="pr-1">Site url</label>
        <div>
          <Field name="siteUrl" id="siteUrl" required component="input" type="text"/>
        </div>
        <label htmlFor="jsPath" className="px-1">JS Path</label>
        <div>
          <Field name="jsPath" component="input" type="text"/>
        </div>
        <label htmlFor="cssPath" className="px-1">CSS Path</label>
        <div>
          <Field name="cssPath" component="input" type="text"/>
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm">Add</button>
    </form>;
  }
}

export default reduxForm({
  form: 'newInjection',
})(NewInjectionForm);
