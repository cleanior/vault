import Model, { attr } from '@ember-data/model';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import lazyCapabilities, { apiPath } from 'vault/macros/lazy-capabilities';
import { withFormFields } from 'vault/decorators/model-form-fields';
import { withModelValidations } from 'vault/decorators/model-validations';

const validations = {
  type: [{ type: 'presence', message: 'Type is required.' }],
  commonName: [{ type: 'presence', message: 'Common name is required.' }],
  issuerName: [
    {
      validator(model) {
        if (model.actionType === 'generate-root' && model.issuerName === 'default') return false;
        return true;
      },
      message: 'Issuer name must be unique across all issuers and not be the reserved value default.',
    },
  ],
};

@withModelValidations(validations)
@withFormFields()
export default class PkiActionModel extends Model {
  @service secretMountPath;

  @tracked actionType; // used to toggle between different form fields when creating configuration

  /* actionType import */
  @attr('string') pemBundle;

  /* actionType generate-root */
  @attr('string', {
    possibleValues: ['exported', 'internal', 'existing', 'kms'],
    noDefault: true,
  })
  type;

  @attr('string') issuerName; // REQUIRED for generate-root actionType, cannot be "default"

  @attr('string') keyName; // cannot be "default"

  @attr('string', {
    defaultValue: 'default',
    label: 'Key reference',
  })
  keyRef; // type=existing only

  @attr('string') commonName; // REQUIRED

  @attr('string', {
    label: 'Subject Alternative Names (SANs)',
  })
  altNames; // comma sep strings

  @attr('string', {
    label: 'IP Subject Alternative Names (IP SANs)',
  })
  ipSans;

  @attr('string', {
    label: 'URI Subject Alternative Names (URI SANs)',
  })
  uriSans;

  @attr('string', {
    label: 'Other SANs',
  })
  otherSans;

  @attr('string', {
    defaultValue: 'pem',
    possibleValues: ['pem', 'der', 'pem_bundle'],
  })
  format;

  @attr('string', {
    defaultValue: 'der',
    possibleValues: ['der', 'pkcs8'],
  })
  privateKeyFormat;

  @attr('string', {
    defaultValue: 'rsa',
    possibleValues: ['rsa', 'ed25519', 'ec'],
  })
  keyType;

  @attr('string', {
    defaultValue: '0',
    // options management happens in pki-key-parameters
  })
  keyBits;

  @attr('number', {
    defaultValue: -1,
  })
  maxPathLength;

  @attr('boolean', {
    label: 'Exclude common name from SANs',
    subText:
      'If checked, the common name will not be included in DNS or Email Subject Alternate Names. This is useful if the CN is a human-readable identifier, not a hostname or email address.',
    defaultValue: false,
  })
  excludeCnFromSans;

  @attr('string', {
    label: 'Permitted DNS domains',
  })
  permittedDnsDomains;

  @attr('string', {
    label: 'Organizational Units (OU)',
  })
  ou;
  @attr('string') organization;
  @attr('string') country;
  @attr('string') locality;
  @attr('string') province;
  @attr('string') streetAddress;
  @attr('string') postalCode;

  @attr('string', {
    subText: "Specifies the requested Subject's named Serial Number value.",
  })
  serialNumber;

  @attr('boolean', {
    subText: 'Whether to add a Basic Constraints extension with CA: true.',
  })
  addBasicConstraints;

  @attr({
    label: 'Backdate validity',
    detailsLabel: 'Issued certificate backdating',
    helperTextDisabled: 'Vault will use the default value, 30s',
    helperTextEnabled:
      'Also called the not_before_duration property. Allows certificates to be valid for a certain time period before now. This is useful to correct clock misalignment on various systems when setting up your CA.',
    editType: 'ttl',
    defaultValue: '30s',
  })
  notBeforeDuration;

  @attr('string') managedKeyName;
  @attr('string', {
    label: 'Managed key UUID',
  })
  managedKeyId;

  @attr({
    label: 'Not valid after',
    detailsLabel: 'Issued certificates expire after',
    subText:
      'The time after which this certificate will no longer be valid. This can be a TTL (a range of time from now) or a specific date.',
    editType: 'yield',
  })
  customTtl;
  @attr('string') ttl;
  @attr('date') notAfter;

  @attr('string', { readOnly: true }) issuerId; // returned from generate-root action

  // For generating and signing a CSR
  @attr('string') csr;
  @attr caChain;

  get backend() {
    return this.secretMountPath.currentPath;
  }

  // To determine which endpoint the config adapter should use,
  // we want to check capabilities on the newer endpoints (those
  // prefixed with "issuers") and use the old path as fallback
  // if user does not have permissions.
  @lazyCapabilities(apiPath`${'backend'}/issuers/import/bundle`, 'backend') importBundlePath;
  @lazyCapabilities(apiPath`${'backend'}/issuers/generate/root/${'type'}`, 'backend', 'type')
  generateIssuerRootPath;
  @lazyCapabilities(apiPath`${'backend'}/issuers/generate/intermediate/${'type'}`, 'backend', 'type')
  generateIssuerCsrPath;
  @lazyCapabilities(apiPath`${'backend'}/issuers/cross-sign`, 'backend') crossSignPath;

  get canImportBundle() {
    return this.importBundlePath.get('canCreate') === true;
  }
  get canGenerateIssuerRoot() {
    return this.generateIssuerRootPath.get('canCreate') === true;
  }
  get canGenerateIssuerIntermediate() {
    return this.generateIssuerCsrPath.get('canCreate') === true;
  }
  get canCrossSign() {
    return this.crossSignPath.get('canCreate') === true;
  }
}
