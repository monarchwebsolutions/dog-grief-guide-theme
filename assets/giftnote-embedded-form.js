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
    this.messageCount = this.querySelector('[data-ref="messageCount"]');
    this.emailInput = this.querySelector('[data-ref="email"]');
    this.status = this.querySelector('[data-ref="status"]');
    this.hiddenFields = Array.from(this.querySelectorAll('[data-hidden-field]'));

    this.storageMode = this.dataset.storageMode || 'cart-attributes';
    this.defaultMethod = this.dataset.defaultMethod || 'tracked';
    this.defaultFrom = this.dataset.defaultFrom || '';

    [this.toInput, this.messageInput, this.emailInput].forEach((field) =>
      field?.addEventListener('input', this.handleInput)
    );

    if (this.toInput) this.toInput.required = true;
    if (this.emailInput) this.emailInput.required = true;

    this.updateCharacterCount();
    this.syncHiddenFields();
  }

  disconnectedCallback() {
    [this.toInput, this.messageInput, this.emailInput].forEach((field) =>
      field?.removeEventListener('input', this.handleInput)
    );
  }

  handleInput = () => {
    this.clearStatus();
    this.clearValidation();
    this.updateCharacterCount();
    this.syncHiddenFields();
  };

  updateCharacterCount() {
    if (!this.messageInput || !this.messageCount) return;
    this.messageCount.textContent = `${this.messageInput.value.length}/${this.messageInput.maxLength}`;
  }

  clearValidation() {
    [this.toInput, this.emailInput, this.messageInput].forEach((field) => field?.setCustomValidity(''));
  }

  clearStatus() {
    if (!this.status) return;
    this.status.hidden = true;
    this.status.textContent = '';
  }

  setStatus(message) {
    if (!this.status) return;
    this.status.hidden = false;
    this.status.textContent = message;
  }

  getPayload() {
    return {
      giftnote_to: this.toInput?.value.trim() || '',
      giftnote_from: this.defaultFrom,
      giftnote_message: this.messageInput?.value.trim() || '',
      giftnote_medium: 'email',
      giftnote_email: this.emailInput?.value.trim() || '',
      giftnote_phone: '',
      giftnote_method: this.defaultMethod,
      giftnote_time: '',
    };
  }

  syncHiddenFields = () => {
    if (this.storageMode !== 'line-item-properties') return;

    const payload = this.getPayload();
    this.hiddenFields.forEach((field) => {
      const key = field.getAttribute('data-hidden-field');
      if (!key) return;

      field.value = payload[key] || '';
      field.disabled = false;
    });
  };

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
    this.setStatus(message);
    throw new Error(message);
  }
}

if (!customElements.get('giftnote-embedded-form')) {
  customElements.define('giftnote-embedded-form', GiftnoteEmbeddedForm);
}
