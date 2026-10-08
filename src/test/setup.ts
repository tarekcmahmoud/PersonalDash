import '@testing-library/jest-dom/vitest'

// jsdom lacks matchMedia, which Primer (e.g. Spinner, responsive values) calls.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom lacks these browser APIs that Primer overlays (Dialog, Tooltip, popover polyfill) rely on.
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (!('popover' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'popover', { value: null, writable: true, configurable: true })
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>
  proto.showPopover = () => {}
  proto.hidePopover = () => {}
  proto.togglePopover = () => false
}
if (!('adoptedStyleSheets' in document)) {
  Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true, configurable: true })
}
