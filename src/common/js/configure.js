import { ReactiveVar } from 'meteor/reactive-var';

const configuration = new ReactiveVar({ afterRoute: '/', verbosity: 0 });
iziamOAuth.configure = options => {
    if (options !== undefined) {
        if (!options || typeof options !== 'object' || Array.isArray(options) ||
            Object.keys(options).some(key => !['afterRoute', 'verbosity'].includes(key))) {
            throw new Error('Invalid iziamOAuth configuration');
        }
        if (options.afterRoute !== undefined && (typeof options.afterRoute !== 'string' ||
            !options.afterRoute.startsWith('/') || options.afterRoute.startsWith('//'))) {
            throw new Error('afterRoute must be an application-relative path');
        }
        configuration.set({ ...configuration.get(), ...options });
    }
    return { ...configuration.get() };
};
