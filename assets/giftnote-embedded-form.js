import { fetchConfig } from '@theme/utilities';

const METHOD_COPY = {
  tracked: 'Your message will be sent when your order is delivered to your shipping address.',
  instant: 'Your message will be sent immediately after checkout.',
  scheduled: 'Choose when your message should be delivered.',
};

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

    this.toggle = this.querySelector('[data-ref="toggle"]');
    this.panel = this.querySelector('[data-ref="panel"]');
    this.toInput = this.querySelector('[data-ref="to"]');
    this.fromInput = this.querySelector('[data-ref="from"]');
    this.messageInput = this.querySelector('[data-ref="message"]');
    this.messageCount = this.querySelector('[data-ref="messageCount"]');
    this.emailInput = this.querySelector('[data-ref="email"]');
    this.phoneInput = this.querySelector('[data-ref="phone"]');
    this.methodInputs = Array.from(this.querySelectorAll('[data-ref="method"]'));
    this.methodNote = this.querySelector('[data-ref="methodNote"]');
    this.scheduleField = this.querySelector('[data-ref="scheduleField"]');
    this.timeInput = this.querySelector('[data-ref="time"]');
    this.status = this.querySelector('[data-ref="status"]');
    this.hiddenFields = Array.from(this.querySelectorAll('[data-hidden-field]'));

    this.storageMode = this.dataset.storageMode || 'cart-attributes';

    this.toggle?.addEventListener('change', this.handleToggle);
    this.messageInput?.addEventListener('input', this.handleMessageInput);
    this.phoneInput?.addEventListener('blur', this.handlePhoneBlur);

    this.methodInputs.forEach((input) => input.addEventListener('change', this.handleMethodChange));
    [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput, this.timeInput].forEach((field) =>
      field?.addEventListener('input', this.syncHiddenFields)
    );

    this.updateCharacterCount();
    this.setScheduleMinimum();
    this.updateMethodState();
    this.updatePanelState();
    this.syncHiddenFields();
  }

  disconnectedCallback() {
    this.toggle?.removeEventListener('change', this.handleToggle);
    this.messageInput?.removeEventListener('input', this.handleMessageInput);
    this.phoneInput?.removeEventListener('blur', this.handlePhoneBlur);
    this.methodInputs.forEach((input) => input.removeEventListener('change', this.handleMethodChange));
    [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput, this.timeInput].forEach((field) =>
      field?.removeEventListener('input', this.syncHiddenFields)
    );
  }

  handleToggle = () => {
    this.clearStatus();
    this.clearValidation();
    this.updatePanelState();
    this.syncHiddenFields();
  };

  handleMessageInput = () => {
    this.clearStatus();
    this.updateCharacterCount();
    this.syncHiddenFields();
  };

  handlePhoneBlur = () => {
    this.clearStatus();
    this.normalizePhoneInput();
    this.syncHiddenFields();
  };

  handleMethodChange = () => {
    this.clearStatus();
    this.updateMethodState();
    this.syncHiddenFields();
  };

  get giftEnabled() {
    return Boolean(this.toggle?.checked);
  }

  get currentMethod() {
    return this.methodInputs.find((input) => input.checked)?.value || (this.dataset.allowTracked === 'true' ? 'tracked' : 'instant');
  }

  updatePanelState() {
    if (!this.panel) return;

    this.panel.hidden = !this.giftEnabled;

    const requiredFields = [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput];
    requiredFields.forEach((field) => this.setFieldRequired(field, this.giftEnabled));

    if (!this.giftEnabled) {
      this.setFieldRequired(this.timeInput, false);
    } else {
      this.updateMethodState();
    }
  }

  updateCharacterCount() {
    if (!this.messageInput || !this.messageCount) return;
    this.messageCount.textContent = `${this.messageInput.value.length}/${this.messageInput.maxLength}`;
  }

  updateMethodState() {
    if (!this.methodNote || !this.scheduleField) return;

    const method = this.currentMethod;
    const isScheduled = method === 'scheduled';

    this.setScheduleMinimum();
    this.methodNote.textContent = METHOD_COPY[method] || METHOD_COPY.instant;
    this.scheduleField.hidden = !isScheduled;
    this.setFieldRequired(this.timeInput, this.giftEnabled && isScheduled);

    if (!isScheduled && this.timeInput) {
      this.timeInput.value = '';
    }
  }

  setScheduleMinimum() {
    if (!this.timeInput) return;

    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.timeInput.min = localDateTime;
  }

  setFieldRequired(field, required) {
    if (!field) return;

    if (required) {
      field.setAttribute('required', 'required');
    } else {
      field.removeAttribute('required');
      field.setCustomValidity('');
    }
  }

  clearValidation() {
    [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput, this.timeInput].forEach((field) =>
      field?.setCustomValidity('')
    );
  }

  clearStatus() {
    if (!this.status) return;
    this.status.hidden = true;
    this.status.textContent = '';
    delete this.status.dataset.status;
  }

  setStatus(message, type = 'error') {
    if (!this.status) return;
    this.status.hidden = false;
    this.status.dataset.status = type;
    this.status.textContent = message;
  }

  normalizePhoneInput() {
    if (!this.phoneInput) return '';

    const rawValue = this.phoneInput.value.trim();
    if (!rawValue) {
      this.phoneInput.value = '';
      return '';
    }

    if (rawValue.startsWith('+')) {
      const digits = rawValue.slice(1).replace(/\D/g, '');
      const normalized = digits ? `+${digits}` : '';
      this.phoneInput.value = normalized;
      return normalized;
    }

    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      const normalized = `+1${digitsOnly}`;
      this.phoneInput.value = normalized;
      return normalized;
    }

    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      const normalized = `+${digitsOnly}`;
      this.phoneInput.value = normalized;
      return normalized;
    }

    this.phoneInput.value = digitsOnly;
    return digitsOnly;
  }

  getIsoTime() {
    if (!this.timeInput?.value) return '';

    const parsedDate = new Date(this.timeInput.value);
    if (Number.isNaN(parsedDate.getTime())) return '';

    return parsedDate.toISOString();
  }

  getPayload() {
    const phone = this.normalizePhoneInput();

    if (!this.giftEnabled) {
      return GIFTFORM_FIELDS.reduce((attributes, key) => ({ ...attributes, [key]: '' }), {});
    }

    return {
      giftnote_to: this.toInput?.value.trim() || '',
      giftnote_from: this.fromInput?.value.trim() || '',
      giftnote_message: this.messageInput?.value.trim() || '',
      giftnote_medium: 'both',
      giftnote_email: this.emailInput?.value.trim() || '',
      giftnote_phone: phone,
      giftnote_method: this.currentMethod,
      giftnote_time: this.currentMethod === 'scheduled' ? this.getIsoTime() : '',
    };
  }

  syncHiddenFields = () => {
    if (this.storageMode !== 'line-item-properties') return;

    const payload = this.getPayload();
    this.hiddenFields.forEach((field) => {
      const key = field.getAttribute('data-hidden-field');
      if (!key) return;

      field.value = payload[key] || '';
      field.disabled = !this.giftEnabled;
    });
  };

  validate() {
    if (!this.giftEnabled) return true;

    this.clearValidation();

    if (this.toInput && !this.toInput.value.trim()) {
      this.toInput.setCustomValidity('Enter the recipient name.');
    }

    if (this.fromInput && !this.fromInput.value.trim()) {
      this.fromInput.setCustomValidity('Enter the sender name.');
    }

    if (this.messageInput && !this.messageInput.value.trim()) {
      this.messageInput.setCustomValidity('Enter a gift message.');
    }

    if (this.emailInput) {
      this.emailInput.value = this.emailInput.value.trim();
      if (!this.emailInput.value) {
        this.emailInput.setCustomValidity('Enter the recipient email address.');
      } else if (!this.emailInput.checkValidity()) {
        this.emailInput.setCustomValidity('Enter a valid email address.');
      }
    }

    if (this.phoneInput) {
      const normalizedPhone = this.normalizePhoneInput();
      if (!normalizedPhone) {
        this.phoneInput.setCustomValidity('Enter the recipient phone number.');
      } else if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
        this.phoneInput.setCustomValidity('Enter the phone number in E.164 format, like +17082616039.');
      }
    }

    if (this.currentMethod === 'scheduled' && this.timeInput) {
      if (!this.timeInput.value) {
        this.timeInput.setCustomValidity('Choose when the message should be sent.');
      } else if (!this.getIsoTime()) {
        this.timeInput.setCustomValidity('Enter a valid delivery date and time.');
      }
    }

    const invalidField = [this.toInput, this.fromInput, this.messageInput, this.emailInput, this.phoneInput, this.timeInput].find(
      (field) => field && !field.checkValidity()
    );

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
