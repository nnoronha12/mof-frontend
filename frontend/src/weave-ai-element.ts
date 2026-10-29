import * as React from 'react';
import * as ReactDOM from 'react-dom/client'; // ✅ Use react-dom/client for React 18+
import { WeaveAiChat } from './components/WeaveAiChat';
import weaveAiChatCss from './components/WeaveAiChat.css?inline';
import inputCss from './styles/input.css?inline'
import sideBarCss from './components/Sidebar.css?inline';

class WeaveAiElement extends HTMLElement {
  private root: ShadowRoot;
  private reactRoot: HTMLDivElement;
  private reactInstance?: ReactDOM.Root;
  private isInitialized = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });

    // Create container for React
    this.reactRoot = document.createElement('div');
    this.reactRoot.className = 'weave-ai-chat';
    this.reactRoot.style.height = '100%';

    // Add Google Fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap';
    this.root.appendChild(fontLink);

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .weave-ai-chat {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
    `;
    this.root.appendChild(styleElement);

    const style = document.createElement('style');
    style.textContent = inputCss;
    this.root.appendChild(style);

    const weaveStyle = document.createElement('style');
    weaveStyle.textContent = weaveAiChatCss;
    this.root.appendChild(weaveStyle);

    const sideBarStyle = document.createElement('style');
    sideBarStyle.textContent = sideBarCss;
    this.root.appendChild(sideBarStyle);

    this.root.appendChild(this.reactRoot);
  }

  static get observedAttributes() {
    return [
      'api-config',
      'placeholder',
      'class-name',
      'theme-colors',
      'side-menu-close-default',
      'is-collapsed',
      'on-view-ai-services-close',
      'is-mobile',
      'is-arabic-language',
      'WebSocketEvent',
    ];
  }

  connectedCallback() {
    // Wait for all attributes to be set before first render
    setTimeout(() => {
      this.isInitialized = true;
      this.render();
    }, 0);
  }

  disconnectedCallback() {
    if (this.reactInstance) {
      this.reactInstance.unmount();
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (this.isInitialized) {
      this.render();
    }
  }

  dispatchViewAIServicesCloseEvent() {
    console.log('Dispatching viewAIServicesClose event');
    const event = new CustomEvent('viewAIServicesClose', {
      bubbles: true,
      composed: true // Allows the event to cross shadow DOM boundaries
    });
    this.dispatchEvent(event);
  }

  dispatchWebSocketEvent() {
    console.log('Dispatching WebSocketEvent event');
    const event2 = new CustomEvent('WebSocketEvent', {
      bubbles: true,
      composed: true 
    });
   // event2.stopPropagation()
    this.dispatchEvent(event2);
  }

  public handleChatInteraction(action: string, data: any) {
    // Dispatch a custom event with action and data
    const event = new CustomEvent('chatInteraction', {
      detail: { action, data },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }


  private render() {
    const apiConfig = this.getAttribute('api-config') ? JSON.parse(this.getAttribute('api-config')!) : undefined;
    const isCollapsed = this.getAttribute('is-collapsed') === 'true';
    const className = this.getAttribute('class-name') || undefined;
    const placeholder = this.getAttribute('placeholder') || undefined;
    const themeColors = this.getAttribute('theme-colors') ? JSON.parse(this.getAttribute('theme-colors')!) : undefined;
    const sideMenuClose = this.getAttribute('side-menu-close-default') || undefined;
    const closeButtonVisible = this.getAttribute('is-ai-services-close-button-visible') || undefined;
    const isMobileParameter = this.getAttribute('is-mobile');
    const isArabicLanguageParameter = this.getAttribute('is-arabic-language'); 
    const onViewAIServicesClose = () => {
      console.log('onViewAIServicesClose called in web component');
      this.dispatchViewAIServicesCloseEvent();
    };

     const OnWebSocketEvent = () => {
      console.log(' OnWebSocketEvent called in web component');
      this.dispatchWebSocketEvent();
    };

    const isAIServicesCloseButtonVisible = closeButtonVisible === 'true';
    const sideMenuCloseDefault = sideMenuClose === 'true';
    const IsMobile = isMobileParameter === 'true';
    const IsArabicLanguage = isArabicLanguageParameter === 'true';

    const props = {
      apiConfig,
      isCollapsed,
      className,
      placeholder,
      isAIServicesCloseButtonVisible,
      themeColors,
      onViewAIServicesClose,
      OnWebSocketEvent,
      sideMenuCloseDefault,
      IsMobile,
      IsArabicLanguage
    };

    if (!this.reactInstance) {
      this.reactInstance = ReactDOM.createRoot(this.reactRoot);
    }

    this.reactInstance.render(React.createElement(WeaveAiChat, props));
  }
}

customElements.define('weave-ai-chat', WeaveAiElement);
