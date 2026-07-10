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
import { rootStore } from '../../stores/RootStore';

import './injections-table.pcss';

// TODO translate columns titles
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
        // TODO translate prompt
        // eslint-disable-next-line no-alert
        const response = window.confirm('Injection would be removed permanently. Are you sure?');
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
            title: 'Site',
            dataIndex: 'site',
            key: 'site',
        },
        {
            title: 'JS file path',
            dataIndex: 'jsPath',
            key: 'jsPath',
            render: (text: string) => {
                return (<a href={text} target="_blank" rel="noreferrer">{text}</a>);
            },
        },
        {
            title: 'CSS file path',
            dataIndex: 'cssPath',
            key: 'cssPath',
            render: (text: string) => {
                return (<a href={text} target="_blank" rel="noreferrer">{text}</a>);
            },
        },
        {
            title: 'Actions',
            key: 'action',
            render: (_text: unknown, record) => {
                return (
                    <>
                        <Space>
                            <Switch
                                title={record.enabled ? 'Turn off injection' : 'Turn on injection'}
                                checkedChildren={<CheckOutlined />}
                                unCheckedChildren={<CloseOutlined />}
                                defaultChecked={record.enabled}
                                onChange={handleToggle(record.id)}
                            />
                            <Button
                                danger
                                title="Remove injection"
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
            rowKey={(record) => record.id}
            rowClassName={(record) => (record.enabled ? '' : 'disabled')}
        />
    );
});
