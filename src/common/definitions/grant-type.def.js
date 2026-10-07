import { pwixI18n } from 'meteor/pwix:i18n';

const definitions = Object.freeze([
    Object.freeze({ id: 'authorization_code', label: 'definitions.grant_type.auth_code_label',
        description: 'definitions.grant_type.auth_code_description' }),
    Object.freeze({ id: 'client_credentials', label: 'definitions.grant_type.client_credentials_label',
        description: 'definitions.grant_type.client_credentials_description' }),
    Object.freeze({ id: 'refresh_token', label: 'definitions.grant_type.refresh_token_label',
        description: 'definitions.grant_type.refresh_token_description' })
]);

// Descriptive metadata shared with the accounts facade. Parameter validation
// belongs to the server engine, which reads private application settings.
export const GrantType = Object.freeze({
    Knowns: () => [...definitions],
    byId: id => definitions.find(definition => definition.id === id) || null,
    id: definition => definition.id,
    label: definition => pwixI18n.label(I18N, definition.label),
    description: definition => pwixI18n.label(I18N, definition.description)
});
iziamOAuth.GrantType = GrantType;
