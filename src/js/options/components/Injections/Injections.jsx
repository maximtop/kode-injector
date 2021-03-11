import React from 'react';
import { NewInjectionForm } from '../NewInjectionForm';
import { InjectionsTable } from '../InjectionsTable';

export const Injections = () => {
    return (
        <>
            <NewInjectionForm />
            <InjectionsTable />
        </>
    );
};
