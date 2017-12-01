import React, { Component } from 'react';
import FontAwesome from 'react-fontawesome';
import Header from './Header';
import Table from './Table';
import Input from './Input';

export default class Index extends Component {
  state = {
    showInput: false,
    data: [
      {
        url: 'example.com',
        jsPath: '/script.js',
        cssPath: '/styles.css',
      },
      {
        url: 'example2.com',
        jsPath: '/script2.js',
        cssPath: '/styles2.css',
      }
    ],
    inputData: {
      url: null,
      jsPath: null,
      cssPath: null,
    }
  };
  
  handleChange = (e) => {
    e.preventDefault();
    const { inputData } = this.state;
    switch (e.target.id) {
      case 'site': {
        inputData.url = e.target.value;
        break;
      }
      case 'jsInput': {
        inputData.jsPath = e.target.value;
        break;
      }
      case 'cssInput' : {
        inputData.cssPath = e.target.value;
        break;
      }
      default:
        break;
    }
    this.setState({inputData});
  }
  
  handleAddInput = (e) => {
    e.preventDefault();
    const { showInput } = this.state;
    if (showInput) {
      this.setState({showInput: false})
    } else {
      this.setState({showInput: true})
    }
  };
  
  renderButton = () => {
    const {showInput} = this.state;
    if(!showInput) {
      return <FontAwesome name='plus' size='3x' />
    } else {
      return <FontAwesome name='minus' size='3x' />
    }
  }
  
  addData = (e) => {
    e.preventDefault();
    const {data, inputData} = this.state;
    
    const {url, jsPath, cssPath} = inputData;
    this.setState({data: [...data, {url, jsPath, cssPath}]})
  }
  
  render() {
    const { showInput } = this.state;
    return (
      <div className='container'>
        <Header/>
        <Table data={this.state.data}/>
        <div className="row justify-content-center mt-3">
          <a href="#" onClick={this.handleAddInput}>
            {this.renderButton()}
          </a>
        </div>
        {showInput ? <Input addData={this.addData} handleChange={this.handleChange}/> : ''}
      </div>
    )
  }
}