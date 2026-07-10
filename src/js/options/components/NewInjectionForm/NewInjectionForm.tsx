/**
 * @file
 */

/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useContext } from 'react';
import { Form, Input, Button } from 'antd';
import { observer } from 'mobx-react';

import type { NewInjectionData } from '../../../common/contracts';
import { InjectionField } from '../../../common/constants';
import { translator } from '../../../common/translator';
import { rootStore } from '../../stores/RootStore';

/**
 * Renders the form for creating an injection rule.
 *
 * @returns New injection form element.
 */
export const NewInjectionForm = observer(() => {
    const [form] = Form.useForm<NewInjectionData>();
    const { injectionsStore, translationStore } = useContext(rootStore);

    useEffect(() => {
        const touchedFields = Object.values(InjectionField)
            .filter((name) => form.isFieldTouched(name));
        if (touchedFields.length > 0) {
            form.validateFields(touchedFields).catch(() => undefined);
        }
    }, [form, translationStore.currentLocale]);

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
                name={InjectionField.Site}
                rules={[
                    {
                        required: true,
                        message: translator.getMessage('form_site_required'),
                    },
                ]}
            >
                <Input placeholder={translator.getMessage('form_site_placeholder')} />
            </Form.Item>
            <Form.Item
                name={InjectionField.JsPath}
                rules={[
                    {
                        required: true,
                        message: translator.getMessage('form_js_path_required'),
                    },
                ]}
            >
                <Input
                    placeholder="file:///index.js"
                    dir="auto"
                />
            </Form.Item>
            <Form.Item
                name={InjectionField.CssPath}
                rules={[
                    {
                        required: true,
                        message: translator.getMessage('form_css_path_required'),
                    },
                ]}
            >
                <Input
                    placeholder="file:///styles.css"
                    dir="auto"
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
                        {translator.getMessage('form_add_injection')}
                    </Button>
                )}
            </Form.Item>
        </Form>
    );
});
