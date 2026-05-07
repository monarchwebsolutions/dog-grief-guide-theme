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

    this.modeInputs = Array.from(this.querySelectorAll('[data-ref="mode"]'));
    this.panel = this.querySelector('[data-ref="panel"]');
    this.toInput = this.querySelector('[data-ref="to"]');
    this.fromInput = this.querySelector('[data-ref="from"]');
    this.messageInput = this.querySelector('[data-ref="message"]');
    this.messageCount = this.querySelector('[data-ref="messageCount"]');
    this.emailInput = this.querySelector('[data-ref="email"]');
    this.phoneInput = this.querySelector('[data-ref="phone"]');
    this.methodInputs = Array.from(this.querySelectorAll('[data-ref="method"]'));
    this.methodHelp = this.querySelector('[data-ref="methodHelp"]');
    this.scheduleField = this.querySelector('[data-ref="scheduleField"]');
    this.timeInput = this.querySelector('[data-ref="time"]');
    this.status = this.querySelector('[data-ref="status"]');
    this.hiddenFields = Array.from(this.querySelectorAll('[data-hidden-field]'));

    this.storageMode = this.dataset.storageMode || 'cart-attributes';
    this.defaultMethod = this.dataset.defaultMethod || 'tracked';
    this.defaultFrom = this.dataset.defaultFrom || '';

    this.modeInputs.forEach((field) => field?.addEventListener('change', this.handleModeChange));
    this.methodInputs.forEach((field) => field?.addEventListener('change', this.handleMethodChange));
    [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput, this.timeInput].forEach((field) =>
      field?.addEventListener('input', this.handleInput)
    );

    if (this.fromInput && !this.fromInput.value) {
      this.fromInput.value = this.defaultFrom;
    }

    this.updateCharacterCount();
    this.updateModeState();
    this.updateMethodState();
    this.syncHiddenFields();
  }

  disconnectedCallback() {
    this.modeInputs.forEach((field) => field?.removeEventListener('change', this.handleModeChange));
    this.methodInputs.forEach((field) => field?.removeEventListener('change', this.handleMethodChange));
    [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput, this.timeInput].forEach((field) =>
      field?.removeEventListener('input', this.handleInput)
    );
  }

  get giftingEnabled() {
    return this.modeInputs.find((field) => field.checked)?.value === 'gift';
  }

  get selectedMethod() {
    return this.methodInputs.find((field) => field.checked)?.value || this.defaultMethod;
  }

  handleModeChange = () => {
    this.clearStatus();
    this.clearValidation();
    this.updateModeState();
    this.updateMethodState();
    this.syncHiddenFields();
  };

  handleMethodChange = () => {
    this.clearStatus();
    this.clearValidation();
    this.updateMethodState();
    this.syncHiddenFields();
  };

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

  updateModeState() {
    if (this.panel) {
      this.panel.hidden = !this.giftingEnabled;
    }

    if (this.toInput) {
      this.toInput.required = this.giftingEnabled;
    }

    if (this.emailInput) {
      this.emailInput.required = false;
    }

    if (this.phoneInput) {
      this.phoneInput.required = false;
    }

    if (this.fromInput) {
      this.fromInput.required = this.giftingEnabled;
    }

    if (!this.giftingEnabled && this.timeInput) {
      this.timeInput.required = false;
    }
  }

  updateMethodState() {
    const method = this.selectedMethod;
    const isScheduled = this.giftingEnabled && method === 'scheduled';

    if (this.scheduleField) {
      this.scheduleField.hidden = !isScheduled;
    }

    if (this.timeInput) {
      this.timeInput.required = isScheduled;
    }

    if (!this.methodHelp) return;

    if (method === 'instant') {
      this.methodHelp.textContent = 'Your message will be sent right away after checkout.';
      return;
    }

    if (method === 'scheduled') {
      this.methodHelp.textContent = 'Choose the date and time when you want your message delivered.';
      return;
    }

    this.methodHelp.textContent = 'Your message will be sent when your order is delivered to your shipping address.';
  }

  clearValidation() {
    [this.toInput, this.fromInput, this.emailInput, this.phoneInput, this.messageInput, this.timeInput].forEach((field) =>
      field?.setCustomValidity('')
    );
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
    if (!this.giftingEnabled) {
      return GIFTFORM_FIELDS.reduce((attributes, key) => ({ ...attributes, [key]: '' }), {});
    }

    const email = this.emailInput?.value.trim() || '';
    const phone = this.normalizePhone(this.phoneInput?.value || '');
    let medium = '';

    if (email && phone) medium = 'both';
    else if (email) medium = 'email';
    else if (phone) medium = 'phone';

    return {
      giftnote_to: this.toInput?.value.trim() || '',
      giftnote_from: this.fromInput?.value.trim() || this.defaultFrom,
      giftnote_message: this.messageInput?.value.trim() || '',
      giftnote_medium: medium,
      giftnote_email: email,
      giftnote_phone: phone,
      giftnote_method: this.selectedMethod,
      giftnote_time: this.selectedMethod === 'scheduled' ? this.toIsoString(this.timeInput?.value || '') : '',
    };
  }

  normalizePhone(value) {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const digits = trimmed.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\D/g, '')}`;

    const numeric = digits.replace(/\D/g, '');
    if (!numeric) return '';
    if (numeric.length === 10) return `+1${numeric}`;
    return `+${numeric}`;
  }

  toIsoString(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  syncHiddenFields = () => {
    if (this.storageMode !== 'line-item-properties') return;

    const payload = this.getPayload();
    this.hiddenFields.forEach((field) => {
      const key = field.getAttribute('data-hidden-field');
      if (!key) return;

      field.value = payload[key] || '';
      field.disabled = !this.giftingEnabled;
    });
  };

  validate() {
    if (!this.giftingEnabled) return true;

    this.clearValidation();

    if (this.toInput && !this.toInput.value.trim()) {
      this.toInput.setCustomValidity('Enter the recipient name.');
    }

    if (this.fromInput && !this.fromInput.value.trim()) {
      this.fromInput.setCustomValidity('Enter your name.');
    }

    if (this.emailInput) {
      this.emailInput.value = this.emailInput.value.trim();
      if (this.emailInput.value && !this.emailInput.checkValidity()) {
        this.emailInput.setCustomValidity('Enter a valid email address.');
      }
    }

    const normalizedPhone = this.normalizePhone(this.phoneInput?.value || '');

    if (!this.emailInput?.value.trim() && !normalizedPhone) {
      if (this.emailInput) {
        this.emailInput.setCustomValidity('Enter an email address, phone number, or both.');
      }
    }

    if (this.phoneInput?.value.trim() && !/^\+\d{10,15}$/.test(normalizedPhone)) {
      this.phoneInput.setCustomValidity('Enter a valid phone number including country code.');
    }

    if (this.timeInput?.required && !this.timeInput.value) {
      this.timeInput.setCustomValidity('Choose when the message should be sent.');
    }

    const invalidField = [
      this.toInput,
      this.fromInput,
      this.emailInput,
      this.phoneInput,
      this.timeInput,
    ].find((field) => field && !field.checkValidity());

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
