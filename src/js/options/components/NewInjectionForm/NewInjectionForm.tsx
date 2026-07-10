/**
 * @file
 */

/* eslint-disable react/jsx-props-no-spreading */
import React, { useState, useEffect, useContext } from 'react';
import { Form, Input, Button } from 'antd';

import type { NewInjectionData } from '../../../common/contracts';
import { rootStore } from '../../stores/RootStore';

/**
 * Renders the form for creating an injection rule.
 *
 * @returns New injection form element.
 */
export const NewInjectionForm = () => {
    const [form] = Form.useForm<NewInjectionData>();
    const [, forceUpdate] = useState({});
    const { injectionsStore } = useContext(rootStore);

    useEffect(() => {
        forceUpdate({});
    }, []);

    /**
     * Creates an injection rule from submitted form values.
     *
     * @param values Validated injection form values.
     */
    const onFinish = (values: NewInjectionData): void => {
        injectionsStore.addInjection(values);
        form.resetFields();
    };

    const layout = {
        labelCol: {
            span: 24,
        },
        wrapperCol: {
            span: 24,
        },
    };

    return (
        <Form
            style={{ paddingTop: '20px' }}
            form={form}
            {...layout}
            name="injection_form"
            layout="inline"
            onFinish={onFinish}
        >
            <Form.Item
                name="site"
                rules={[
                    {
                        required: true,
                        message: 'Please enter site', // TODO handle cases when site is not defined, inject scripts on every site
                    },
                ]}
            >
                <Input placeholder="Site" />
            </Form.Item>
            <Form.Item
                name="jsPath"
                rules={[
                    {
                        required: true,
                        message: 'Please enter path to JS file',
                    },
                ]}
            >
                <Input
                    placeholder="file:///index.js"
                />
            </Form.Item>
            <Form.Item
                name="cssPath"
                rules={[
                    {
                        required: true,
                        message: 'Please enter path to CSS file',
                    },
                ]}
            >
                <Input
                    placeholder="file:///styles.css"
                />
            </Form.Item>
            <Form.Item shouldUpdate>
                {() => (
                    <Button
                        type="primary"
                        htmlType="submit"
                        disabled={
                            !!form.getFieldsError().filter(({ errors }) => errors.length).length
                        }
                    >
                        Add injection
                    </Button>
                )}
            </Form.Item>
        </Form>
    );
};
