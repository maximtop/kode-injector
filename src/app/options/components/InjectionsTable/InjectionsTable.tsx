/**
 * @file
 */

import React, { useContext } from 'react';
import {
    Button,
    Table,
    Space,
    Switch,
} from 'antd';
import {
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/lib/table';
import { observer } from 'mobx-react';

import type { InjectionRule } from '../../../common/contracts';
import { InjectionField } from '../../../common/constants';
import { rootStore } from '../../stores/RootStore';
import { translator } from '../../../common/translator';

import './injections-table.pcss';

export const InjectionsTable = observer(() => {
    const { injectionsStore } = useContext(rootStore);

    /**
     * Creates a click handler that confirms and removes an injection rule.
     *
     * @param id Injection rule identifier.
     *
     * @returns Injection removal click handler.
     */
    const handleRemoveClick = (id: string) => () => {
        // eslint-disable-next-line no-alert
        const response = window.confirm(translator.getMessage('injection_remove_confirm'));
        if (response) {
            injectionsStore.removeInjection(id);
        }
    };

    /**
     * Creates a click handler that toggles an injection rule.
     *
     * @param id Injection rule identifier.
     *
     * @returns Injection toggle click handler.
     */
    const handleToggle = (id: string) => () => {
        injectionsStore.toggleInjection(id);
    };

    const columns: ColumnsType<InjectionRule> = [
        {
            title: translator.getMessage('table_site'),
            dataIndex: InjectionField.Site,
            key: InjectionField.Site,
        },
        {
            title: translator.getMessage('table_js_path'),
            dataIndex: InjectionField.JsPath,
            key: InjectionField.JsPath,

            /**
             * Renders a JavaScript path as a technical link.
             */
            render: (text: string) => {
                return (<a href={text} target="_blank" rel="noreferrer"><bdi className="technical-value" dir="ltr">{text}</bdi></a>);
            },
        },
        {
            title: translator.getMessage('table_css_path'),
            dataIndex: InjectionField.CssPath,
            key: InjectionField.CssPath,

            /**
             * Renders a CSS path as a technical link.
             */
            render: (text: string) => {
                return (<a href={text} target="_blank" rel="noreferrer"><bdi className="technical-value" dir="ltr">{text}</bdi></a>);
            },
        },
        {
            title: translator.getMessage('table_actions'),
            key: 'action',

            /**
             * Renders the enable/disable and delete actions.
             */
            render: (_text: unknown, record) => {
                return (
                    <>
                        <Space>
                            <Switch
                                title={record.enabled
                                    ? translator.getMessage('injection_disable')
                                    : translator.getMessage('injection_enable')}
                                checkedChildren={<CheckOutlined />}
                                unCheckedChildren={<CloseOutlined />}
                                defaultChecked={record.enabled}
                                onChange={handleToggle(record.id)}
                            />
                            <Button
                                danger
                                title={translator.getMessage('injection_remove')}
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={handleRemoveClick(record.id)}
                            />
                        </Space>
                    </>
                );
            },
        },
    ];

    return (
        <Table
            style={{ paddingTop: '20px' }}
            dataSource={injectionsStore.injections.slice()}
            columns={columns}
            pagination={false}
            locale={{ emptyText: translator.getMessage('table_empty') }}
            rowKey={(record) => record.id}
            rowClassName={(record) => (record.enabled ? '' : 'disabled')}
        />
    );
});
