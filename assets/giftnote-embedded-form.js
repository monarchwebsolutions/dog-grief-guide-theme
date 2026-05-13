import { fetchConfig } from '@theme/utilities';

const GIFTFORM_FIELDS = [
  'giftnote_to',
  'giftnote_from',
  'giftnote_message',
  'giftnote_medium',
  'giftnote_email',
  'giftnote_phone',
  'giftnote_method',
  'giftnote_time',
];

class GiftnoteEmbeddedForm extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === 'true') return;
    this.dataset.initialized = 'true';

    this.toInput = this.querySelector('[data-ref="to"]');
    this.messageInput = this.querySelector('[data-ref="message"]');
    this.emailInput = this.querySelector('[data-ref="email"]');
    this.saveButton = this.querySelector('[data-ref="saveButton"]');
    this.status = this.querySelector('[data-ref="status"]');
    this.hiddenFields = Array.from(this.querySelectorAll('[data-hidden-field]'));

    this.storageMode = this.dataset.storageMode || 'cart-attributes';
    this.defaultFrom = this.dataset.defaultFrom || '';
    [this.toInput, this.messageInput, this.emailInput].forEach((field) => field?.addEventListener('input', this.handleInput));
    this.saveButton?.addEventListener('click', this.handleSave);

    this.syncHiddenFields();
  }

  disconnectedCallback() {
    [this.toInput, this.messageInput, this.emailInput].forEach((field) => field?.removeEventListener('input', this.handleInput));
    this.saveButton?.removeEventListener('click', this.handleSave);
  }

  handleInput = () => {
    this.clearStatus();
    this.clearValidation();
    this.syncHiddenFields();
  };

  handleSave = async () => {
    this.clearStatus();
    this.syncHiddenFields();

    if (!this.validate()) return;

    try {
      if (this.storageMode === 'cart-attributes') {
        const payload = this.getPayload();
        const config = fetchConfig('json', {
          body: JSON.stringify({ attributes: payload }),
        });

        const response = await fetch(Theme.routes.cart_update_url, config);
        if (!response.ok) throw new Error('We could not save the gift details. Please try again.');
      }

      this.setStatus('Gift message saved.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not save the gift details. Please try again.';
      this.setStatus(message, 'error');
    }
  };

  clearValidation() {
    [this.toInput, this.emailInput, this.messageInput].forEach((field) => field?.setCustomValidity(''));
  }

  clearStatus() {
    if (!this.status) return;
    this.status.hidden = true;
    this.status.textContent = '';
    delete this.status.dataset.status;
  }

  setStatus(message, type) {
    if (!this.status) return;
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.status = type;
  }

  getPayload() {
    const email = this.emailInput?.value.trim() || '';

    return {
      giftnote_to: this.toInput?.value.trim() || '',
      giftnote_from: this.defaultFrom,
      giftnote_message: this.messageInput?.value.trim() || '',
      giftnote_medium: 'email',
      giftnote_email: email,
      giftnote_phone: '',
      giftnote_method: 'instant',
      giftnote_time: '',
    };
  }

  syncHiddenFields() {
    if (this.storageMode !== 'line-item-properties') return;

    const payload = this.getPayload();
    this.hiddenFields.forEach((field) => {
      const key = field.getAttribute('data-hidden-field');
      if (!key) return;
      field.value = payload[key] || '';
    });
  }

  validate() {
    this.clearValidation();

    if (this.toInput && !this.toInput.value.trim()) {
      this.toInput.setCustomValidity('Enter the recipient name.');
    }

    if (this.emailInput) {
      this.emailInput.value = this.emailInput.value.trim();
      if (!this.emailInput.value) {
        this.emailInput.setCustomValidity('Enter the recipient email address.');
      } else if (!this.emailInput.checkValidity()) {
        this.emailInput.setCustomValidity('Enter a valid email address.');
      }
    }

    const invalidField = [this.toInput, this.emailInput].find((field) => field && !field.checkValidity());

    if (!invalidField) return true;

    invalidField.reportValidity();
    return false;
  }

  async beforeSubmit() {
    this.clearStatus();
    this.syncHiddenFields();

    if (!this.validate()) return false;

    if (this.storageMode !== 'cart-attributes') return true;

    const payload = this.getPayload();
    const config = fetchConfig('json', {
      body: JSON.stringify({ attributes: payload }),
    });

    const response = await fetch(Theme.routes.cart_update_url, config);
    if (response.ok) return true;

    const message = 'We could not save the gift details. Please try again.';
    this.setStatus(message, 'error');
    throw new Error(message);
  }
}

if (!customElements.get('giftnote-embedded-form')) {
  customElements.define('giftnote-embedded-form', GiftnoteEmbeddedForm);
}
